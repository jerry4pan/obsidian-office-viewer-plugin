import {
  buildPresentation,
  parseZipLazyMedia,
  PptxViewer,
} from "@aiden0z/pptx-renderer";
import type { SlideHandle } from "@aiden0z/pptx-renderer";
import type {
  PptxRendererAdapter,
  PptxRendererResource,
  PptxRendererSession,
} from "./pptx-renderer-adapter";
import { PptxOpenError } from "../pptx-open-error";
import { PPTX_ZIP_LIMITS } from "./pptx-package-preflight";
import { renderSlideAtomically } from "./rendered-slide-backup";

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
  private currentSlideIndex: number | null = null;
  private readonly resources = new Set<PptxRendererResource>();

  constructor(
    private readonly viewer: PptxViewer,
    private readonly container: HTMLElement,
  ) {}

  get slideCount(): number {
    return this.viewer.slideCount;
  }

  get slideWidth(): number {
    return this.viewer.slideWidth;
  }

  get slideHeight(): number {
    return this.viewer.slideHeight;
  }

  readonly capabilities = {
    thumbnails: true,
    prefetch: true,
  } as const;

  private throwIfDisposed(): void {
    if (this.disposed) {
      throw new Error("PPTX renderer session has been disposed");
    }
  }

  private ownResource(
    handle: SlideHandle,
    signal: AbortSignal,
  ): PptxRendererResource {
    if (signal.aborted) {
      handle.dispose();
      signal.throwIfAborted();
    }

    let resource: PptxRendererResource;
    const onAbort = () => resource.dispose();
    resource = {
      ready: handle.ready.then(() => signal.throwIfAborted()),
      dispose: () => {
        if (!this.resources.delete(resource)) return;
        signal.removeEventListener("abort", onAbort);
        handle.dispose();
      },
    };
    this.resources.add(resource);
    signal.addEventListener("abort", onAbort, { once: true });
    return resource;
  }

  async renderSlide(index: number): Promise<void> {
    const previousIndex = this.currentSlideIndex;
    await renderSlideAtomically({
      container: this.container,
      targetIndex: index,
      previousIndex,
      render: (slideIndex) =>
        rejectReportedSlideError(
          this.viewer,
          slideIndex,
          () => this.viewer.renderSlide(slideIndex),
          () =>
            new Error(
              `The renderer could not display slide ${slideIndex + 1}`,
            ),
        ),
      assertActive: () => this.throwIfDisposed(),
    });
    this.currentSlideIndex = index;
  }

  renderThumbnail(
    index: number,
    container: HTMLElement,
    signal: AbortSignal,
    width = 144,
  ): PptxRendererResource {
    this.throwIfDisposed();
    signal.throwIfAborted();
    const handle = this.viewer.renderThumbnailToContainer(index, container, {
      width,
    });
    if (!handle) {
      throw new Error(`The renderer could not prepare slide ${index + 1}`);
    }
    return this.ownResource(handle, signal);
  }

  async prefetchSlide(index: number, signal: AbortSignal): Promise<void> {
    this.throwIfDisposed();
    signal.throwIfAborted();
    const container = createDiv();
    const handle = this.viewer.renderSlideToContainer(index, container);
    if (!handle) {
      throw new Error(`The renderer could not prepare slide ${index + 1}`);
    }
    const resource = this.ownResource(handle, signal);
    try {
      await resource.ready;
    } finally {
      resource.dispose();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const resource of [...this.resources]) resource.dispose();
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
      const files = await parseZipLazyMedia(buffer, PPTX_ZIP_LIMITS);
      signal.throwIfAborted();
      const presentation = buildPresentation(files, { lazySlides: true });
      signal.throwIfAborted();
      const allocatedViewer = new PptxViewer(container, {
        fitMode: "contain",
        lazyMedia: true,
        lazySlides: true,
        pdfjs: false,
        zipLimits: PPTX_ZIP_LIMITS,
      });
      viewer = allocatedViewer;
      allocatedViewer.load(presentation);
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
