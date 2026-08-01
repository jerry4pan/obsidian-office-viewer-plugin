import { renderAsync } from "docx-preview";
import { DocxOpenError } from "../docx-open-error";
import type { DocxSemanticModel } from "../docx-semantic-model";
import {
  alignRenderedParagraphs,
  comparableParagraphText,
  mapRenderedParagraphs,
  prepareRenderedDocxReadingLayout,
  sanitizeRenderedDocx,
  type DocxRendererAdapter,
  type DocxRendererSession,
} from "./docx-renderer-adapter";

function revealMappedOrUniqueText(
  staging: HTMLElement,
  paragraphElements: ReadonlyMap<number, HTMLElement>,
  model: DocxSemanticModel,
  ordinal: number,
): HTMLElement | null {
  const mapped = paragraphElements.get(ordinal);
  if (mapped !== undefined) return mapped;
  const semantic = model.paragraphs[ordinal - 1];
  if (semantic === undefined || semantic.ordinal !== ordinal) return null;
  const needle = comparableParagraphText(semantic.text);
  if (needle.length === 0) return null;
  const matches = Array.from(
    staging.querySelectorAll<HTMLElement>("p, h1, h2, h3, h4, h5, h6, li"),
  ).filter(
    (element) =>
      element.querySelector("p, h1, h2, h3, h4, h5, h6, li") === null &&
      comparableParagraphText(element.textContent ?? "") === needle,
  );
  if (matches.length !== 1) return null;
  const element = matches[0];
  if (element === undefined) return null;
  element.dataset.docxParagraphOrdinal = String(ordinal);
  return element;
}

export class DocxPreviewRendererAdapter implements DocxRendererAdapter {
  async open(
    buffer: ArrayBuffer,
    container: HTMLElement,
    model: DocxSemanticModel,
    signal: AbortSignal,
  ): Promise<DocxRendererSession> {
    signal.throwIfAborted();
    const staging = document.createElement("div");
    staging.className = "office-viewer-docx office-viewer-docx--preview";
    try {
      await renderAsync(buffer.slice(0), staging, staging, {
        inWrapper: true,
        hideWrapperOnPrint: false,
        ignoreWidth: true,
        ignoreHeight: true,
        ignoreFonts: false,
        breakPages: false,
        debug: false,
        experimental: false,
        className: "docx",
        trimXmlDeclaration: true,
        renderHeaders: false,
        renderFooters: false,
        renderFootnotes: false,
        renderEndnotes: false,
        ignoreLastRenderedPageBreak: true,
        useBase64URL: true,
        renderChanges: false,
        renderComments: false,
        renderAltChunks: false,
      });
    } catch (error) {
      signal.throwIfAborted();
      throw new DocxOpenError(
        "incompatible",
        "docx-preview could not render the DOCX",
        { cause: error },
      );
    }
    signal.throwIfAborted();
    sanitizeRenderedDocx(staging);
    prepareRenderedDocxReadingLayout(staging);
    const warnings: string[] = [];
    let paragraphElements: ReadonlyMap<number, HTMLElement>;
    try {
      paragraphElements = mapRenderedParagraphs(staging, model.paragraphs);
    } catch {
      // Keep the readable preview: bind only order-preserving exact-character
      // matches instead of failing the whole document open.
      paragraphElements = alignRenderedParagraphs(staging, model.paragraphs);
      if (paragraphElements.size < model.paragraphs.length) {
        warnings.push("preview-paragraph-mapping-degraded");
      }
      if (paragraphElements.size === 0 && model.paragraphs.length > 0) {
        throw new DocxOpenError(
          "incompatible",
          "docx-preview output does not map to the project-owned paragraph model",
        );
      }
    }
    signal.throwIfAborted();
    container.replaceChildren(staging);
    return {
      candidate: "docx-preview",
      paragraphElements,
      warnings,
      revealParagraph: (ordinal) =>
        revealMappedOrUniqueText(
          staging,
          paragraphElements,
          model,
          ordinal,
        ),
      dispose: () => {
        staging.replaceChildren();
        if (staging.parentElement === container) container.replaceChildren();
      },
    };
  }
}
