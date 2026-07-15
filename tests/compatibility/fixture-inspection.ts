import { browser } from "@wdio/globals";
import type { MainContentCheck } from "./corpus-manifest";

export interface ContentInspection {
  readonly expectedContent: readonly string[];
  readonly readableContent: readonly string[];
}

export async function inspectActiveFixture(
  checks: readonly MainContentCheck[],
): Promise<ContentInspection> {
  const readableContent = await browser.execute((expectedChecks) => {
    const root = document.querySelector(
      ".workspace-leaf.mod-active .pptx-viewer",
    );
    const surface = root?.querySelector(".pptx-viewer__slide");
    if (!root || !surface) return [];
    const surfaceBounds = surface.getBoundingClientRect();
    const rootBounds = root.getBoundingClientRect();
    const clip = {
      left: Math.max(surfaceBounds.left, rootBounds.left, 0),
      top: Math.max(surfaceBounds.top, rootBounds.top, 0),
      right: Math.min(surfaceBounds.right, rootBounds.right, window.innerWidth),
      bottom: Math.min(surfaceBounds.bottom, rootBounds.bottom, window.innerHeight),
    };
    const withinClip = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.left >= clip.left - 1 &&
        bounds.top >= clip.top - 1 &&
        bounds.right <= clip.right + 1 &&
        bounds.bottom <= clip.bottom + 1
      );
    };
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
    const images = Array.from(surface.querySelectorAll("img"));
    const fontAvailable = (family: string) => {
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return false;
      const sample = "mmmmmmmmmwwwwwiiiiii";
      return ["monospace", "serif", "sans-serif"].some((fallback) => {
        context.font = `72px ${fallback}`;
        const fallbackWidth = context.measureText(sample).width;
        context.font = `72px "${family}", ${fallback}`;
        return context.measureText(sample).width !== fallbackWidth;
      });
    };
    let imageIndex = 0;
    return expectedChecks.flatMap((check) => {
      if (check.kind === "text") {
        const readable = textNodes.some(
          (node) =>
            node.textContent?.includes(check.text) &&
            node.parentElement !== null &&
            withinClip(node.parentElement),
        );
        return readable ? [check.label] : [];
      }
      if (check.kind === "font") {
        const node = textNodes.find((candidate) =>
          candidate.textContent?.includes(check.text),
        );
        const parent = node?.parentElement;
        const declared = parent
          ? getComputedStyle(parent).fontFamily.includes(check.family)
          : false;
        return parent &&
          withinClip(parent) &&
          declared &&
          fontAvailable(check.family) === check.expectedAvailable
          ? [check.label]
          : [];
      }
      if (check.kind === "image") {
        const candidate = images[imageIndex++];
        return candidate?.complete &&
          candidate.naturalWidth > 0 &&
          withinClip(candidate)
          ? [check.label]
          : [];
      }
      const elements = Array.from(surface.querySelectorAll(check.selector));
      return elements.length > 0 && elements.every(withinClip)
        ? [check.label]
        : [];
    });
  }, [...checks]);
  return {
    expectedContent: checks.map(({ label }) => label),
    readableContent,
  };
}
