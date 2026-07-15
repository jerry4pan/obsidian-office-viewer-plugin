import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "./renderer/pptx-renderer-adapter";
import {
  ENGLISH_MESSAGE_TRANSLATOR,
  type MessageKey,
  type MessageTranslator,
} from "./i18n";
import {
  PptxOpenError,
  type PptxOpenErrorCategory,
} from "./pptx-open-error";
import { PptxViewerController } from "./pptx-viewer-controller";
import { RenderTaskQueue } from "./render-task-queue";
import { ThumbnailRail } from "./thumbnail-rail";
import {
  DEFAULT_THUMBNAIL_RAIL_WIDTH,
  resolveThumbnailRailWidth,
  thumbnailPreviewWidth,
} from "./thumbnail-rail-sizing";
import { ThumbnailRailResizer } from "./thumbnail-rail-resizer";

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
  readonly readyThumbnails: number;
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

export interface PptxViewOptions<FileRef> {
  messages?: MessageTranslator;
  openExternally?: (file: FileRef) => Promise<void>;
  positions?: {
    initialSlideFor(file: FileRef, slideCount: number): number;
    record(file: FileRef, slideIndex: number): void;
  };
  thumbnailRail?: {
    initialWidth(): number;
    recordWidth(width: number): void;
    subscribeWidth?(listener: (width: number) => void): () => void;
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

const errorMessageKeys: Record<PptxOpenErrorCategory, MessageKey> = {
  malformed: "error.malformed",
  protected: "error.protected",
  incompatible: "error.incompatible",
  unknown: "error.unknown",
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
  private readonly messages: MessageTranslator;

  constructor(
    private readonly root: HTMLElement,
    private readonly reader: VaultBinaryReader<FileRef>,
    private readonly renderer: PptxRendererAdapter,
    private readonly options: PptxViewOptions<FileRef> = {},
  ) {
    this.messages = options.messages ?? ENGLISH_MESSAGE_TRANSLATOR;
    root.classList.add("pptx-viewer");
    const empty = document.createElement("div");
    empty.className = "pptx-viewer__empty";
    empty.textContent = this.messages.text("viewer.empty");
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
    status.textContent = this.messages.text("viewer.loading");
    this.root.tabIndex = 0;
    this.root.dataset.thumbnailsCollapsed = "false";
    this.root.dataset.fullscreen = "false";
    this.root.dataset.mountedThumbnailCount = "0";
    this.root.dataset.readyThumbnailCount = "0";
    const pageCounter = document.createElement("div");
    pageCounter.className = "pptx-viewer__page-counter";
    const previousButton = document.createElement("button");
    previousButton.type = "button";
    previousButton.dataset.action = "previous-slide";
    previousButton.textContent = this.messages.text("navigation.previous");
    previousButton.disabled = true;
    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.dataset.action = "next-slide";
    nextButton.textContent = this.messages.text("navigation.next");
    nextButton.disabled = true;
    const pageInput = document.createElement("input");
    pageInput.type = "number";
    pageInput.min = "1";
    pageInput.step = "1";
    pageInput.value = "1";
    pageInput.disabled = true;
    pageInput.dataset.action = "page-number";
    pageInput.setAttribute(
      "aria-label",
      this.messages.text("navigation.slideNumber"),
    );
    const pageTotal = document.createElement("span");
    pageTotal.className = "pptx-viewer__page-total";
    pageTotal.textContent = this.messages.text("navigation.pageTotalPending");
    const jumpButton = document.createElement("button");
    jumpButton.type = "button";
    jumpButton.disabled = true;
    jumpButton.dataset.action = "jump-to-slide";
    jumpButton.textContent = this.messages.text("navigation.go");
    const jumpForm = document.createElement("form");
    jumpForm.className = "pptx-viewer__page-jump";
    const jumpLabel = document.createElement("span");
    jumpLabel.textContent = this.messages.text("navigation.slide");
    jumpForm.append(jumpLabel, pageInput, pageTotal, jumpButton);
    const controls = document.createElement("div");
    controls.className = "pptx-viewer__controls";
    const toggleThumbnails = document.createElement("button");
    toggleThumbnails.type = "button";
    toggleThumbnails.dataset.action = "toggle-thumbnails";
    toggleThumbnails.textContent = this.messages.text("thumbnails.toggle");
    toggleThumbnails.setAttribute(
      "aria-label",
      this.messages.text("thumbnails.toggleLabel"),
    );
    toggleThumbnails.setAttribute("aria-expanded", "true");
    const toggleFullscreen = document.createElement("button");
    toggleFullscreen.type = "button";
    toggleFullscreen.dataset.action = "toggle-fullscreen";
    toggleFullscreen.textContent = this.messages.text("fullscreen.button");
    toggleFullscreen.setAttribute(
      "aria-label",
      this.messages.text("fullscreen.enterLabel"),
    );
    controls.append(
      previousButton,
      pageCounter,
      nextButton,
      jumpForm,
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
        initialSlideIndex = this.options.positions?.initialSlideFor(
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
          pageCounter.textContent = this.messages.text("page.counter", {
            current: index + 1,
            total: rendererSession.slideCount,
          });
          rail?.setCurrentSlide(index);
          updateMountedCount();
          this.root.dataset.state = "ready";
          this.setLifecyclePhase("ready");
          status.textContent = "";
          if (!isInitialCommit) {
            try {
              this.options.positions?.record(file, index);
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
          status.textContent = this.messages.text("navigation.renderFailure", {
            slide: index + 1,
          });
        },
      }, { initialSlideIndex });
      this.viewerController = viewController;
      await viewController.start();
      controller.signal.throwIfAborted();
      if (!isCurrentRun()) return;
      if (initialRenderFailed) {
        throw new PptxOpenError("incompatible", "Initial slide render failed");
      }

      let preferredThumbnailRailWidth = DEFAULT_THUMBNAIL_RAIL_WIDTH;
      try {
        preferredThumbnailRailWidth = this.options.thumbnailRail?.initialWidth() ??
          DEFAULT_THUMBNAIL_RAIL_WIDTH;
      } catch {
        // Preference persistence must not interrupt reading.
      }
      const initialThumbnailRailWidth = resolveThumbnailRailWidth(
        readingBody.clientWidth,
        preferredThumbnailRailWidth,
      );
      rail = new ThumbnailRail(thumbnailRoot, rendererSession, queue, {
        messages: this.messages,
        onMountedCountChange: (count) => {
          if (isCurrentRun() && this.thumbnailRail === rail) {
            this.root.dataset.mountedThumbnailCount = String(count);
          }
        },
        onReadyCountChange: (count) => {
          if (isCurrentRun() && this.thumbnailRail === rail) {
            this.root.dataset.readyThumbnailCount = String(count);
          }
        },
        onNavigate: navigate,
        thumbnailWidth: thumbnailPreviewWidth(initialThumbnailRailWidth),
      });
      this.thumbnailRail = rail;
      rail.start(viewController.state.currentSlideIndex);
      const railResizer = new ThumbnailRailResizer(
        readingBody,
        thumbnailRoot,
        rail,
        {
          messages: this.messages,
          preferredWidth: preferredThumbnailRailWidth,
          onCommit: (width) => this.options.thumbnailRail?.recordWidth(width),
        },
      );
      readingBody.insertBefore(railResizer.element, slideContainer);
      this.runCleanups.add(() => railResizer.dispose());
      try {
        const unsubscribe = this.options.thumbnailRail?.subscribeWidth?.(
          (width) => railResizer.setPreferredWidth(width),
        );
        if (unsubscribe !== undefined) this.runCleanups.add(unsubscribe);
      } catch {
        // Cross-view preference updates are optional and non-blocking.
      }
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
          status.textContent = this.messages.text("navigation.invalidPage", {
            total: rendererSession.slideCount,
          });
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
      pageCounter.textContent = this.messages.text("page.counter", {
        current: currentSlideIndex + 1,
        total: rendererSession.slideCount,
      });
      pageInput.value = String(currentSlideIndex + 1);
      pageInput.max = String(rendererSession.slideCount);
      pageTotal.textContent = this.messages.text("page.total", {
        total: rendererSession.slideCount,
      });
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
      const fullscreen = this.options.fullscreen ?? createDefaultFullscreenActions();
      let lastKnownFullscreenState = false;
      const applyFullscreenState = (active: boolean) => {
        this.root.dataset.fullscreen = String(active);
        toggleFullscreen.textContent = this.messages.text(
          active ? "fullscreen.exit" : "fullscreen.button",
        );
        toggleFullscreen.setAttribute(
          "aria-label",
          this.messages.text(
            active ? "fullscreen.exit" : "fullscreen.enterLabel",
          ),
        );
      };
      const probeFullscreenState = (): {
        active: boolean;
        determinate: boolean;
      } => {
        if (!isCurrentRun()) {
          return { active: lastKnownFullscreenState, determinate: false };
        }
        try {
          lastKnownFullscreenState = fullscreen.isActive(this.root);
          applyFullscreenState(lastKnownFullscreenState);
          return { active: lastKnownFullscreenState, determinate: true };
        } catch {
          return { active: lastKnownFullscreenState, determinate: false };
        }
      };
      const unsubscribeFullscreen = fullscreen.subscribe(() => {
        probeFullscreenState();
      });
      this.runCleanups.add(unsubscribeFullscreen);
      probeFullscreenState();
      toggleFullscreen.addEventListener("click", () => {
        actionStatus.textContent = "";
        void Promise.resolve()
          .then(() => {
            const { active } = probeFullscreenState();
            return active
              ? fullscreen.exit()
              : fullscreen.enter(this.root);
          })
          .then(() => {
            probeFullscreenState();
          })
          .catch(() => {
            if (isCurrentRun()) {
              actionStatus.textContent = this.messages.text(
                "fullscreen.failure",
              );
              probeFullscreenState();
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
    return {
      generation: this.generation,
      openPending: this.openPending,
      rendererActive: this.rendererSession !== null,
      disposed: this.disposed,
      lifecyclePhase: this.lifecyclePhase,
      backgroundPending: queue?.pending ?? 0,
      backgroundRunning: queue?.running ?? 0,
      mountedThumbnails: this.thumbnailRail?.mountedCount ?? 0,
      readyThumbnails: this.thumbnailRail?.readyCount ?? 0,
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
    delete this.root.dataset.fullscreen;
    delete this.root.dataset.mountedThumbnailCount;
    delete this.root.dataset.readyThumbnailCount;
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
    title.textContent = this.messages.text(errorMessageKeys[error.category]);
    const safety = document.createElement("p");
    safety.className = "pptx-viewer__safety-note";
    safety.textContent = this.messages.text("error.sourceUnmodified");
    const actions = document.createElement("div");
    actions.className = "pptx-viewer__actions";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.dataset.action = "retry";
    retry.textContent = this.messages.text("error.retry");
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
    if (!this.options.openExternally) return null;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = "open-externally";
    button.textContent = this.messages.text("external.open");
    button.addEventListener("click", () => {
      actionStatus.textContent = "";
      void this.options.openExternally?.(file).catch(() => {
        if (generation === this.generation) {
          actionStatus.textContent = this.messages.text("external.failure");
        }
      });
    });
    return button;
  }

  private teardownOpenResources(): void {
    const abortController = this.abortController;
    const cleanups = [...this.runCleanups];
    const thumbnailRail = this.thumbnailRail;
    const viewerController = this.viewerController;
    const backgroundQueue = this.backgroundQueue;
    const rendererSession = this.rendererSession;

    this.abortController = null;
    this.runCleanups.clear();
    this.thumbnailRail = null;
    this.viewerController = null;
    this.backgroundQueue = null;
    this.rendererSession = null;
    if (this.root.dataset.readyThumbnailCount !== undefined) {
      this.root.dataset.readyThumbnailCount = "0";
    }

    try {
      abortController?.abort();
    } catch {
      // Continue releasing owned resources if cancellation hooks misbehave.
    }
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch {
        // One detached platform listener must not block remaining cleanup.
      }
    }
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
