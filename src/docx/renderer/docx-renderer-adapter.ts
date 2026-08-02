import type {
  DocxSemanticModel,
  DocxSemanticParagraph,
} from "../docx-semantic-model";

export type DocxRendererCandidate =
  | "docx-preview"
  | "bounded-semantic";

export type DocxViewMode = "reading" | "layout";

export interface DocxRendererOpenOptions {
  readonly mode: DocxViewMode;
  readonly signal: AbortSignal;
}

export interface DocxRendererSession {
  readonly candidate: DocxRendererCandidate;
  readonly mode: DocxViewMode;
  readonly supportedModes: readonly DocxViewMode[];
  readonly paragraphAnchors: ReadonlyMap<number, HTMLElement>;
  readonly warnings: readonly string[];
  readonly managesUnavailableContent?: boolean;
  mount(container: HTMLElement): void;
  revealParagraph(ordinal: number, textHint?: string): HTMLElement | null;
  dispose(): void;
}

export interface DocxRendererAdapter {
  open(
    buffer: ArrayBuffer,
    model: DocxSemanticModel,
    options: DocxRendererOpenOptions,
  ): Promise<DocxRendererSession>;
}

export function normalizedRenderedParagraphText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Mapping comparison ignores whitespace differences that docx-preview
 * introduces around breaks and hyperlink boundaries, while still requiring
 * identical visible characters in document order.
 */
export function comparableParagraphText(value: string): string {
  return value.replace(/\s+/g, "");
}

const PARAGRAPH_SELECTOR = "p, h1, h2, h3, h4, h5, h6, li";
const EXCLUDED_CONTAINER_SELECTOR =
  "header, footer, .docx-header, .docx-footer, .docx-footnote, .docx-endnote, .docx-footnotes, .docx-endnotes";

function leafRenderedParagraphs(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(PARAGRAPH_SELECTOR),
  ).filter(
    (element) => element.querySelector(PARAGRAPH_SELECTOR) === null,
  );
}

function isMainBodyParagraph(element: HTMLElement): boolean {
  return element.closest(EXCLUDED_CONTAINER_SELECTOR) === null;
}

function visibleMainBodyParagraphs(container: HTMLElement): HTMLElement[] {
  return leafRenderedParagraphs(container).filter(
    (element) =>
      isMainBodyParagraph(element) &&
      comparableParagraphText(element.textContent ?? "").length > 0,
  );
}

function bindFragments(
  fragments: readonly HTMLElement[],
  ordinal: number,
  mapping: Map<number, HTMLElement>,
): void {
  const anchor = fragments[0];
  if (anchor === undefined) {
    throw new Error(`Renderer paragraph ${ordinal} has no fragments`);
  }
  for (const fragment of fragments) {
    fragment.dataset.docxParagraphOrdinal = String(ordinal);
  }
  mapping.set(ordinal, anchor);
}

function accumulateExactFragments(
  rendered: readonly HTMLElement[],
  startIndex: number,
  semanticText: string,
): { fragments: HTMLElement[]; nextIndex: number } {
  if (semanticText.length === 0) {
    return { fragments: [], nextIndex: startIndex };
  }
  let accumulated = "";
  const fragments: HTMLElement[] = [];
  for (let index = startIndex; index < rendered.length; index += 1) {
    const element = rendered[index];
    if (element === undefined) break;
    const piece = comparableParagraphText(element.textContent ?? "");
    if (piece.length === 0) continue;
    const next = accumulated + piece;
    if (next === semanticText) {
      fragments.push(element);
      return { fragments, nextIndex: index + 1 };
    }
    if (semanticText.startsWith(next)) {
      fragments.push(element);
      accumulated = next;
      continue;
    }
    throw new Error(
      "Renderer paragraph fragments do not match the semantic model",
    );
  }
  throw new Error(
    "Renderer paragraph fragments do not match the semantic model",
  );
}

/**
 * Maps semantic paragraphs to rendered anchors, allowing one paragraph to span
 * multiple consecutive main-body fragments after page breaks.
 */
export function mapRenderedParagraphs(
  container: HTMLElement,
  paragraphs: readonly DocxSemanticParagraph[],
): ReadonlyMap<number, HTMLElement> {
  const rendered = visibleMainBodyParagraphs(container);
  const mapping = new Map<number, HTMLElement>();
  let renderedIndex = 0;
  for (const semantic of paragraphs) {
    const semanticText = comparableParagraphText(semantic.text);
    if (semanticText.length === 0) continue;
    const { fragments, nextIndex } = accumulateExactFragments(
      rendered,
      renderedIndex,
      semanticText,
    );
    bindFragments(fragments, semantic.ordinal, mapping);
    renderedIndex = nextIndex;
  }
  if (renderedIndex < rendered.length) {
    throw new Error(
      `Renderer paragraph count leftover after semantic mapping at index ${renderedIndex}`,
    );
  }
  const expected = paragraphs.filter(
    (paragraph) => comparableParagraphText(paragraph.text).length > 0,
  ).length;
  if (mapping.size !== expected) {
    throw new Error(
      `Renderer paragraph count ${mapping.size} does not match semantic paragraph count ${expected}`,
    );
  }
  return mapping;
}

/**
 * Order-preserving exact-character mapping used when positional mapping fails.
 * Only binds paragraphs whose comparable text matches; never invents a binding.
 * Supports multi-fragment paragraphs with the same exact-prefix rules.
 */
export function alignRenderedParagraphs(
  container: HTMLElement,
  paragraphs: readonly DocxSemanticParagraph[],
): ReadonlyMap<number, HTMLElement> {
  const rendered = visibleMainBodyParagraphs(container);
  const mapping = new Map<number, HTMLElement>();
  let renderedIndex = 0;
  for (const semantic of paragraphs) {
    const semanticText = comparableParagraphText(semantic.text);
    if (semanticText.length === 0) continue;
    let bound = false;
    for (let start = renderedIndex; start < rendered.length; start += 1) {
      try {
        const { fragments, nextIndex } = accumulateExactFragments(
          rendered,
          start,
          semanticText,
        );
        bindFragments(fragments, semantic.ordinal, mapping);
        renderedIndex = nextIndex;
        bound = true;
        break;
      } catch {
        // Keep scanning forward; never skip by fuzzy matching.
      }
    }
    if (!bound) continue;
  }
  return mapping;
}

export function fragmentsForParagraphOrdinal(
  root: ParentNode,
  ordinal: number,
): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      `[data-docx-paragraph-ordinal="${ordinal}"]`,
    ),
  ).filter(isMainBodyParagraph);
}

export function revealParagraphFragment(
  root: ParentNode,
  paragraphAnchors: ReadonlyMap<number, HTMLElement>,
  ordinal: number,
  textHint?: string,
): HTMLElement | null {
  const fragments = fragmentsForParagraphOrdinal(root, ordinal);
  if (fragments.length === 0) {
    return paragraphAnchors.get(ordinal) ?? null;
  }
  const hint = textHint === undefined
    ? ""
    : comparableParagraphText(textHint);
  if (hint.length > 0) {
    const matching = fragments.find((fragment) =>
      comparableParagraphText(fragment.textContent ?? "").includes(hint)
    );
    if (matching !== undefined) return matching;
  }
  return fragments[0] ?? null;
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

/**
 * Adds project-owned hooks around docx-preview media and tables so reading-mode
 * CSS can shrink fixed-size content without depending on the renderer's
 * inline-style shape. Authored widths remain upper bounds on wide panes.
 */
export function prepareRenderedDocxReadingLayout(
  container: HTMLElement,
): void {
  for (const image of container.querySelectorAll<HTMLImageElement>("img")) {
    image.classList.add("office-viewer-docx-media");
    const wrapper = image.parentElement;
    if (
      wrapper === null ||
      wrapper.tagName !== "DIV" ||
      wrapper.style.display !== "inline-block" ||
      wrapper.children.length !== 1 ||
      wrapper.firstElementChild !== image
    ) {
      continue;
    }
    wrapper.classList.add("office-viewer-docx-media-wrapper");
    const authoredWidth = wrapper.style.width.trim();
    if (authoredWidth.length > 0) {
      wrapper.style.setProperty(
        "--office-viewer-docx-media-width",
        authoredWidth,
      );
    }
  }
  for (const table of container.querySelectorAll<HTMLTableElement>("table")) {
    table.classList.add("office-viewer-docx-table");
    const authoredWidth = table.style.width.trim();
    if (authoredWidth.length > 0 && authoredWidth !== "auto") {
      table.style.setProperty(
        "--office-viewer-docx-table-width",
        authoredWidth,
      );
    }
    const columns = Array.from(
      table.querySelectorAll<HTMLTableColElement>("col"),
    ).filter((column) => column.closest("table") === table);
    const parsedWidths = columns.map((column) => {
      const match = column.style.width
        .trim()
        .match(/^([0-9]+(?:\.[0-9]+)?)([a-z]+)$/i);
      if (match === null) return null;
      const value = Number.parseFloat(match[1] ?? "");
      const unit = match[2]?.toLowerCase() ?? "";
      return Number.isFinite(value) && value > 0 ? { value, unit } : null;
    });
    const unit = parsedWidths[0]?.unit;
    if (
      unit === undefined ||
      parsedWidths.some((width) => width === null || width.unit !== unit)
    ) {
      continue;
    }
    const total = parsedWidths.reduce(
      (sum, width) => sum + (width?.value ?? 0),
      0,
    );
    if (total <= 0) continue;
    columns.forEach((column, index) => {
      const width = parsedWidths[index];
      if (width === undefined || width === null) return;
      column.style.setProperty(
        "--office-viewer-docx-column-width",
        `${(width.value / total) * 100}%`,
      );
    });
  }
}
