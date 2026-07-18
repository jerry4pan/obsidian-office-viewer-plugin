export interface PptxRendererCapabilities {
  readonly thumbnails: boolean;
  readonly prefetch: boolean;
}

export type PptxCompatibilityWarningCategory =
  | "unsupported-content"
  | "font-substitution";

export interface PptxSourceAuthoredSlideText {
  readonly slideId: number;
  readonly text: readonly string[];
}

/** Author speaker-note paragraphs for one stable slide identity. */
export interface PptxSpeakerNoteContent {
  readonly slideId: number;
  readonly paragraphs: readonly string[];
}

export interface PptxRendererResource {
  readonly ready: Promise<void>;
  dispose(): void;
}

export interface PptxRendererSession {
  readonly slideCount: number;
  /** Supplied by the project-owned preflight adapter in renderer order. */
  readonly slideIdentities?: readonly number[];
  /** Source-authored slide text supplied by the project-owned preflight adapter. */
  readonly sourceAuthoredSlideText?: readonly PptxSourceAuthoredSlideText[];
  /**
   * Optional speaker-note content supplied by the project-owned preflight
   * adapter. Absent when note extraction failed for the package; present with
   * empty paragraphs when a slide has no author notes.
   */
  readonly speakerNoteContent?: readonly PptxSpeakerNoteContent[];
  readonly slideWidth: number;
  readonly slideHeight: number;
  readonly capabilities: PptxRendererCapabilities;
  readonly compatibilityWarnings?: readonly PptxCompatibilityWarningCategory[];
  detectCompatibilityWarnings?(): readonly PptxCompatibilityWarningCategory[];
  /** On rejection, the last successfully rendered slide remains visible. */
  renderSlide(index: number): Promise<void>;
  renderThumbnail?(
    index: number,
    container: HTMLElement,
    signal: AbortSignal,
    width?: number,
  ): PptxRendererResource;
  prefetchSlide?(index: number, signal: AbortSignal): Promise<void>;
  dispose(): void;
}

export interface PptxRendererAdapter {
  open(
    buffer: ArrayBuffer,
    container: HTMLElement,
    signal: AbortSignal,
  ): Promise<PptxRendererSession>;
}
