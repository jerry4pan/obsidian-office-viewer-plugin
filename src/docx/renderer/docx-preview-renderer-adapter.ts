import { renderAsync } from "docx-preview";
import { DocxOpenError } from "../docx-open-error";
import type { DocxSemanticModel } from "../docx-semantic-model";
import { DocxLayoutViewport } from "./docx-layout-viewport";
import {
  alignRenderedParagraphs,
  comparableParagraphText,
  mapRenderedParagraphs,
  prepareRenderedDocxReadingLayout,
  revealParagraphFragment,
  sanitizeRenderedDocx,
  type DocxRendererAdapter,
  type DocxRendererOpenOptions,
  type DocxRendererSession,
  type DocxViewMode,
} from "./docx-renderer-adapter";

const SUPPORTED_MODES: readonly DocxViewMode[] = ["reading", "layout"];

interface DocxPreviewRenderProfile {
  readonly ignoreWidth: boolean;
  readonly ignoreHeight: boolean;
  readonly breakPages: boolean;
  readonly ignoreLastRenderedPageBreak: boolean;
}

function previewRenderProfile(mode: DocxViewMode): DocxPreviewRenderProfile {
  if (mode === "layout") {
    return {
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
    };
  }
  return {
    ignoreWidth: true,
    ignoreHeight: true,
    breakPages: false,
    ignoreLastRenderedPageBreak: true,
  };
}

function revealMappedOrUniqueText(
  staging: HTMLElement,
  paragraphAnchors: ReadonlyMap<number, HTMLElement>,
  model: DocxSemanticModel,
  ordinal: number,
  textHint?: string,
): HTMLElement | null {
  const hinted = revealParagraphFragment(
    staging,
    paragraphAnchors,
    ordinal,
    textHint,
  );
  if (hinted !== null) return hinted;
  const mapped = paragraphAnchors.get(ordinal);
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
    model: DocxSemanticModel,
    options: DocxRendererOpenOptions,
  ): Promise<DocxRendererSession> {
    const { mode, signal } = options;
    signal.throwIfAborted();
    const profile = previewRenderProfile(mode);
    const staging = document.createElement("div");
    staging.className =
      mode === "layout"
        ? "office-viewer-docx office-viewer-docx--preview office-viewer-docx--layout"
        : "office-viewer-docx office-viewer-docx--preview office-viewer-docx--reading";
    try {
      await renderAsync(buffer.slice(0), staging, staging, {
        inWrapper: true,
        hideWrapperOnPrint: false,
        ignoreWidth: profile.ignoreWidth,
        ignoreHeight: profile.ignoreHeight,
        ignoreFonts: false,
        breakPages: profile.breakPages,
        debug: false,
        experimental: false,
        className: "docx",
        trimXmlDeclaration: true,
        renderHeaders: false,
        renderFooters: false,
        renderFootnotes: false,
        renderEndnotes: false,
        ignoreLastRenderedPageBreak: profile.ignoreLastRenderedPageBreak,
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
    if (mode === "reading") {
      prepareRenderedDocxReadingLayout(staging);
    }
    const warnings: string[] = [];
    let paragraphAnchors: ReadonlyMap<number, HTMLElement>;
    try {
      paragraphAnchors = mapRenderedParagraphs(staging, model.paragraphs);
    } catch {
      // Keep the readable preview: bind only order-preserving exact-character
      // matches instead of failing the whole document open.
      paragraphAnchors = alignRenderedParagraphs(staging, model.paragraphs);
      if (paragraphAnchors.size < model.paragraphs.length) {
        warnings.push("preview-paragraph-mapping-degraded");
      }
      if (paragraphAnchors.size === 0 && model.paragraphs.length > 0) {
        throw new DocxOpenError(
          "incompatible",
          "docx-preview output does not map to the project-owned paragraph model",
        );
      }
    }
    signal.throwIfAborted();

    let mountedContainer: HTMLElement | null = null;
    let layoutViewport: DocxLayoutViewport | null = null;
    let disposed = false;

    const dispose = (): void => {
      if (disposed) return;
      disposed = true;
      layoutViewport?.dispose();
      layoutViewport = null;
      staging.replaceChildren();
      if (
        mountedContainer !== null &&
        staging.parentElement === mountedContainer
      ) {
        mountedContainer.replaceChildren();
      }
      mountedContainer = null;
    };

    return {
      candidate: "docx-preview",
      mode,
      supportedModes: SUPPORTED_MODES,
      paragraphAnchors,
      warnings,
      mount: (container) => {
        if (disposed) return;
        if (mountedContainer !== null) {
          throw new Error("DOCX renderer session is already mounted");
        }
        mountedContainer = container;
        container.replaceChildren(staging);
        if (mode === "layout") {
          layoutViewport = new DocxLayoutViewport({
            container,
            pagesRoot: staging,
          });
          layoutViewport.start();
        }
      },
      revealParagraph: (ordinal, textHint) => {
        if (mountedContainer === null || disposed) return null;
        return revealMappedOrUniqueText(
          staging,
          paragraphAnchors,
          model,
          ordinal,
          textHint,
        );
      },
      dispose,
    };
  }
}
