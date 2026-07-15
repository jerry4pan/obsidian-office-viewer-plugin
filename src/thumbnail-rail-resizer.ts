import type { ThumbnailRail } from "./thumbnail-rail";
import {
  ENGLISH_MESSAGE_TRANSLATOR,
  type MessageTranslator,
} from "./i18n";
import {
  DEFAULT_THUMBNAIL_RAIL_WIDTH,
  MIN_THUMBNAIL_RAIL_WIDTH,
  maximumThumbnailRailWidth,
  normalizeThumbnailRailWidth,
  resolveThumbnailRailWidth,
  thumbnailPreviewWidth,
} from "./thumbnail-rail-sizing";

export interface ThumbnailRailResizerOptions {
  readonly messages?: MessageTranslator;
  readonly preferredWidth: number;
  readonly onCommit?: (width: number) => void;
  readonly createResizeObserver?: (
    callback: ResizeObserverCallback,
  ) => Pick<ResizeObserver, "observe" | "disconnect">;
}

export class ThumbnailRailResizer {
  readonly element = document.createElement("div");
  private preferredWidth: number;
  private actualWidth: number;
  private dragging:
    | { readonly pointerId: number; readonly startWidth: number; readonly startX: number }
    | undefined;
  private disposed = false;
  private resizeFrame: number | undefined;
  private readonly resizeObserver:
    | Pick<ResizeObserver, "observe" | "disconnect">
    | undefined;
  private readonly messages: MessageTranslator;

  constructor(
    private readonly host: HTMLElement,
    private readonly railElement: HTMLElement,
    private readonly rail: ThumbnailRail,
    private readonly options: ThumbnailRailResizerOptions,
  ) {
    this.messages = options.messages ?? ENGLISH_MESSAGE_TRANSLATOR;
    this.preferredWidth = normalizeThumbnailRailWidth(options.preferredWidth);
    this.actualWidth = this.preferredWidth;
    this.element.className = "pptx-viewer__thumbnail-resizer";
    this.element.dataset.action = "resize-thumbnails";
    this.element.tabIndex = 0;
    this.element.setAttribute("role", "separator");
    this.element.setAttribute("aria-orientation", "vertical");
    this.element.setAttribute(
      "aria-label",
      this.messages.text("thumbnails.resizeLabel"),
    );
    this.element.title = this.messages.text("thumbnails.resizeTitle");
    this.element.addEventListener("keydown", this.onKeyDown);
    this.element.addEventListener("dblclick", this.onDoubleClick);
    this.element.addEventListener("pointerdown", this.onPointerDown);

    const createResizeObserver =
      options.createResizeObserver ??
      (typeof ResizeObserver === "undefined"
        ? undefined
        : (callback: ResizeObserverCallback) => new ResizeObserver(callback));
    this.resizeObserver = createResizeObserver?.(() => this.scheduleHostResize());
    this.resizeObserver?.observe(host);
    this.applyWidth(false, false);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver?.disconnect();
    if (this.resizeFrame !== undefined) cancelAnimationFrame(this.resizeFrame);
    this.stopDragging();
    this.element.removeEventListener("keydown", this.onKeyDown);
    this.element.removeEventListener("dblclick", this.onDoubleClick);
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.remove();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 48 : 16;
    this.preferredWidth = normalizeThumbnailRailWidth(
      this.preferredWidth + (event.key === "ArrowRight" ? step : -step),
    );
    this.applyWidth(true, true);
  };

  setPreferredWidth(width: number): void {
    if (this.disposed) return;
    const preferredWidth = normalizeThumbnailRailWidth(width);
    if (preferredWidth === this.preferredWidth) return;
    this.preferredWidth = preferredWidth;
    this.applyWidth(false, true);
  }

  private readonly onDoubleClick = (): void => {
    this.preferredWidth = DEFAULT_THUMBNAIL_RAIL_WIDTH;
    this.applyWidth(true, true);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.disposed) return;
    event.preventDefault();
    this.rail.beginResize();
    this.dragging = {
      pointerId: event.pointerId,
      startWidth: this.actualWidth,
      startX: event.clientX,
    };
    this.element.dataset.resizing = "true";
    this.element.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const drag = this.dragging;
    if (drag === undefined || event.pointerId !== drag.pointerId) return;
    this.preferredWidth = normalizeThumbnailRailWidth(
      drag.startWidth + event.clientX - drag.startX,
    );
    this.applyWidth(false, false);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const drag = this.dragging;
    if (drag === undefined || event.pointerId !== drag.pointerId) return;
    this.stopDragging();
    this.applyWidth(true, true, true);
  };

  private stopDragging(): void {
    if (this.dragging !== undefined) {
      this.element.releasePointerCapture?.(this.dragging.pointerId);
    }
    this.dragging = undefined;
    delete this.element.dataset.resizing;
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
  }

  private scheduleHostResize(): void {
    if (this.disposed || this.resizeFrame !== undefined) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = undefined;
      if (!this.disposed) this.applyWidth(false, true);
    });
  }

  private applyWidth(
    commit: boolean,
    rerender: boolean,
    forceRerender = false,
  ): void {
    const hostWidth = this.host.clientWidth;
    const actualWidth = resolveThumbnailRailWidth(
      hostWidth,
      this.preferredWidth,
    );
    const maximum = maximumThumbnailRailWidth(hostWidth);
    const minimum = Math.min(MIN_THUMBNAIL_RAIL_WIDTH, maximum);
    const actualWidthChanged = actualWidth !== this.actualWidth;
    this.actualWidth = actualWidth;
    this.railElement.style.flexBasis = `${actualWidth}px`;
    this.railElement.style.width = `${actualWidth}px`;
    this.element.setAttribute("aria-valuemin", String(minimum));
    this.element.setAttribute("aria-valuemax", String(maximum));
    this.element.setAttribute("aria-valuenow", String(actualWidth));
    this.element.setAttribute(
      "aria-valuetext",
      this.messages.text("thumbnails.resizeValue", { pixels: actualWidth }),
    );
    this.rail.setThumbnailWidth(thumbnailPreviewWidth(actualWidth), {
      rerender: rerender && (actualWidthChanged || forceRerender),
    });
    if (commit) {
      try {
        this.options.onCommit?.(this.preferredWidth);
      } catch {
        // Preference persistence must not interrupt reading.
      }
    }
  }
}
