export const DEFAULT_THUMBNAIL_RAIL_WIDTH = 168;
export const MIN_THUMBNAIL_RAIL_WIDTH = 120;
export const MAX_THUMBNAIL_RAIL_WIDTH = 480;
const MAX_READING_BODY_RATIO = 0.45;
const THUMBNAIL_RAIL_CHROME_WIDTH = 24;

export function normalizeThumbnailRailWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_THUMBNAIL_RAIL_WIDTH;
  return Math.min(
    MAX_THUMBNAIL_RAIL_WIDTH,
    Math.max(MIN_THUMBNAIL_RAIL_WIDTH, Math.round(width)),
  );
}

export function resolveThumbnailRailWidth(
  hostWidth: number,
  preferredWidth: number,
): number {
  const preferred = normalizeThumbnailRailWidth(preferredWidth);
  if (!Number.isFinite(hostWidth) || hostWidth <= 0) return preferred;
  const maximum = Math.min(
    MAX_THUMBNAIL_RAIL_WIDTH,
    Math.floor(hostWidth * MAX_READING_BODY_RATIO),
  );
  const minimum = Math.min(MIN_THUMBNAIL_RAIL_WIDTH, maximum);
  return Math.max(minimum, Math.min(maximum, preferred));
}

export function thumbnailPreviewWidth(railWidth: number): number {
  return Math.max(1, railWidth - THUMBNAIL_RAIL_CHROME_WIDTH);
}

export function maximumThumbnailRailWidth(hostWidth: number): number {
  return Number.isFinite(hostWidth) && hostWidth > 0
    ? Math.min(
        MAX_THUMBNAIL_RAIL_WIDTH,
        Math.floor(hostWidth * MAX_READING_BODY_RATIO),
      )
    : MAX_THUMBNAIL_RAIL_WIDTH;
}
