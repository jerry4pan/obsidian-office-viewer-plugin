import { init } from "pptx-preview";
import { PptxOpenError } from "../pptx-open-error";
import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "./pptx-renderer-adapter";
import { captureRenderedSlide } from "./rendered-slide-backup";

interface PptxPreviewerOptions {
  readonly width: number;
  readonly height: number;
  readonly mode: "slide";
}

interface PptxPreviewer {
  readonly slideCount: number;
  load(buffer: ArrayBuffer): Promise<unknown>;
  renderSingleSlide(index: number): void;
  destroy(): void;
}

export type PptxPreviewerFactory = (
  container: HTMLElement,
  options: PptxPreviewerOptions,
) => PptxPreviewer;

const createPptxPreviewer: PptxPreviewerFactory = (container, options) =>
  init(container, options);

function resolveViewport(container: HTMLElement): PptxPreviewerOptions {
  const measuredWidth = Math.floor(container.clientWidth);
  const measuredHeight = Math.floor(container.clientHeight);
  const width = measuredWidth > 0 ? measuredWidth : 960;
  const availableHeight = measuredHeight > 0 ? measuredHeight : 540;
  return {
    width,
    height: Math.min(availableHeight, Math.round(width * 0.75)),
    mode: "slide",
  };
}

class PptxPreviewRendererSession implements PptxRendererSession {
  private disposed = false;
  private currentSlideIndex: number | null = null;

  constructor(
    private readonly previewer: PptxPreviewer,
    private readonly container: HTMLElement,
  ) {}

  get slideCount(): number {
    return this.previewer.slideCount;
  }

  async renderSlide(index: number): Promise<void> {
    if (this.disposed) {
      throw new Error("PPTX renderer session has been disposed");
    }
    const previousIndex = this.currentSlideIndex;
    const backup = captureRenderedSlide(this.container);
    try {
      this.previewer.renderSingleSlide(index);
    } catch {
      if (previousIndex !== null) {
        try {
          this.previewer.renderSingleSlide(previousIndex);
        } catch {
          backup.restore();
        }
      } else {
        backup.restore();
      }
      throw new Error(`The renderer could not display slide ${index + 1}`);
    }
    this.currentSlideIndex = index;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.previewer.destroy();
    this.container.replaceChildren();
  }
}

export class PptxPreviewRendererAdapter implements PptxRendererAdapter {
  constructor(
    private readonly previewerFactory: PptxPreviewerFactory =
      createPptxPreviewer,
  ) {}

  async open(
    buffer: ArrayBuffer,
    container: HTMLElement,
    signal: AbortSignal,
  ): Promise<PptxRendererSession> {
    signal.throwIfAborted();
    container.replaceChildren();
    let previewer: PptxPreviewer | undefined;
    try {
      previewer = this.previewerFactory(container, resolveViewport(container));
      await previewer.load(buffer);
      signal.throwIfAborted();
      if (!Number.isInteger(previewer.slideCount) || previewer.slideCount < 1) {
        throw new PptxOpenError(
          "incompatible",
          "The renderer did not find a usable slide",
        );
      }
      return new PptxPreviewRendererSession(previewer, container);
    } catch (error) {
      previewer?.destroy();
      container.replaceChildren();
      if (error instanceof PptxOpenError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new PptxOpenError(
        "incompatible",
        "The renderer could not safely display this PPTX package",
        { cause: error },
      );
    }
  }
}
