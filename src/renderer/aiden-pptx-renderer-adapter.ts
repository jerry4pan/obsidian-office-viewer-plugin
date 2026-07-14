import {
  PptxViewer,
} from "@aiden0z/pptx-renderer";
import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "./pptx-renderer-adapter";
import { PptxOpenError } from "../pptx-open-error";
import { PPTX_ZIP_LIMITS } from "./pptx-package-preflight";

async function rejectReportedSlideError(
  viewer: PptxViewer,
  slideIndex: number,
  action: () => Promise<void>,
  createError: () => Error,
): Promise<void> {
  let slideErrorReported = false;
  const onSlideError = (event: Event) => {
    const detail = (event as CustomEvent<{ index?: unknown }>).detail;
    if (detail?.index === slideIndex) slideErrorReported = true;
  };
  viewer.addEventListener("slideerror", onSlideError);
  try {
    await action();
  } finally {
    viewer.removeEventListener("slideerror", onSlideError);
  }
  if (slideErrorReported) throw createError();
}

class AidenPptxRendererSession implements PptxRendererSession {
  private disposed = false;

  constructor(
    private readonly viewer: PptxViewer,
    private readonly container: HTMLElement,
  ) {}

  get slideCount(): number {
    return this.viewer.slideCount;
  }

  async renderSlide(index: number): Promise<void> {
    if (this.disposed) {
      throw new Error("PPTX renderer session has been disposed");
    }
    await rejectReportedSlideError(
      this.viewer,
      index,
      () => this.viewer.renderSlide(index),
      () => new Error(`The renderer could not display slide ${index + 1}`),
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.viewer.destroy();
    this.container.replaceChildren();
  }
}

export class AidenPptxRendererAdapter implements PptxRendererAdapter {
  async open(
    buffer: ArrayBuffer,
    container: HTMLElement,
    signal: AbortSignal,
  ): Promise<PptxRendererSession> {
    signal.throwIfAborted();
    container.replaceChildren();
    let viewer: PptxViewer | undefined;
    try {
      const allocatedViewer = new PptxViewer(container, {
        fitMode: "contain",
        lazyMedia: true,
        lazySlides: true,
        pdfjs: false,
        zipLimits: PPTX_ZIP_LIMITS,
      });
      viewer = allocatedViewer;
      await rejectReportedSlideError(
        allocatedViewer,
        0,
        () =>
          allocatedViewer.open(buffer, {
            renderMode: "slide",
            signal,
            lazyMedia: true,
            lazySlides: true,
          }),
        () =>
          new PptxOpenError(
            "incompatible",
            "The renderer could not display the first slide",
          ),
      );
      signal.throwIfAborted();
      if (allocatedViewer.slideCount < 1) {
        throw new PptxOpenError(
          "incompatible",
          "The renderer did not find a usable slide",
        );
      }
      return new AidenPptxRendererSession(allocatedViewer, container);
    } catch (error) {
      viewer?.destroy();
      container.replaceChildren();
      if (error instanceof PptxOpenError) throw error;
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) throw error;
      throw new PptxOpenError(
        "incompatible",
        "The renderer could not safely display this PPTX package",
        { cause: error },
      );
    }
  }
}
