import {
  PptxViewer,
  RECOMMENDED_ZIP_LIMITS,
} from "@aiden0z/pptx-renderer";
import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "./pptx-renderer-adapter";

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
    const viewer = await PptxViewer.open(buffer, container, {
      fitMode: "contain",
      lazyMedia: true,
      lazySlides: true,
      pdfjs: false,
      renderMode: "slide",
      signal,
      zipLimits: RECOMMENDED_ZIP_LIMITS,
    });
    signal.throwIfAborted();
    return new AidenPptxRendererSession(viewer, container);
  }
}
