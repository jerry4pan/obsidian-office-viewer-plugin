export interface ThumbnailWindow {
  readonly start: number;
  readonly endExclusive: number;
  readonly offsetTop: number;
  readonly totalHeight: number;
}

export function computeThumbnailWindow(options: {
  readonly itemCount: number;
  readonly itemHeight: number;
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly overscanViewports: number;
}): ThumbnailWindow {
  if (
    !Number.isFinite(options.itemCount) ||
    options.itemCount <= 0 ||
    !Number.isFinite(options.itemHeight) ||
    options.itemHeight <= 0
  ) {
    return { start: 0, endExclusive: 0, offsetTop: 0, totalHeight: 0 };
  }

  const itemHeight = options.itemHeight;
  const itemCount = Math.min(
    Math.floor(options.itemCount),
    Math.floor(Number.MAX_SAFE_INTEGER / itemHeight),
  );
  if (itemCount <= 0) {
    return { start: 0, endExclusive: 0, offsetTop: 0, totalHeight: 0 };
  }

  const totalHeight = itemCount * itemHeight;
  const viewportHeight = Number.isFinite(options.viewportHeight)
    ? Math.min(Math.max(0, options.viewportHeight), totalHeight)
    : 0;
  const maxScrollTop = Math.max(0, totalHeight - viewportHeight);
  const requestedScrollTop = Number.isNaN(options.scrollTop)
    ? 0
    : options.scrollTop;
  const scrollTop = Math.min(Math.max(0, requestedScrollTop), maxScrollTop);
  const overscanViewports = Number.isFinite(options.overscanViewports)
    ? Math.max(0, options.overscanViewports)
    : 0;
  const overscanPixels = viewportHeight * overscanViewports;
  const overscanItems = Number.isFinite(overscanPixels)
    ? Math.ceil(overscanPixels / itemHeight)
    : itemCount;

  const firstVisible = Math.min(itemCount - 1, Math.floor(scrollTop / itemHeight));
  const visibleEnd = Math.min(
    itemCount,
    Math.max(firstVisible + 1, Math.ceil((scrollTop + viewportHeight) / itemHeight)),
  );
  const start = Math.max(0, firstVisible - overscanItems);
  const endExclusive = Math.min(itemCount, visibleEnd + overscanItems);

  return {
    start,
    endExclusive,
    offsetTop: start * itemHeight,
    totalHeight,
  };
}
