import { renderAsync } from "docx-preview";
import { DocxOpenError } from "../docx-open-error";
import type { DocxSemanticModel } from "../docx-semantic-model";
import {
  mapRenderedParagraphs,
  sanitizeRenderedDocx,
  type DocxRendererAdapter,
  type DocxRendererSession,
} from "./docx-renderer-adapter";

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
    let paragraphElements: ReadonlyMap<number, HTMLElement>;
    try {
      paragraphElements = mapRenderedParagraphs(staging, model.paragraphs);
    } catch (error) {
      throw new DocxOpenError(
        "incompatible",
        "docx-preview output does not map exactly to the project-owned paragraph model",
        { cause: error },
      );
    }
    signal.throwIfAborted();
    container.replaceChildren(staging);
    return {
      candidate: "docx-preview",
      paragraphElements,
      warnings: [],
      revealParagraph: (ordinal) => paragraphElements.get(ordinal) ?? null,
      dispose: () => {
        staging.replaceChildren();
        if (staging.parentElement === container) container.replaceChildren();
      },
    };
  }
}
