import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "./renderer/pptx-renderer-adapter";
import {
  PptxOpenError,
  type PptxOpenErrorCategory,
} from "./pptx-open-error";
import {
  PptxViewerController,
  type PptxZoomMode,
} from "./pptx-viewer-controller";
import { RenderTaskQueue } from "./render-task-queue";
import { ThumbnailRail } from "./thumbnail-rail";

export interface VaultBinaryReader<FileRef> {
  readBinary(file: FileRef): Promise<ArrayBuffer>;
}

export interface PptxViewSessionDiagnostics {
  readonly generation: number;
  readonly openPending: boolean;
  readonly rendererActive: boolean;
  readonly disposed: boolean;
  readonly lifecyclePhase: PptxLifecyclePhase;
  readonly backgroundPending: number;
  readonly backgroundRunning: number;
  readonly mountedThumbnails: number;
  readonly zoomMode: PptxZoomMode;
  readonly zoomPercent: number;
}

export type PptxLifecyclePhase =
  | "idle"
  | "reading"
  | "adapter-opening"
  | "first-slide-rendering"
  | "ready"
  | "degraded"
  | "error"
  | "disposed";

export interface PptxViewActions<FileRef> {
  openExternally?: (file: FileRef) => Promise<void>;
  positions?: {
    initialSlideFor(file: FileRef, slideCount: number): number;
    record(file: FileRef, slideIndex: number): void;
  };
  fullscreen?: PptxFullscreenActions;
}

export interface PptxFullscreenActions {
  isActive(root: HTMLElement): boolean;
  enter(root: HTMLElement): Promise<void>;
  exit(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

function createDefaultFullscreenActions(): PptxFullscreenActions {
  return {
    isActive: (root) => document.fullscreenElement === root,
    enter: async (root) => root.requestFullscreen(),
    exit: async () => document.exitFullscreen(),
    subscribe: (listener) => {
      document.addEventListener("fullscreenchange", listener);
      return () => document.removeEventListener("fullscreenchange", listener);
    },
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "BUTTON", "SELECT", "TEXTAREA"].includes(target.tagName));
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
  private viewerController: PptxViewerController | null = null;
  private backgroundQueue: RenderTaskQueue | null = null;
  private thumbnailRail: ThumbnailRail | null = null;
  private readonly runCleanups = new Set<() => void>();
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
    const empty = document.createElement("div");
    empty.className = "pptx-viewer__empty";
    empty.textContent = "Open a PPTX file from your Vault to start reading.";
    root.replaceChildren(empty);
    root.dataset.state = "empty";
    this.setLifecyclePhase("idle");
  }

  async open(file: FileRef): Promise<void> {
    this.teardownOpenResources();
    this.clearTimings();
    const generation = ++this.generation;
    this.openPending = true;
    this.disposed = false;
    const controller = new AbortController();
    this.abortController = controller;

    const status = document.createElement("div");
    status.className = "pptx-viewer__status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "Loading presentation…";
    this.root.tabIndex = 0;
    this.root.dataset.thumbnailsCollapsed = "false";
    this.root.dataset.zoomMode = "fit";
    this.root.dataset.zoomPercent = "100";
    this.root.dataset.fullscreen = "false";
    this.root.dataset.mountedThumbnailCount = "0";
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
    const pageInput = document.createElement("input");
    pageInput.type = "number";
    pageInput.min = "1";
    pageInput.step = "1";
    pageInput.value = "1";
    pageInput.disabled = true;
    pageInput.dataset.action = "page-number";
    pageInput.setAttribute("aria-label", "Slide number");
    const pageTotal = document.createElement("span");
    pageTotal.className = "pptx-viewer__page-total";
    pageTotal.textContent = "of …";
    const jumpButton = document.createElement("button");
    jumpButton.type = "button";
    jumpButton.disabled = true;
    jumpButton.dataset.action = "jump-to-slide";
    jumpButton.textContent = "Go";
    const jumpForm = document.createElement("form");
    jumpForm.className = "pptx-viewer__page-jump";
    const jumpLabel = document.createElement("span");
    jumpLabel.textContent = "Slide";
    jumpForm.append(jumpLabel, pageInput, pageTotal, jumpButton);
    const controls = document.createElement("div");
    controls.className = "pptx-viewer__controls";
    const toggleThumbnails = document.createElement("button");
    toggleThumbnails.type = "button";
    toggleThumbnails.dataset.action = "toggle-thumbnails";
    toggleThumbnails.textContent = "Thumbnails";
    toggleThumbnails.setAttribute("aria-label", "Toggle slide thumbnails");
    toggleThumbnails.setAttribute("aria-expanded", "true");
    const zoomOut = document.createElement("button");
    zoomOut.type = "button";
    zoomOut.dataset.action = "zoom-out";
    zoomOut.textContent = "−";
    zoomOut.setAttribute("aria-label", "Zoom out");
    const zoomLabel = document.createElement("span");
    zoomLabel.className = "pptx-viewer__zoom-label";
    zoomLabel.setAttribute("aria-live", "polite");
    zoomLabel.textContent = "100%";
    const zoomIn = document.createElement("button");
    zoomIn.type = "button";
    zoomIn.dataset.action = "zoom-in";
    zoomIn.textContent = "+";
    zoomIn.setAttribute("aria-label", "Zoom in");
    const fitSlide = document.createElement("button");
    fitSlide.type = "button";
    fitSlide.dataset.action = "fit-slide";
    fitSlide.textContent = "Fit";
    fitSlide.setAttribute("aria-label", "Fit slide");
    const toggleFullscreen = document.createElement("button");
    toggleFullscreen.type = "button";
    toggleFullscreen.dataset.action = "toggle-fullscreen";
    toggleFullscreen.textContent = "Full screen";
    toggleFullscreen.setAttribute("aria-label", "Enter full screen");
    controls.append(
      previousButton,
      pageCounter,
      nextButton,
      jumpForm,
      zoomOut,
      zoomLabel,
      zoomIn,
      fitSlide,
      toggleFullscreen,
      toggleThumbnails,
    );
    const actionStatus = document.createElement("div");
    actionStatus.className = "pptx-viewer__action-status";
    actionStatus.setAttribute("role", "status");
    actionStatus.setAttribute("aria-live", "polite");
    const openExternally = this.createExternalOpenButton(
      file,
      generation,
      actionStatus,
    );
    if (openExternally) controls.append(openExternally);
    const slideContainer = document.createElement("div");
    slideContainer.className = "pptx-viewer__slide";
    const thumbnailRoot = document.createElement("div");
    const readingBody = document.createElement("div");
    readingBody.className = "pptx-viewer__reading-body";
    readingBody.append(thumbnailRoot, slideContainer);
    this.root.replaceChildren(status, controls, actionStatus, readingBody);
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
      const isCurrentRun = () =>
        generation === this.generation &&
        !controller.signal.aborted &&
        this.rendererSession === rendererSession;
      const queue = new RenderTaskQueue();
      this.backgroundQueue = queue;
      let initialCommitPending = true;
      let initialRenderFailed = false;
      let navigationStartedAt: number | undefined;
      let rail: ThumbnailRail | null = null;
      let viewController!: PptxViewerController;
      const restoreControlState = () => {
        const currentSlideIndex = viewController.state.currentSlideIndex;
        previousButton.disabled = currentSlideIndex === 0;
        nextButton.disabled =
          currentSlideIndex >= rendererSession.slideCount - 1;
        pageInput.disabled = false;
        jumpButton.disabled = false;
      };
      const updateMountedCount = () => {
        this.root.dataset.mountedThumbnailCount = String(rail?.mountedCount ?? 0);
      };
      const navigate = (targetIndex: number): void => {
        if (!isCurrentRun()) return;
        const current = viewController.state.currentSlideIndex;
        if (
          !Number.isInteger(targetIndex) ||
          targetIndex < 0 ||
          targetIndex >= rendererSession.slideCount ||
          targetIndex === current
        ) return;
        navigationStartedAt = performance.now();
        void viewController.navigate(targetIndex);
      };
      let initialSlideIndex = 0;
      try {
        initialSlideIndex = this.actions.positions?.initialSlideFor(
          file,
          rendererSession.slideCount,
        ) ?? 0;
      } catch {
        // Persistence is optional; private storage failures must not block reading.
      }
      viewController = new PptxViewerController(rendererSession, queue, {
        setNavigationPending: (pending) => {
          if (!isCurrentRun()) return;
          previousButton.disabled = pending;
          nextButton.disabled = pending;
          pageInput.disabled = pending;
          jumpButton.disabled = pending;
          if (!pending) restoreControlState();
        },
        commitSlide: (index) => {
          if (!isCurrentRun()) return;
          const isInitialCommit = initialCommitPending;
          if (isInitialCommit) {
            initialCommitPending = false;
            this.root.dataset.firstReadableMs = (
              performance.now() - openedAt
            ).toFixed(3);
          } else {
            const startedAt = navigationStartedAt ?? performance.now();
            this.root.dataset.lastSlideSwitchMs = (
              performance.now() - startedAt
            ).toFixed(3);
          }
          navigationStartedAt = undefined;
          pageInput.value = String(index + 1);
          pageCounter.textContent = `${index + 1} / ${rendererSession.slideCount}`;
          rail?.setCurrentSlide(index);
          updateMountedCount();
          this.root.dataset.state = "ready";
          this.setLifecyclePhase("ready");
          status.textContent = "";
          if (!isInitialCommit) {
            try {
              this.actions.positions?.record(file, index);
            } catch {
              // The readable page remains authoritative if persistence fails.
            }
          }
        },
        reportNavigationFailure: (index) => {
          if (!isCurrentRun()) return;
          if (initialCommitPending) initialRenderFailed = true;
          navigationStartedAt = undefined;
          pageInput.value = String(viewController.state.currentSlideIndex + 1);
          this.root.dataset.state = "degraded";
          this.setLifecyclePhase("degraded");
          status.textContent = `Slide ${index + 1} could not be rendered. The previous slide is still shown. Try another slide or open it in the default application.`;
        },
        commitZoom: (mode, percent) => {
          if (!isCurrentRun()) return;
          this.root.dataset.zoomMode = mode;
          this.root.dataset.zoomPercent = String(percent);
          zoomLabel.textContent = `${percent}%`;
          actionStatus.textContent = "";
        },
        reportActionFailure: (message) => {
          if (isCurrentRun()) actionStatus.textContent = message;
        },
      }, { initialSlideIndex });
      this.viewerController = viewController;
      await viewController.start();
      controller.signal.throwIfAborted();
      if (!isCurrentRun()) return;
      if (initialRenderFailed) {
        throw new PptxOpenError("incompatible", "Initial slide render failed");
      }

      rail = new ThumbnailRail(thumbnailRoot, rendererSession, queue, {
        onMountedCountChange: (count) => {
          if (isCurrentRun() && this.thumbnailRail === rail) {
            this.root.dataset.mountedThumbnailCount = String(count);
          }
        },
        onNavigate: navigate,
      });
      this.thumbnailRail = rail;
      rail.start(viewController.state.currentSlideIndex);
      updateMountedCount();

      previousButton.addEventListener("click", () => {
        navigate(viewController.state.currentSlideIndex - 1);
      });
      nextButton.addEventListener("click", () => {
        navigate(viewController.state.currentSlideIndex + 1);
      });
      const jumpToRequestedPage = () => {
        const requestedPage = Number(pageInput.value);
        if (
          !Number.isInteger(requestedPage) ||
          requestedPage < 1 ||
          requestedPage > rendererSession.slideCount
        ) {
          status.textContent = `Enter a slide number from 1 to ${rendererSession.slideCount}.`;
          pageInput.focus();
          return;
        }
        navigate(requestedPage - 1);
      };
      jumpButton.addEventListener("click", jumpToRequestedPage);
      jumpForm.addEventListener("submit", (event) => {
        event.preventDefault();
        jumpToRequestedPage();
      });

      const currentSlideIndex = viewController.state.currentSlideIndex;
      pageCounter.textContent = `${currentSlideIndex + 1} / ${rendererSession.slideCount}`;
      pageInput.value = String(currentSlideIndex + 1);
      pageInput.max = String(rendererSession.slideCount);
      pageTotal.textContent = `of ${rendererSession.slideCount}`;
      restoreControlState();
      status.textContent = "";
      this.root.dataset.state = "ready";
      this.setLifecyclePhase("ready");
      toggleThumbnails.addEventListener("click", () => {
        const collapsed = this.root.dataset.thumbnailsCollapsed !== "true";
        this.root.dataset.thumbnailsCollapsed = String(collapsed);
        toggleThumbnails.setAttribute("aria-expanded", String(!collapsed));
        if (!collapsed) rail?.refresh();
        updateMountedCount();
      });
      zoomOut.addEventListener("click", () => void viewController.zoomOut());
      zoomIn.addEventListener("click", () => void viewController.zoomIn());
      fitSlide.addEventListener("click", () => void viewController.resetToFit());

      const fullscreen = this.actions.fullscreen ?? createDefaultFullscreenActions();
      const updateFullscreenState = () => {
        if (!isCurrentRun()) return;
        const active = fullscreen.isActive(this.root);
        this.root.dataset.fullscreen = String(active);
        toggleFullscreen.textContent = active ? "Exit full screen" : "Full screen";
        toggleFullscreen.setAttribute(
          "aria-label",
          active ? "Exit full screen" : "Enter full screen",
        );
      };
      const unsubscribeFullscreen = fullscreen.subscribe(updateFullscreenState);
      this.runCleanups.add(unsubscribeFullscreen);
      updateFullscreenState();
      toggleFullscreen.addEventListener("click", () => {
        actionStatus.textContent = "";
        const operation = fullscreen.isActive(this.root)
          ? fullscreen.exit()
          : fullscreen.enter(this.root);
        void operation.then(updateFullscreenState).catch(() => {
          if (isCurrentRun()) {
            actionStatus.textContent = "Unable to change full-screen mode.";
            updateFullscreenState();
          }
        });
      });

      const onKeyDown = (event: KeyboardEvent) => {
        if (isEditableTarget(event.target) || !isCurrentRun()) return;
        const delta = event.key === "ArrowLeft" || event.key === "PageUp"
          ? -1
          : event.key === "ArrowRight" || event.key === "PageDown"
            ? 1
            : 0;
        if (delta === 0) return;
        const target = viewController.state.currentSlideIndex + delta;
        if (target < 0 || target >= rendererSession.slideCount) return;
        event.preventDefault();
        navigate(target);
      };
      this.root.addEventListener("keydown", onKeyDown);
      this.runCleanups.add(() => this.root.removeEventListener("keydown", onKeyDown));
      this.root.focus();
      if (this.abortController === controller) this.abortController = null;
    } catch (error) {
      if (controller.signal.aborted || generation !== this.generation) return;
      this.teardownOpenResources();
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
    const queue = this.backgroundQueue?.diagnostics;
    const controller = this.viewerController?.state;
    return {
      generation: this.generation,
      openPending: this.openPending,
      rendererActive: this.rendererSession !== null,
      disposed: this.disposed,
      lifecyclePhase: this.lifecyclePhase,
      backgroundPending: queue?.pending ?? 0,
      backgroundRunning: queue?.running ?? 0,
      mountedThumbnails: this.thumbnailRail?.mountedCount ?? 0,
      zoomMode: controller?.zoomMode ?? "fit",
      zoomPercent: controller?.zoomPercent ?? 100,
    };
  }

  dispose(): void {
    this.generation += 1;
    this.openPending = false;
    this.disposed = true;
    this.lifecyclePhase = "disposed";
    this.teardownOpenResources();
    this.root.replaceChildren();
    delete this.root.dataset.state;
    delete this.root.dataset.lifecyclePhase;
    this.clearTimings();
    delete this.root.dataset.errorCategory;
    delete this.root.dataset.thumbnailsCollapsed;
    delete this.root.dataset.zoomMode;
    delete this.root.dataset.zoomPercent;
    delete this.root.dataset.fullscreen;
    delete this.root.dataset.mountedThumbnailCount;
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
    const openExternally = this.createExternalOpenButton(
      file,
      generation,
      actionStatus,
    );
    if (openExternally) actions.append(openExternally);

    panel.append(title, safety, actions, actionStatus);
    this.root.replaceChildren(panel);
    this.root.dataset.state = "error";
    this.root.dataset.errorCategory = error.category;
  }

  private createExternalOpenButton(
    file: FileRef,
    generation: number,
    actionStatus: HTMLElement,
  ): HTMLButtonElement | null {
    if (!this.actions.openExternally) return null;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = "open-externally";
    button.textContent = "Open in default application";
    button.addEventListener("click", () => {
      actionStatus.textContent = "";
      void this.actions.openExternally?.(file).catch(() => {
        if (generation === this.generation) {
          actionStatus.textContent = "Unable to open the default application.";
        }
      });
    });
    return button;
  }

  private teardownOpenResources(): void {
    const abortController = this.abortController;
    this.abortController = null;
    try {
      abortController?.abort();
    } catch {
      // Continue releasing owned resources if cancellation hooks misbehave.
    }
    for (const cleanup of this.runCleanups) {
      try {
        cleanup();
      } catch {
        // One detached platform listener must not block remaining cleanup.
      }
    }
    this.runCleanups.clear();
    const thumbnailRail = this.thumbnailRail;
    this.thumbnailRail = null;
    const viewerController = this.viewerController;
    this.viewerController = null;
    const backgroundQueue = this.backgroundQueue;
    this.backgroundQueue = null;
    const rendererSession = this.rendererSession;
    this.rendererSession = null;
    for (const dispose of [
      () => thumbnailRail?.dispose(),
      () => viewerController?.dispose(),
      () => backgroundQueue?.dispose(),
      () => rendererSession?.dispose(),
    ]) {
      try {
        dispose();
      } catch {
        // A candidate or component cleanup failure must not strand later owners.
      }
    }
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
