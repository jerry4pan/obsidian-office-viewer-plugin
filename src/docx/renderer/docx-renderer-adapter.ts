import type {
  DocxSemanticModel,
  DocxSemanticParagraph,
} from "../docx-semantic-model";

export type DocxRendererCandidate =
  | "docx-preview"
  | "bounded-semantic";

export interface DocxRendererSession {
  readonly candidate: DocxRendererCandidate;
  readonly paragraphElements: ReadonlyMap<number, HTMLElement>;
  readonly warnings: readonly string[];
  readonly managesUnavailableContent?: boolean;
  revealParagraph(ordinal: number): HTMLElement | null;
  dispose(): void;
}

export interface DocxRendererAdapter {
  open(
    buffer: ArrayBuffer,
    container: HTMLElement,
    model: DocxSemanticModel,
    signal: AbortSignal,
  ): Promise<DocxRendererSession>;
}

export function normalizedRenderedParagraphText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const PARAGRAPH_SELECTOR = "p, h1, h2, h3, h4, h5, h6, li";

function leafRenderedParagraphs(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(PARAGRAPH_SELECTOR),
  ).filter(
    (element) => element.querySelector(PARAGRAPH_SELECTOR) === null,
  );
}

export function mapRenderedParagraphs(
  container: HTMLElement,
  paragraphs: readonly DocxSemanticParagraph[],
): ReadonlyMap<number, HTMLElement> {
  const rendered = leafRenderedParagraphs(container).filter(
    (element) =>
      normalizedRenderedParagraphText(element.textContent ?? "").length > 0,
  );
  if (rendered.length !== paragraphs.length) {
    throw new Error(
      `Renderer paragraph count ${rendered.length} does not match semantic paragraph count ${paragraphs.length}`,
    );
  }
  const mapping = new Map<number, HTMLElement>();
  for (let index = 0; index < paragraphs.length; index += 1) {
    const semantic = paragraphs[index];
    const element = rendered[index];
    if (semantic === undefined || element === undefined) {
      throw new Error("Renderer paragraph mapping is incomplete");
    }
    const semanticText = normalizedRenderedParagraphText(semantic.text);
    const renderedText = normalizedRenderedParagraphText(
      element.textContent ?? "",
    );
    if (semanticText !== renderedText) {
      throw new Error(
        `Renderer paragraph ${semantic.ordinal} text does not match the semantic model`,
      );
    }
    element.dataset.docxParagraphOrdinal = String(semantic.ordinal);
    mapping.set(semantic.ordinal, element);
  }
  return mapping;
}

export function sanitizeRenderedDocx(container: HTMLElement): void {
  for (const element of container.querySelectorAll(
    "script, iframe, frame, object, embed, form, input, textarea, select, button, meta, base",
  )) {
    element.remove();
  }
  for (const element of container.querySelectorAll<HTMLElement>("*")) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (
        name.startsWith("on") ||
        name === "srcdoc" ||
        name === "formaction"
      ) {
        element.removeAttribute(attribute.name);
      }
    }
    if (element instanceof HTMLAnchorElement) {
      const rawHref = element.getAttribute("href");
      if (rawHref === null) continue;
      if (rawHref.startsWith("#")) {
        element.dataset.docxBookmark = rawHref.slice(1);
        element.removeAttribute("href");
        continue;
      }
      let protocol: string | null = null;
      try {
        protocol = new URL(rawHref).protocol;
      } catch {
        protocol = null;
      }
      if (
        protocol !== "https:" &&
        protocol !== "http:" &&
        protocol !== "mailto:"
      ) {
        element.removeAttribute("href");
      } else {
        element.dataset.docxExternalLink = "true";
        element.setAttribute("rel", "noopener noreferrer");
      }
    }
    if (element instanceof HTMLImageElement) {
      const source = element.getAttribute("src") ?? "";
      if (!source.startsWith("data:") && !source.startsWith("blob:")) {
        element.removeAttribute("src");
        element.dataset.docxUnavailableImage = "true";
      }
    }
  }
  for (const style of container.querySelectorAll("style")) {
    const css = style.textContent ?? "";
    if (
      /@import/i.test(css) ||
      /url\(\s*(['"]?)\s*(?:https?:|file:|javascript:)/i.test(css)
    ) {
      style.remove();
    }
  }
}
