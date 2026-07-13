import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export interface VisualDiffResult {
  readonly differentPixels: number;
  readonly totalPixels: number;
  readonly ratio: number;
}

export function comparePngBuffers(
  baselineBytes: Buffer,
  currentBytes: Buffer,
): VisualDiffResult {
  const baseline = PNG.sync.read(baselineBytes);
  const current = PNG.sync.read(currentBytes);
  if (
    baseline.width !== current.width ||
    baseline.height !== current.height
  ) {
    throw new Error(
      `PNG dimensions differ: ${baseline.width}x${baseline.height} vs ${current.width}x${current.height}`,
    );
  }

  const differentPixels = pixelmatch(
    baseline.data,
    current.data,
    undefined,
    baseline.width,
    baseline.height,
    { threshold: 0.1 },
  );
  const totalPixels = baseline.width * baseline.height;
  return {
    differentPixels,
    totalPixels,
    ratio: totalPixels === 0 ? 0 : differentPixels / totalPixels,
  };
}

export function assertVisualMatch(
  fixtureId: string,
  result: VisualDiffResult,
  maximumRatio: number,
): void {
  if (result.ratio > maximumRatio) {
    throw new Error(
      `${fixtureId} visual diff ${(result.ratio * 100).toFixed(3)}% exceeds ${(maximumRatio * 100).toFixed(3)}%`,
    );
  }
}
