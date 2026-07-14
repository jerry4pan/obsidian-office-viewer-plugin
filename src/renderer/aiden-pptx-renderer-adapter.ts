import {
  PptxViewer,
} from "@aiden0z/pptx-renderer";
import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "./pptx-renderer-adapter";
import { PptxOpenError } from "../pptx-open-error";
import { PPTX_ZIP_LIMITS } from "./pptx-package-preflight";

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
    await this.viewer.renderSlide(index);
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
      viewer = await PptxViewer.open(buffer, container, {
        fitMode: "contain",
        lazyMedia: true,
        lazySlides: true,
        pdfjs: false,
        renderMode: "slide",
        signal,
        zipLimits: PPTX_ZIP_LIMITS,
      });
      signal.throwIfAborted();
      if (viewer.slideCount < 1) {
        throw new PptxOpenError(
          "incompatible",
          "The renderer did not find a usable slide",
        );
      }
      return new AidenPptxRendererSession(viewer, container);
    } catch (error) {
      viewer?.destroy();
      container.replaceChildren();
      if (error instanceof PptxOpenError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new PptxOpenError(
        "incompatible",
        "The renderer could not safely display this PPTX package",
        { cause: error },
      );
    }
  }
}
