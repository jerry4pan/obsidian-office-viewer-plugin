import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "./renderer/pptx-renderer-adapter";

export interface VaultBinaryReader<FileRef> {
  readBinary(file: FileRef): Promise<ArrayBuffer>;
}

export class PptxViewSession<FileRef> {
  private abortController: AbortController | null = null;
  private rendererSession: PptxRendererSession | null = null;
  private generation = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly reader: VaultBinaryReader<FileRef>,
    private readonly renderer: PptxRendererAdapter,
  ) {
    root.classList.add("pptx-viewer");
  }

  async open(file: FileRef): Promise<void> {
    this.stopCurrentRun();
    const generation = ++this.generation;
    const controller = new AbortController();
    this.abortController = controller;

    const status = document.createElement("div");
    status.className = "pptx-viewer__status";
    status.textContent = "Loading presentation…";
    const pageCounter = document.createElement("div");
    pageCounter.className = "pptx-viewer__page-counter";
    const slideContainer = document.createElement("div");
    slideContainer.className = "pptx-viewer__slide";
    this.root.replaceChildren(status, pageCounter, slideContainer);
    this.root.dataset.state = "loading";

    try {
      const buffer = await this.reader.readBinary(file);
      controller.signal.throwIfAborted();
      const rendererSession = await this.renderer.open(
        buffer,
        slideContainer,
        controller.signal,
      );
      if (generation !== this.generation || controller.signal.aborted) {
        rendererSession.dispose();
        return;
      }
      this.rendererSession = rendererSession;
      await rendererSession.renderSlide(0);
      controller.signal.throwIfAborted();

      pageCounter.textContent = `1 / ${rendererSession.slideCount}`;
      status.textContent = "";
      this.root.dataset.state = "ready";
    } catch (error) {
      if (controller.signal.aborted || generation !== this.generation) return;
      this.root.dataset.state = "error";
      status.textContent = "Unable to open this PPTX file.";
      slideContainer.replaceChildren();
      throw error;
    }
  }

  dispose(): void {
    this.generation += 1;
    this.stopCurrentRun();
    this.root.replaceChildren();
    delete this.root.dataset.state;
  }

  private stopCurrentRun(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.rendererSession?.dispose();
    this.rendererSession = null;
  }
}
