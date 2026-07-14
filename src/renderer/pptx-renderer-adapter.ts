export interface PptxRendererSession {
  readonly slideCount: number;
  /** On rejection, the last successfully rendered slide remains visible. */
  renderSlide(index: number): Promise<void>;
  dispose(): void;
}

export interface PptxRendererAdapter {
  open(
    buffer: ArrayBuffer,
    container: HTMLElement,
    signal: AbortSignal,
  ): Promise<PptxRendererSession>;
}
