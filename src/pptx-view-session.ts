import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "./renderer/pptx-renderer-adapter";

export interface VaultBinaryReader<FileRef> {
  readBinary(file: FileRef): Promise<ArrayBuffer>;
}

export interface PptxViewSessionDiagnostics {
  readonly generation: number;
  readonly openPending: boolean;
  readonly rendererActive: boolean;
  readonly disposed: boolean;
}

export class PptxViewSession<FileRef> {
  private abortController: AbortController | null = null;
  private rendererSession: PptxRendererSession | null = null;
  private generation = 0;
  private openPending = false;
  private disposed = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly reader: VaultBinaryReader<FileRef>,
    private readonly renderer: PptxRendererAdapter,
  ) {
    root.classList.add("pptx-viewer");
  }

  async open(file: FileRef): Promise<void> {
    this.stopCurrentRun();
    this.clearTimings();
    const generation = ++this.generation;
    this.openPending = true;
    this.disposed = false;
    const controller = new AbortController();
    this.abortController = controller;

    const status = document.createElement("div");
    status.className = "pptx-viewer__status";
    status.textContent = "Loading presentation…";
    const pageCounter = document.createElement("div");
    pageCounter.className = "pptx-viewer__page-counter";
    const previousButton = document.createElement("button");
    previousButton.type = "button";
    previousButton.dataset.action = "previous-slide";
    previousButton.textContent = "Previous";
    previousButton.disabled = true;
    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.dataset.action = "next-slide";
    nextButton.textContent = "Next";
    nextButton.disabled = true;
    const controls = document.createElement("div");
    controls.className = "pptx-viewer__controls";
    controls.append(previousButton, pageCounter, nextButton);
    const slideContainer = document.createElement("div");
    slideContainer.className = "pptx-viewer__slide";
    this.root.replaceChildren(status, controls, slideContainer);
    this.root.dataset.state = "loading";

    try {
      const openedAt = performance.now();
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
      this.root.dataset.metadataMs = (performance.now() - openedAt).toFixed(3);
      await rendererSession.renderSlide(0);
      controller.signal.throwIfAborted();
      if (generation !== this.generation) return;

      this.root.dataset.firstReadableMs = (
        performance.now() - openedAt
      ).toFixed(3);

      let currentSlideIndex = 0;
      const isCurrentRun = () =>
        generation === this.generation &&
        !controller.signal.aborted &&
        this.rendererSession === rendererSession;
      const restoreButtonState = () => {
        previousButton.disabled = currentSlideIndex === 0;
        nextButton.disabled =
          currentSlideIndex >= rendererSession.slideCount - 1;
      };
      const navigate = async (targetIndex: number) => {
        if (
          targetIndex < 0 ||
          targetIndex >= rendererSession.slideCount ||
          !isCurrentRun()
        ) {
          return;
        }

        previousButton.disabled = true;
        nextButton.disabled = true;
        const switchedAt = performance.now();
        try {
          await rendererSession.renderSlide(targetIndex);
          const slideSwitchMs = (performance.now() - switchedAt).toFixed(3);
          if (!isCurrentRun()) return;
          currentSlideIndex = targetIndex;
          pageCounter.textContent = `${currentSlideIndex + 1} / ${rendererSession.slideCount}`;
          this.root.dataset.lastSlideSwitchMs = slideSwitchMs;
          this.root.dataset.state = "ready";
          status.textContent = "";
        } catch {
          if (!isCurrentRun()) return;
          this.root.dataset.state = "error";
          status.textContent = "Unable to render this slide.";
        } finally {
          if (isCurrentRun()) restoreButtonState();
        }
      };

      previousButton.addEventListener("click", () => {
        void navigate(currentSlideIndex - 1);
      });
      nextButton.addEventListener("click", () => {
        void navigate(currentSlideIndex + 1);
      });

      pageCounter.textContent = `1 / ${rendererSession.slideCount}`;
      restoreButtonState();
      status.textContent = "";
      this.root.dataset.state = "ready";
    } catch (error) {
      if (controller.signal.aborted || generation !== this.generation) return;
      this.root.dataset.state = "error";
      status.textContent = "Unable to open this PPTX file.";
      slideContainer.replaceChildren();
      throw error;
    } finally {
      if (generation === this.generation) this.openPending = false;
    }
  }

  getPerformanceDiagnostics(): PptxViewSessionDiagnostics {
    return {
      generation: this.generation,
      openPending: this.openPending,
      rendererActive: this.rendererSession !== null,
      disposed: this.disposed,
    };
  }

  dispose(): void {
    this.generation += 1;
    this.openPending = false;
    this.disposed = true;
    this.stopCurrentRun();
    this.root.replaceChildren();
    delete this.root.dataset.state;
    this.clearTimings();
  }

  private stopCurrentRun(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.rendererSession?.dispose();
    this.rendererSession = null;
  }

  private clearTimings(): void {
    delete this.root.dataset.metadataMs;
    delete this.root.dataset.firstReadableMs;
    delete this.root.dataset.lastSlideSwitchMs;
  }
}
