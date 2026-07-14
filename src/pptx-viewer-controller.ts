import type { PptxRendererSession } from "./renderer/pptx-renderer-adapter";
import { RenderTaskQueue } from "./render-task-queue";

export type PptxZoomMode = "fit" | "manual";

export interface PptxViewerControllerState {
  readonly currentSlideIndex: number;
  readonly zoomMode: PptxZoomMode;
  readonly zoomPercent: number;
  readonly navigationPending: boolean;
  readonly disposed: boolean;
}

export interface PptxViewerControllerSink {
  setNavigationPending(pending: boolean): void;
  commitSlide(index: number): void;
  reportNavigationFailure(index: number): void;
  commitZoom(mode: PptxZoomMode, percent: number): void;
  reportActionFailure(message: string): void;
}

export interface PptxViewerControllerOptions {
  readonly initialSlideIndex: number;
}

const FIT_ZOOM_PERCENT = 100;
const MIN_ZOOM_PERCENT = 25;
const MAX_ZOOM_PERCENT = 400;
const ZOOM_STEP = 25;
const PREFETCH_KEY_PREFIX = "prefetch:";
const ZOOM_UNAVAILABLE_MESSAGE = "Zoom is not supported by this renderer.";
const ZOOM_FAILURE_MESSAGE = "Unable to change zoom.";

export class PptxViewerController {
  private currentState: PptxViewerControllerState;
  private generation = 0;
  private navigationTail: Promise<void> = Promise.resolve();
  private pendingNavigations = 0;
  private startPromise: Promise<void> | undefined;
  private zoomTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly renderer: PptxRendererSession,
    private readonly queue: RenderTaskQueue,
    private readonly sink: PptxViewerControllerSink,
    options: PptxViewerControllerOptions,
  ) {
    this.currentState = {
      currentSlideIndex: this.clampSlideIndex(options.initialSlideIndex),
      disposed: false,
      navigationPending: false,
      zoomMode: "fit",
      zoomPercent: FIT_ZOOM_PERCENT,
    };
  }

  get state(): PptxViewerControllerState {
    return this.currentState;
  }

  start(): Promise<void> {
    if (this.currentState.disposed) return Promise.resolve();
    if (this.startPromise === undefined) {
      this.startPromise = this.navigationTail.then(() => this.renderInitialSlide());
      this.navigationTail = this.startPromise.catch(() => undefined);
    }
    return this.startPromise;
  }

  navigate(index: number): Promise<void> {
    if (
      this.currentState.disposed ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.renderer.slideCount ||
      (this.pendingNavigations === 0 && index === this.currentState.currentSlideIndex)
    ) {
      return Promise.resolve();
    }

    this.beginNavigation();
    const operation = this.navigationTail.then(() => this.renderNavigation(index));
    this.navigationTail = operation.catch(() => undefined);
    return operation.finally(() => this.endNavigation());
  }

  zoomIn(): Promise<void> {
    return this.enqueueZoom((percent) =>
      Math.min(MAX_ZOOM_PERCENT, percent + ZOOM_STEP),
    );
  }

  zoomOut(): Promise<void> {
    return this.enqueueZoom((percent) =>
      Math.max(MIN_ZOOM_PERCENT, percent - ZOOM_STEP),
    );
  }

  resetToFit(): Promise<void> {
    return this.enqueueZoom(() => FIT_ZOOM_PERCENT, "fit");
  }

  dispose(): void {
    if (this.currentState.disposed) return;
    this.generation += 1;
    this.pendingNavigations = 0;
    if (this.currentState.navigationPending) {
      this.sink.setNavigationPending(false);
    }
    this.currentState = {
      ...this.currentState,
      disposed: true,
      navigationPending: false,
    };
    this.cancelObsoletePrefetch();
  }

  private async renderInitialSlide(): Promise<void> {
    if (this.currentState.disposed) return;
    const generation = this.generation;
    this.beginNavigation();
    try {
      await this.renderer.renderSlide(this.currentState.currentSlideIndex);
      if (!this.isCurrent(generation)) return;
      this.sink.commitSlide(this.currentState.currentSlideIndex);
      this.scheduleAdjacentPrefetch(this.currentState.currentSlideIndex);
    } catch {
      if (this.isCurrent(generation)) {
        this.sink.reportNavigationFailure(this.currentState.currentSlideIndex);
      }
    } finally {
      this.endNavigation();
    }
  }

  private async renderNavigation(index: number): Promise<void> {
    if (this.currentState.disposed || index === this.currentState.currentSlideIndex) {
      return;
    }
    this.cancelObsoletePrefetch();
    const generation = this.generation;
    try {
      await this.renderer.renderSlide(index);
      if (!this.isCurrent(generation)) return;
      this.currentState = { ...this.currentState, currentSlideIndex: index };
      this.sink.commitSlide(index);
      this.scheduleAdjacentPrefetch(index);
    } catch {
      if (this.isCurrent(generation)) this.sink.reportNavigationFailure(index);
    }
  }

  private beginNavigation(): void {
    this.pendingNavigations += 1;
    if (this.pendingNavigations !== 1 || this.currentState.disposed) return;
    this.currentState = { ...this.currentState, navigationPending: true };
    this.sink.setNavigationPending(true);
  }

  private endNavigation(): void {
    if (this.pendingNavigations > 0) this.pendingNavigations -= 1;
    if (
      this.pendingNavigations !== 0 ||
      !this.currentState.navigationPending
    ) {
      return;
    }
    this.currentState = { ...this.currentState, navigationPending: false };
    this.sink.setNavigationPending(false);
  }

  private enqueueZoom(
    nextPercent: (currentPercent: number) => number,
    mode: PptxZoomMode = "manual",
  ): Promise<void> {
    if (this.currentState.disposed) return Promise.resolve();
    const operation = this.zoomTail.then(() => this.applyZoom(nextPercent, mode));
    this.zoomTail = operation.catch(() => undefined);
    return operation;
  }

  private async applyZoom(
    nextPercent: (currentPercent: number) => number,
    mode: PptxZoomMode,
  ): Promise<void> {
    if (this.currentState.disposed) return;
    if (!this.renderer.capabilities.zoom || this.renderer.setZoomPercent === undefined) {
      this.sink.reportActionFailure(ZOOM_UNAVAILABLE_MESSAGE);
      return;
    }

    const percent = nextPercent(this.currentState.zoomPercent);
    if (
      percent === this.currentState.zoomPercent &&
      mode === this.currentState.zoomMode
    ) {
      return;
    }
    const generation = this.generation;
    try {
      await this.renderer.setZoomPercent(percent);
      if (!this.isCurrent(generation)) return;
      this.currentState = {
        ...this.currentState,
        zoomMode: mode,
        zoomPercent: percent,
      };
      this.sink.commitZoom(mode, percent);
    } catch {
      if (this.isCurrent(generation)) {
        this.sink.reportActionFailure(ZOOM_FAILURE_MESSAGE);
      }
    }
  }

  private cancelObsoletePrefetch(): void {
    this.queue.cancelMatching((key) => key.startsWith(PREFETCH_KEY_PREFIX));
  }

  private scheduleAdjacentPrefetch(index: number): void {
    if (
      this.currentState.disposed ||
      !this.renderer.capabilities.prefetch ||
      this.renderer.prefetchSlide === undefined
    ) {
      return;
    }

    for (const adjacentIndex of [index - 1, index + 1]) {
      if (adjacentIndex < 0 || adjacentIndex >= this.renderer.slideCount) continue;
      const result = this.queue.enqueue({
        key: `${PREFETCH_KEY_PREFIX}${adjacentIndex}`,
        priority: 0,
        run: (signal) => this.renderer.prefetchSlide!(adjacentIndex, signal),
      });
      void result.catch(() => undefined);
    }
  }

  private clampSlideIndex(index: number): number {
    if (this.renderer.slideCount <= 0) return 0;
    const integer = Number.isFinite(index) ? Math.floor(index) : 0;
    return Math.min(Math.max(integer, 0), this.renderer.slideCount - 1);
  }

  private isCurrent(generation: number): boolean {
    return !this.currentState.disposed && generation === this.generation;
  }
}
