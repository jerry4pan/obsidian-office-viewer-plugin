import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "./renderer/pptx-renderer-adapter";
import {
  PptxOpenError,
  type PptxOpenErrorCategory,
} from "./pptx-open-error";

export interface VaultBinaryReader<FileRef> {
  readBinary(file: FileRef): Promise<ArrayBuffer>;
}

export interface PptxViewSessionDiagnostics {
  readonly generation: number;
  readonly openPending: boolean;
  readonly rendererActive: boolean;
  readonly disposed: boolean;
  readonly lifecyclePhase: PptxLifecyclePhase;
}

export type PptxLifecyclePhase =
  | "idle"
  | "reading"
  | "adapter-opening"
  | "first-slide-rendering"
  | "ready"
  | "error"
  | "disposed";

export interface PptxViewActions<FileRef> {
  openExternally?: (file: FileRef) => Promise<void>;
}

const errorMessages: Record<PptxOpenErrorCategory, string> = {
  malformed: "This PPTX is damaged or incomplete.",
  protected: "This PPTX is encrypted or password-protected.",
  incompatible: "This PPTX uses content this viewer cannot safely display.",
  unknown: "An unexpected error prevented this PPTX from opening.",
};

export class PptxViewSession<FileRef> {
  private abortController: AbortController | null = null;
  private rendererSession: PptxRendererSession | null = null;
  private generation = 0;
  private openPending = false;
  private disposed = false;
  private lifecyclePhase: PptxLifecyclePhase = "idle";

  constructor(
    private readonly root: HTMLElement,
    private readonly reader: VaultBinaryReader<FileRef>,
    private readonly renderer: PptxRendererAdapter,
    private readonly actions: PptxViewActions<FileRef> = {},
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
    this.setLifecyclePhase("reading");
    delete this.root.dataset.errorCategory;
    let phase: "read" | "renderer" = "read";

    try {
      const openedAt = performance.now();
      const buffer = await this.reader.readBinary(file);
      controller.signal.throwIfAborted();
      this.setLifecyclePhase("adapter-opening");
      phase = "renderer";
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
      this.setLifecyclePhase("first-slide-rendering");
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
      this.setLifecyclePhase("ready");
      if (this.abortController === controller) this.abortController = null;
    } catch (error) {
      if (controller.signal.aborted || generation !== this.generation) return;
      this.rendererSession?.dispose();
      this.rendererSession = null;
      if (this.abortController === controller) this.abortController = null;
      this.setLifecyclePhase("error");
      const openError =
        error instanceof PptxOpenError
          ? error
          : new PptxOpenError(
              phase === "renderer" ? "incompatible" : "unknown",
              "Unexpected PPTX open failure",
              { cause: error },
            );
      this.showError(file, openError, generation);
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
      lifecyclePhase: this.lifecyclePhase,
    };
  }

  dispose(): void {
    this.generation += 1;
    this.openPending = false;
    this.disposed = true;
    this.lifecyclePhase = "disposed";
    this.stopCurrentRun();
    this.root.replaceChildren();
    delete this.root.dataset.state;
    delete this.root.dataset.lifecyclePhase;
    this.clearTimings();
    delete this.root.dataset.errorCategory;
  }

  private showError(
    file: FileRef,
    error: PptxOpenError,
    generation: number,
  ): void {
    const panel = document.createElement("div");
    panel.className = "pptx-viewer__error";
    const title = document.createElement("div");
    title.className = "pptx-viewer__status";
    title.textContent = errorMessages[error.category];
    const safety = document.createElement("p");
    safety.className = "pptx-viewer__safety-note";
    safety.textContent = "The original PPTX file was not modified.";
    const actions = document.createElement("div");
    actions.className = "pptx-viewer__actions";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.dataset.action = "retry";
    retry.textContent = "Retry";
    retry.addEventListener("click", () => void this.open(file));
    actions.append(retry);

    const actionStatus = document.createElement("div");
    actionStatus.className = "pptx-viewer__action-status";
    if (this.actions.openExternally) {
      const openExternally = document.createElement("button");
      openExternally.type = "button";
      openExternally.dataset.action = "open-externally";
      openExternally.textContent = "Open in default application";
      openExternally.addEventListener("click", () => {
        void this.actions.openExternally?.(file).catch(() => {
          if (generation === this.generation) {
            actionStatus.textContent = "Unable to open the default application.";
          }
        });
      });
      actions.append(openExternally);
    }

    panel.append(title, safety, actions, actionStatus);
    this.root.replaceChildren(panel);
    this.root.dataset.state = "error";
    this.root.dataset.errorCategory = error.category;
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

  private setLifecyclePhase(phase: PptxLifecyclePhase): void {
    this.lifecyclePhase = phase;
    this.root.dataset.lifecyclePhase = phase;
  }
}
