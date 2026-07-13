import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  renderCompatibilityMarkdown,
  summarizeCompatibility,
  type CompatibilityObservation,
} from "../../src/compatibility/compatibility-report";
import {
  CORPUS_ENVIRONMENT,
  CORPUS_EXPECTED_GATE,
  corpusManifest,
} from "../compatibility/corpus-manifest";
import {
  assertVisualMatch,
  comparePngBuffers,
} from "../compatibility/visual-regression";

const artifactDir = path.resolve("artifacts/compatibility");
const currentDir = path.join(artifactDir, "current");
const baselineDir = path.resolve("tests/compatibility/baselines");
const updateBaselines = process.env.UPDATE_COMPATIBILITY_BASELINES === "1";

function hash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("installed PPTX compatibility corpus", () => {
  it("renders, captures and classifies every representative fixture", async () => {
    await mkdir(currentDir, { recursive: true });
    await mkdir(baselineDir, { recursive: true });
    const surface = await browser.execute((viewport) => {
      document.body.classList.remove("theme-dark");
      document.body.classList.add("theme-light");
      document.documentElement.style.zoom = "1";
      document.documentElement.style.width = `${viewport.width}px`;
      document.documentElement.style.height = `${viewport.height}px`;
      document.body.style.width = `${viewport.width}px`;
      document.body.style.height = `${viewport.height}px`;
      const bounds = document.documentElement.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    }, CORPUS_ENVIRONMENT.viewport);
    if (
      surface.width !== CORPUS_ENVIRONMENT.viewport.width ||
      surface.height !== CORPUS_ENVIRONMENT.viewport.height
    ) {
      throw new Error(
        `unable to fix capture surface at ${CORPUS_ENVIRONMENT.viewport.width}x${CORPUS_ENVIRONMENT.viewport.height}`,
      );
    }

    const sourceHashes = new Map<string, string>();
    for (const fixture of corpusManifest) {
      sourceHashes.set(
        fixture.id,
        hash(await readFile(path.resolve("tests/vault", fixture.vaultPath))),
      );
    }

    const observations: CompatibilityObservation[] = [];
    const failures: string[] = [];
    for (const fixture of corpusManifest) {
      let visualDiffRatio = 0;
      let error: string | undefined;
      let visibleMarkers: string[] = [];
      try {
        await obsidianPage.openFile(fixture.vaultPath);
        const root = await browser.$(
          ".workspace-leaf.mod-active .pptx-viewer",
        );
        await root.waitForExist({ timeout: 30_000 });
        await browser.waitUntil(async () => {
          const state = await root.getAttribute("data-state");
          if (state === "error") return true;
          return (
            state === "ready" &&
            (await root.getText()).includes(fixture.mainContentMarkers[0] ?? "")
          );
        }, {
          timeout: 30_000,
          timeoutMsg: `${fixture.id} did not render its current-file marker`,
        });
        const state = await root.getAttribute("data-state");
        if (state !== "ready") throw new Error(`view reached ${state ?? "unknown"} state`);

        const inspection = await browser.execute((markers) => {
          const rootElement = document.querySelector(
            ".workspace-leaf.mod-active .pptx-viewer",
          );
          const surface = rootElement?.querySelector(
            ".pptx-viewer__slide",
          );
          if (!rootElement || !surface) {
            return {
              visibleTextMarkers: [] as string[],
              containedLayout: false,
              healthyImages: 0,
            };
          }
          const surfaceBounds = surface.getBoundingClientRect();
          const rootBounds = rootElement.getBoundingClientRect();
          const clip = {
            left: Math.max(surfaceBounds.left, rootBounds.left, 0),
            top: Math.max(surfaceBounds.top, rootBounds.top, 0),
            right: Math.min(surfaceBounds.right, rootBounds.right, window.innerWidth),
            bottom: Math.min(
              surfaceBounds.bottom,
              rootBounds.bottom,
              window.innerHeight,
            ),
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
          const walker = document.createTreeWalker(
            rootElement,
            NodeFilter.SHOW_TEXT,
          );
          while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
          const visibleTextMarkers = markers.filter((marker) =>
            textNodes.some(
              (node) =>
                node.textContent?.includes(marker) &&
                node.parentElement !== null &&
                withinClip(node.parentElement),
            ),
          );
          const images = Array.from(rootElement.querySelectorAll("img"));
          const visualElements = Array.from(
            rootElement.querySelectorAll("img, canvas"),
          );
          return {
            visibleTextMarkers,
            containedLayout: visualElements.every(withinClip),
            healthyImages: images.filter(
              (image) => image.complete && image.naturalWidth > 0 && withinClip(image),
            ).length,
          };
        }, [...fixture.mainContentMarkers]);
        visibleMarkers = [...inspection.visibleTextMarkers];
        if (inspection.containedLayout) visibleMarkers.push("@layout-contained");
        for (
          let index = 0;
          index < Math.min(
            inspection.healthyImages,
            fixture.visualAssertions.healthyImages,
          );
          index += 1
        ) {
          visibleMarkers.push(`@healthy-image:${index + 1}`);
        }
        const slide = await root.$(".pptx-viewer__slide");
        const currentPath = path.join(currentDir, `${fixture.id}.png`);
        const current = await slide.saveScreenshot(currentPath);
        const baselinePath = path.join(baselineDir, `${fixture.id}.png`);
        if (updateBaselines) {
          await writeFile(baselinePath, current);
        } else {
          const diff = comparePngBuffers(await readFile(baselinePath), current);
          visualDiffRatio = diff.ratio;
          assertVisualMatch(
            fixture.id,
            diff,
            CORPUS_ENVIRONMENT.maxVisualDiffRatio,
          );
        }
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
        failures.push(`${fixture.id}: ${error}`);
      }

      observations.push({
        fixtureId: fixture.id,
        title: fixture.title,
        expectedMarkers: [
          ...fixture.mainContentMarkers,
          "@layout-contained",
          ...Array.from(
            { length: fixture.visualAssertions.healthyImages },
            (_, index) => `@healthy-image:${index + 1}`,
          ),
        ],
        visibleMarkers,
        reviewClassification: fixture.review.classification,
        reviewReason: fixture.review.reason,
        visualDiffRatio,
        ...(error ? { error } : {}),
      });
    }

    for (const fixture of corpusManifest) {
      const currentHash = hash(
        await readFile(path.resolve("tests/vault", fixture.vaultPath)),
      );
      if (currentHash !== sourceHashes.get(fixture.id)) {
        failures.push(`${fixture.id}: source PPTX changed during compatibility run`);
      }
    }

    const summary = summarizeCompatibility(
      observations,
      CORPUS_ENVIRONMENT.readabilityGate,
    );
    await writeFile(
      path.join(artifactDir, "results.json"),
      `${JSON.stringify({ environment: CORPUS_ENVIRONMENT, ...summary }, null, 2)}\n`,
    );
    await writeFile(
      path.join(artifactDir, "summary.md"),
      renderCompatibilityMarkdown(summary),
    );

    if (summary.gatePassed !== CORPUS_EXPECTED_GATE) {
      failures.push(
        `readability gate was ${summary.gatePassed ? "PASS" : "FAIL"}, expected ${CORPUS_EXPECTED_GATE ? "PASS" : "FAIL"}`,
      );
    }
    if (failures.length > 0) throw new Error(failures.join("\n"));
  });
});
