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
    delete this.root.dataset.errorCategory;
    let phase: "read" | "renderer" = "read";

    try {
      const buffer = await this.reader.readBinary(file);
      controller.signal.throwIfAborted();
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
      await rendererSession.renderSlide(0);
      controller.signal.throwIfAborted();

      pageCounter.textContent = `1 / ${rendererSession.slideCount}`;
      status.textContent = "";
      this.root.dataset.state = "ready";
      if (this.abortController === controller) this.abortController = null;
    } catch (error) {
      if (controller.signal.aborted || generation !== this.generation) return;
      this.rendererSession?.dispose();
      this.rendererSession = null;
      if (this.abortController === controller) this.abortController = null;
      const openError =
        error instanceof PptxOpenError
          ? error
          : new PptxOpenError(
              phase === "renderer" ? "incompatible" : "unknown",
              "Unexpected PPTX open failure",
              { cause: error },
            );
      this.showError(file, openError, generation);
    }
  }

  dispose(): void {
    this.generation += 1;
    this.stopCurrentRun();
    this.root.replaceChildren();
    delete this.root.dataset.state;
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
}
