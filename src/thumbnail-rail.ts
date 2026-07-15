import type {
  PptxRendererResource,
  PptxRendererSession,
} from "./renderer/pptx-renderer-adapter";
import { RenderTaskQueue } from "./render-task-queue";
import { computeThumbnailWindow } from "./thumbnail-virtual-window";

export interface ThumbnailRailOptions {
  readonly onNavigate: (index: number) => void;
  readonly onMountedCountChange?: (count: number) => void;
  readonly onReadyCountChange?: (count: number) => void;
  readonly thumbnailWidth?: number;
  readonly overscanViewports?: number;
  readonly createResizeObserver?: (
    callback: ResizeObserverCallback,
  ) => Pick<ResizeObserver, "observe" | "disconnect">;
}

interface MountedThumbnail {
  readonly button: HTMLButtonElement;
  readonly index: number;
  readonly preview: HTMLElement;
  priority?: 1 | 2;
  queueKey?: string;
  resource?: PptxRendererResource;
  state: "idle" | "pending" | "running" | "ready" | "failed";
}

const DEFAULT_THUMBNAIL_WIDTH = 144;
const DEFAULT_OVERSCAN_VIEWPORTS = 1;
const FALLBACK_VIEWPORT_HEIGHT = 480;
const ITEM_CHROME_HEIGHT = 32;
let nextRailId = 0;

function finitePositive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function waitForReady(
  ready: Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      reject(
        signal.reason ??
          new DOMException("The operation was aborted.", "AbortError"),
      );
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    await Promise.race([ready, aborted]);
  } finally {
    if (onAbort !== undefined) signal.removeEventListener("abort", onAbort);
  }
}

export class ThumbnailRail {
  private readonly disposedResources = new WeakSet<PptxRendererResource>();
  private readonly mounted = new Map<number, MountedThumbnail>();
  private readonly mountedLayer = document.createElement("div");
  private readonly queueKeyPrefix = `thumbnail:rail-${nextRailId++}:`;
  private readonly spacer = document.createElement("div");
  private readonly itemHeight: number;
  private readonly overscanViewports: number;
  private readonly resizeObserver:
    | Pick<ResizeObserver, "observe" | "disconnect">
    | undefined;
  private readonly thumbnailWidth: number;
  private currentSlideIndex = 0;
  private disposed = false;
  private nextAttempt = 0;
  private started = false;
  private lastReportedMountedCount: number | undefined;
  private lastReportedReadyCount: number | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly renderer: PptxRendererSession,
    private readonly queue: RenderTaskQueue,
    private readonly options: ThumbnailRailOptions,
  ) {
    this.thumbnailWidth = finitePositive(
      options.thumbnailWidth,
      DEFAULT_THUMBNAIL_WIDTH,
    );
    const slideWidth = finitePositive(renderer.slideWidth, this.thumbnailWidth);
    const slideHeight = finitePositive(renderer.slideHeight, this.thumbnailWidth);
    this.itemHeight = Math.max(
      1,
      (this.thumbnailWidth * slideHeight) / slideWidth + ITEM_CHROME_HEIGHT,
    );
    this.overscanViewports = Math.max(
      0,
      Number.isFinite(options.overscanViewports)
        ? options.overscanViewports ?? DEFAULT_OVERSCAN_VIEWPORTS
        : DEFAULT_OVERSCAN_VIEWPORTS,
    );

    const createResizeObserver =
      options.createResizeObserver ??
      (typeof ResizeObserver === "undefined"
        ? undefined
        : (callback: ResizeObserverCallback) => new ResizeObserver(callback));
    this.resizeObserver = createResizeObserver?.(() => this.refresh());
  }

  get mountedCount(): number {
    return this.mounted.size;
  }

  get readyCount(): number {
    return [...this.mounted.values()].filter(({ state }) => state === "ready")
      .length;
  }

  start(currentSlideIndex: number): void {
    if (this.disposed) return;
    this.currentSlideIndex = this.clampIndex(currentSlideIndex);
    if (this.started) {
      this.setCurrentSlide(this.currentSlideIndex);
      return;
    }
    this.started = true;

    this.root.replaceChildren();
    this.root.setAttribute("role", "navigation");
    this.root.setAttribute("aria-label", "Slide thumbnails");
    this.root.classList.add("pptx-viewer__thumbnail-rail");
    this.spacer.dataset.thumbnailSpacer = "true";
    this.spacer.className = "pptx-viewer__thumbnail-spacer";
    this.mountedLayer.dataset.thumbnailMountedLayer = "true";
    this.mountedLayer.className = "pptx-viewer__thumbnail-mounted-layer";
    this.root.append(this.spacer, this.mountedLayer);
    this.root.addEventListener("scroll", this.onScroll);
    this.resizeObserver?.observe(this.root);
    this.refresh();
    this.reportMountedCount();
    this.reportReadyCount();
  }

  setCurrentSlide(index: number): void {
    if (this.disposed || !this.started) return;
    this.currentSlideIndex = this.clampIndex(index);
    const viewportHeight = this.viewportHeight();
    const itemTop = this.currentSlideIndex * this.itemHeight;
    const itemBottom = itemTop + this.itemHeight;
    if (itemTop < this.root.scrollTop) {
      this.root.scrollTop = itemTop;
    } else if (itemBottom > this.root.scrollTop + viewportHeight) {
      this.root.scrollTop = itemBottom - viewportHeight;
    }
    this.refresh();
  }

  refresh(): void {
    if (this.disposed || !this.started) return;
    const viewportHeight = this.viewportHeight();
    const window = computeThumbnailWindow({
      itemCount: this.renderer.slideCount,
      itemHeight: this.itemHeight,
      overscanViewports: this.overscanViewports,
      scrollTop: this.root.scrollTop,
      viewportHeight,
    });
    this.spacer.style.height = `${window.totalHeight}px`;
    this.mountedLayer.style.transform = `translateY(${window.offsetTop}px)`;

    for (const [index, item] of [...this.mounted]) {
      if (index < window.start || index >= window.endExclusive) {
        this.unmount(item);
      }
    }

    for (let index = window.start; index < window.endExclusive; index += 1) {
      let item = this.mounted.get(index);
      if (item === undefined) {
        item = this.mount(index, window.start);
      } else {
        item.button.style.top = `${(index - window.start) * this.itemHeight}px`;
      }
      this.updateSelection(item);
    }

    for (const item of [...this.mounted.values()].sort(
      (left, right) => left.index - right.index,
    )) {
      this.mountedLayer.append(item.button);
    }

    const visibleStart = Math.max(
      window.start,
      Math.floor(this.root.scrollTop / this.itemHeight),
    );
    const visibleEnd = Math.min(
      window.endExclusive,
      Math.max(
        visibleStart + 1,
        Math.ceil((this.root.scrollTop + viewportHeight) / this.itemHeight),
      ),
    );
    const candidates = [...this.mounted.values()]
      .map((item) => ({
        item,
        priority: item.index >= visibleStart && item.index < visibleEnd
          ? 1 as const
          : 2 as const,
      }))
      .sort(
        (left, right) =>
          left.priority - right.priority || left.item.index - right.item.index,
      );
    for (const { item, priority } of candidates) {
      if (item.state === "pending" && item.priority !== priority) {
        this.cancelAttempt(item);
      }
      if (item.state === "idle") this.render(item, priority);
    }
    this.reportMountedCount();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeEventListener("scroll", this.onScroll);
    this.resizeObserver?.disconnect();
    this.queue.cancelMatching((key) => key.startsWith(this.queueKeyPrefix));
    for (const item of [...this.mounted.values()]) this.unmount(item);
    this.root.replaceChildren();
    this.reportMountedCount();
    this.reportReadyCount();
  }

  private readonly onScroll = (): void => {
    this.refresh();
  };

  private clampIndex(index: number): number {
    if (this.renderer.slideCount <= 0) return 0;
    const integer = Number.isFinite(index) ? Math.floor(index) : 0;
    return Math.min(Math.max(0, integer), this.renderer.slideCount - 1);
  }

  private viewportHeight(): number {
    return finitePositive(this.root.clientHeight, FALLBACK_VIEWPORT_HEIGHT);
  }

  private mount(index: number, windowStart: number): MountedThumbnail {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pptx-viewer__thumbnail";
    button.dataset.action = "thumbnail-slide";
    button.dataset.slideIndex = String(index);
    button.setAttribute("aria-label", `Slide ${index + 1}`);
    button.style.height = `${this.itemHeight}px`;
    button.style.top = `${(index - windowStart) * this.itemHeight}px`;

    const preview = document.createElement("span");
    preview.className = "pptx-viewer__thumbnail-preview";
    preview.style.width = `${this.thumbnailWidth}px`;
    preview.style.setProperty(
      "--pptx-slide-aspect-ratio",
      `${this.renderer.slideWidth} / ${this.renderer.slideHeight}`,
    );
    const number = document.createElement("span");
    number.className = "pptx-viewer__thumbnail-number";
    number.setAttribute("aria-hidden", "true");
    number.textContent = String(index + 1);
    button.append(preview, number);
    button.addEventListener("click", () => this.options.onNavigate(index));

    const item: MountedThumbnail = { button, index, preview, state: "idle" };
    this.mounted.set(index, item);
    return item;
  }

  private updateSelection(item: MountedThumbnail): void {
    if (item.index === this.currentSlideIndex) {
      item.button.setAttribute("aria-current", "page");
    } else {
      item.button.removeAttribute("aria-current");
    }
  }

  private render(item: MountedThumbnail, priority: 1 | 2): void {
    if (!this.renderer.capabilities.thumbnails || !this.renderer.renderThumbnail) {
      item.state = "failed";
      this.showUnavailable(item);
      return;
    }
    const renderThumbnail = this.renderer.renderThumbnail.bind(this.renderer);
    const queueKey = `${this.queueKeyPrefix}${item.index}:${this.nextAttempt++}`;
    let attemptSignal: AbortSignal | undefined;
    item.priority = priority;
    item.queueKey = queueKey;
    item.state = "pending";
    void this.queue
      .enqueue({
        key: queueKey,
        priority,
        run: async (signal) => {
          attemptSignal = signal;
          let resource: PptxRendererResource | undefined;
          try {
            if (
              this.mounted.get(item.index) === item &&
              item.queueKey === queueKey
            ) {
              item.state = "running";
            }
            resource = renderThumbnail(item.index, item.preview, signal);
            if (
              this.mounted.get(item.index) === item &&
              item.queueKey === queueKey
            ) {
              item.resource = resource;
            } else {
              this.disposeResource(resource);
              signal.throwIfAborted();
              throw new DOMException("The operation was aborted.", "AbortError");
            }
            await waitForReady(resource.ready, signal);
            signal.throwIfAborted();
            return resource;
          } catch (error) {
            if (resource !== undefined) this.disposeResource(resource);
            throw error;
          }
        },
        disposeResult: (resource) => this.disposeResource(resource),
      })
      .then((resource) => {
        if (
          this.disposed ||
          this.mounted.get(item.index) !== item ||
          item.queueKey !== queueKey
        ) {
          this.disposeResource(resource);
        } else {
          item.state = "ready";
          item.button.dataset.thumbnailReady = "true";
          this.reportReadyCount();
        }
      })
      .catch((error: unknown) => {
        const canceled = attemptSignal === undefined
          ? isAbort(error)
          : attemptSignal.aborted;
        if (
          !this.disposed &&
          this.mounted.get(item.index) === item &&
          item.queueKey === queueKey &&
          !canceled
        ) {
          delete item.resource;
          item.state = "failed";
          this.showUnavailable(item);
        } else if (
          !this.disposed &&
          this.mounted.get(item.index) === item &&
          item.queueKey === queueKey
        ) {
          delete item.resource;
          item.state = "idle";
        }
      });
  }

  private showUnavailable(item: MountedThumbnail): void {
    item.preview.replaceChildren();
    item.preview.textContent = `Slide ${item.index + 1} preview unavailable`;
  }

  private unmount(item: MountedThumbnail): void {
    if (!this.mounted.delete(item.index)) return;
    delete item.button.dataset.thumbnailReady;
    this.cancelAttempt(item);
    item.button.remove();
    this.reportReadyCount();
  }

  private reportMountedCount(): void {
    const count = this.mounted.size;
    if (count === this.lastReportedMountedCount) return;
    this.lastReportedMountedCount = count;
    try {
      this.options.onMountedCountChange?.(count);
    } catch {
      // Product diagnostics must not corrupt thumbnail virtualization.
    }
  }

  private reportReadyCount(): void {
    const count = this.readyCount;
    if (count === this.lastReportedReadyCount) return;
    this.lastReportedReadyCount = count;
    try {
      this.options.onReadyCountChange?.(count);
    } catch {
      // Product diagnostics must not corrupt thumbnail rendering.
    }
  }

  private cancelAttempt(item: MountedThumbnail): void {
    if (item.queueKey !== undefined) this.queue.cancel(item.queueKey);
    if (item.resource !== undefined) this.disposeResource(item.resource);
    delete item.priority;
    delete item.queueKey;
    delete item.resource;
    delete item.button.dataset.thumbnailReady;
    item.state = "idle";
  }

  private disposeResource(resource: PptxRendererResource): void {
    if (this.disposedResources.has(resource)) return;
    this.disposedResources.add(resource);
    try {
      resource.dispose();
    } catch {
      // A candidate cleanup failure must not strand other rail resources.
    }
  }
}
