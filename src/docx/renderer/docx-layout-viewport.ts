const DEFAULT_MIN_SCALE = 0.65;
const DEFAULT_MAX_SCALE = 1;
const LAYOUT_SCALE_CSS_VAR = "--office-viewer-docx-layout-scale";

export function calculateDocxLayoutScale(
  availableWidth: number,
  widestPageWidth: number,
  options?: { minScale?: number; maxScale?: number },
): number {
  const minScale = options?.minScale ?? DEFAULT_MIN_SCALE;
  const maxScale = options?.maxScale ?? DEFAULT_MAX_SCALE;
  if (
    !Number.isFinite(availableWidth) ||
    !Number.isFinite(widestPageWidth) ||
    availableWidth <= 0 ||
    widestPageWidth <= 0
  ) {
    return maxScale;
  }
  return Math.min(
    maxScale,
    Math.max(minScale, availableWidth / widestPageWidth),
  );
}

export interface DocxLayoutViewportOptions {
  readonly container: HTMLElement;
  readonly pagesRoot: HTMLElement;
  readonly minScale?: number;
}

export class DocxLayoutViewport {
  private readonly container: HTMLElement;
  private readonly pagesRoot: HTMLElement;
  private readonly minScale: number;
  private disposed = false;
  private started = false;
  private resizeObserver: ResizeObserver | undefined;
  private widestPageWidth = 0;

  constructor(options: DocxLayoutViewportOptions) {
    this.container = options.container;
    this.pagesRoot = options.pagesRoot;
    this.minScale = options.minScale ?? DEFAULT_MIN_SCALE;
  }

  start(): void {
    if (this.disposed || this.started) return;
    this.started = true;

    this.widestPageWidth = readWidestUnscaledPageWidth(this.pagesRoot);
    if (
      this.widestPageWidth <= 0 ||
      typeof ResizeObserver === "undefined"
    ) {
      this.applyScale(DEFAULT_MAX_SCALE);
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.refreshScale();
    });
    this.resizeObserver.observe(this.container);
    this.refreshScale();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }

  private refreshScale(): void {
    if (this.disposed) return;
    if (this.widestPageWidth <= 0) {
      this.applyScale(DEFAULT_MAX_SCALE);
      return;
    }
    const scale = calculateDocxLayoutScale(
      this.container.clientWidth,
      this.widestPageWidth,
      { minScale: this.minScale },
    );
    this.applyScale(scale);
  }

  private applyScale(scale: number): void {
    this.container.style.setProperty(LAYOUT_SCALE_CSS_VAR, String(scale));
    this.container.dataset.layoutScale = String(scale);
    for (const page of this.pagesRoot.querySelectorAll<HTMLElement>(
      "section.docx",
    )) {
      page.style.zoom = String(scale);
    }
  }
}

function readWidestUnscaledPageWidth(pagesRoot: HTMLElement): number {
  let widest = 0;
  for (const page of pagesRoot.querySelectorAll<HTMLElement>("section.docx")) {
    const width = readUnscaledPageWidth(page);
    if (width > widest) widest = width;
  }
  return widest;
}

function readUnscaledPageWidth(page: HTMLElement): number {
  const authored = parseCssPx(page.style.width);
  if (authored !== null && authored > 0) return authored;

  const minWidth = parseCssPx(page.style.minWidth);
  if (minWidth !== null && minWidth > 0) return minWidth;

  const zoom = parsePositiveNumber(page.style.zoom) ?? 1;
  const layoutWidth =
    page.offsetWidth ||
    page.clientWidth ||
    page.getBoundingClientRect().width;
  if (layoutWidth > 0 && zoom > 0) return layoutWidth / zoom;
  return 0;
}

function parseCssPx(value: string): number | null {
  const match = /^([0-9]+(?:\.[0-9]+)?)\s*(px|pt)$/i.exec(value.trim());
  if (match === null) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  const unit = (match[2] ?? "px").toLowerCase();
  return unit === "pt" ? (parsed * 96) / 72 : parsed;
}

function parsePositiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
