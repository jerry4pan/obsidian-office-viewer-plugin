import { DocxOpenError } from "../docx-open-error";
import type {
  DocxSemanticModel,
  DocxSemanticParagraph,
} from "../docx-semantic-model";
import type {
  DocxRendererAdapter,
  DocxRendererSession,
} from "./docx-renderer-adapter";

export interface BoundedDocxRendererOptions {
  readonly largeParagraphThreshold: number;
  readonly windowSize: number;
  readonly unavailablePlaceholder: string;
}

const DEFAULT_OPTIONS: BoundedDocxRendererOptions = {
  largeParagraphThreshold: 1_000,
  windowSize: 240,
  unavailablePlaceholder: "This document content cannot be displayed.",
};

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

function hyperlinkElement(
  hyperlink: DocxSemanticParagraph["hyperlinks"][number],
): HTMLElement {
  if (hyperlink.kind === "blocked") {
    const blocked = document.createElement("span");
    blocked.className = "office-viewer-docx-blocked-link";
    blocked.dataset.docxBlockedLink = "true";
    blocked.textContent = hyperlink.label;
    return blocked;
  }
  const anchor = document.createElement("a");
  anchor.textContent = hyperlink.label;
  if (hyperlink.kind === "external") {
    anchor.href = hyperlink.target;
    anchor.dataset.docxExternalLink = "true";
    anchor.rel = "noopener noreferrer";
  } else {
    anchor.href = "#";
    anchor.dataset.docxBookmark = hyperlink.bookmark;
  }
  return anchor;
}

function appendParagraphText(
  element: HTMLElement,
  paragraph: DocxSemanticParagraph,
): void {
  let cursor = 0;
  for (const hyperlink of paragraph.hyperlinks) {
    const index = hyperlink.label.length === 0
      ? -1
      : paragraph.text.indexOf(hyperlink.label, cursor);
    if (index < 0) continue;
    element.append(document.createTextNode(paragraph.text.slice(cursor, index)));
    element.append(hyperlinkElement(hyperlink));
    cursor = index + hyperlink.label.length;
  }
  element.append(document.createTextNode(paragraph.text.slice(cursor)));
}

function unavailablePlaceholder(
  kinds: readonly string[],
  text: string,
): HTMLElement {
  const placeholder = document.createElement("span");
  placeholder.className = "office-viewer-docx-unavailable-content";
  placeholder.setAttribute("role", "note");
  placeholder.dataset.docxUnavailableKinds = kinds.join(",");
  placeholder.textContent = text;
  return placeholder;
}

function paragraphElement(
  paragraph: DocxSemanticParagraph,
  placeholderText: string,
): HTMLElement {
  const heading = /^Heading([1-6])$/i.exec(paragraph.styleId ?? "");
  const tag = heading === null
    ? paragraph.listItem
      ? "li"
      : "p"
    : (`h${heading[1]}` as keyof HTMLElementTagNameMap);
  const element = document.createElement(tag);
  appendParagraphText(element, paragraph);
  element.dataset.docxParagraphOrdinal = String(paragraph.ordinal);
  if (paragraph.listItem) {
    element.classList.add("office-viewer-docx-bounded-list-item");
  }
  if (paragraph.tableDepth > 0) {
    element.classList.add("office-viewer-docx-bounded-table-paragraph");
    element.setAttribute("role", "cell");
  }
  for (const kind of paragraph.unavailableContent) {
    element.append(unavailablePlaceholder([kind], placeholderText));
  }
  for (let index = 0; index < paragraph.inlineImageCount; index += 1) {
    element.append(unavailablePlaceholder(["inline-image"], placeholderText));
  }
  return element;
}

export class BoundedDocxRendererAdapter implements DocxRendererAdapter {
  private readonly options: BoundedDocxRendererOptions;

  constructor(
    private readonly delegate: DocxRendererAdapter,
    options: Partial<BoundedDocxRendererOptions> = {},
  ) {
    this.options = {
      largeParagraphThreshold: positiveInteger(
        options.largeParagraphThreshold ??
          DEFAULT_OPTIONS.largeParagraphThreshold,
        "largeParagraphThreshold",
      ),
      windowSize: positiveInteger(
        options.windowSize ?? DEFAULT_OPTIONS.windowSize,
        "windowSize",
      ),
      unavailablePlaceholder:
        options.unavailablePlaceholder ??
        DEFAULT_OPTIONS.unavailablePlaceholder,
    };
  }

  async open(
    buffer: ArrayBuffer,
    container: HTMLElement,
    model: DocxSemanticModel,
    signal: AbortSignal,
  ): Promise<DocxRendererSession> {
    if (model.paragraphs.length <= this.options.largeParagraphThreshold) {
      try {
        return await this.delegate.open(buffer, container, model, signal);
      } catch (error) {
        signal.throwIfAborted();
        if (
          !(error instanceof DocxOpenError) ||
          error.category !== "incompatible"
        ) {
          throw error;
        }
        // Preview could not bind safely: fall back to semantic reading instead
        // of failing the whole open.
        return this.openBoundedSemantic(container, model, signal, [
          "preview-unavailable-simplified-rendering",
        ]);
      }
    }
    return this.openBoundedSemantic(container, model, signal, [
      "large-document-simplified-rendering",
    ]);
  }

  private async openBoundedSemantic(
    container: HTMLElement,
    model: DocxSemanticModel,
    signal: AbortSignal,
    warnings: readonly string[],
  ): Promise<DocxRendererSession> {
    signal.throwIfAborted();

    const root = document.createElement("div");
    root.className =
      "office-viewer-docx office-viewer-docx--bounded-semantic";
    const topSpacer = document.createElement("div");
    topSpacer.className = "office-viewer-docx-bounded-spacer";
    topSpacer.setAttribute("aria-hidden", "true");
    const window = document.createElement("div");
    window.className = "office-viewer-docx-bounded-window";
    const bottomSpacer = document.createElement("div");
    bottomSpacer.className = "office-viewer-docx-bounded-spacer";
    bottomSpacer.setAttribute("aria-hidden", "true");
    root.append(topSpacer, window, bottomSpacer);

    const mounted = new Map<number, HTMLElement>();
    const bodyBlocks = new Map<number, readonly string[]>();
    for (const block of model.unavailableBodyBlocks) {
      bodyBlocks.set(block.afterParagraphOrdinal, [
        ...(bodyBlocks.get(block.afterParagraphOrdinal) ?? []),
        ...block.kinds,
      ]);
    }
    const count = model.paragraphs.length;
    const size = Math.min(this.options.windowSize, count);
    const estimatedParagraphHeight = 36;
    let start = -1;

    const renderWindow = (targetOrdinal: number): HTMLElement | null => {
      const targetIndex = Math.max(
        0,
        Math.min(count - 1, targetOrdinal - 1),
      );
      const nextStart = Math.max(
        0,
        Math.min(count - size, targetIndex - Math.floor(size / 2)),
      );
      if (nextStart !== start) {
        start = nextStart;
        mounted.clear();
        const fragment = document.createDocumentFragment();
        for (let index = start; index < start + size; index += 1) {
          const paragraph = model.paragraphs[index];
          if (paragraph === undefined) continue;
          if (paragraph.ordinal === 1) {
            const leadingKinds = bodyBlocks.get(0);
            if (leadingKinds !== undefined) {
              fragment.append(
                unavailablePlaceholder(
                  leadingKinds,
                  this.options.unavailablePlaceholder,
                ),
              );
            }
          }
          const element = paragraphElement(
            paragraph,
            this.options.unavailablePlaceholder,
          );
          mounted.set(paragraph.ordinal, element);
          fragment.append(element);
          const trailingKinds = bodyBlocks.get(paragraph.ordinal);
          if (trailingKinds !== undefined) {
            fragment.append(
              unavailablePlaceholder(
                trailingKinds,
                this.options.unavailablePlaceholder,
              ),
            );
          }
        }
        window.replaceChildren(fragment);
        topSpacer.style.height =
          `${start * estimatedParagraphHeight}px`;
        bottomSpacer.style.height =
          `${Math.max(0, count - start - size) * estimatedParagraphHeight}px`;
      }
      return mounted.get(targetOrdinal) ?? null;
    };

    const onScroll = (): void => {
      const approximateOrdinal =
        Math.floor(container.scrollTop / estimatedParagraphHeight) + 1;
      if (
        approximateOrdinal < start + Math.floor(size / 4) ||
        approximateOrdinal > start + Math.floor((size * 3) / 4)
      ) {
        renderWindow(approximateOrdinal);
      }
    };

    renderWindow(1);
    signal.throwIfAborted();
    container.replaceChildren(root);
    container.addEventListener("scroll", onScroll, { passive: true });

    return {
      candidate: "bounded-semantic",
      paragraphElements: mounted,
      warnings,
      managesUnavailableContent: true,
      revealParagraph: (ordinal) => {
        if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > count) {
          return null;
        }
        const element = renderWindow(ordinal);
        container.scrollTop = (ordinal - 1) * estimatedParagraphHeight;
        return element;
      },
      dispose: () => {
        container.removeEventListener("scroll", onScroll);
        mounted.clear();
        root.replaceChildren();
        if (root.parentElement === container) container.replaceChildren();
      },
    };
  }
}
