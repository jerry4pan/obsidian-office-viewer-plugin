export interface PptxRendererCapabilities {
  readonly thumbnails: boolean;
  readonly prefetch: boolean;
  readonly zoom: boolean;
}

export interface PptxRendererResource {
  readonly ready: Promise<void>;
  dispose(): void;
}

export interface PptxRendererSession {
  readonly slideCount: number;
  readonly slideWidth: number;
  readonly slideHeight: number;
  readonly capabilities: PptxRendererCapabilities;
  /** On rejection, the last successfully rendered slide remains visible. */
  renderSlide(index: number): Promise<void>;
  renderThumbnail?(
    index: number,
    container: HTMLElement,
    signal: AbortSignal,
  ): PptxRendererResource;
  prefetchSlide?(index: number, signal: AbortSignal): Promise<void>;
  setZoomPercent?(percent: number): Promise<void>;
  dispose(): void;
}

export interface PptxRendererAdapter {
  open(
    buffer: ArrayBuffer,
    container: HTMLElement,
    signal: AbortSignal,
  ): Promise<PptxRendererSession>;
}
