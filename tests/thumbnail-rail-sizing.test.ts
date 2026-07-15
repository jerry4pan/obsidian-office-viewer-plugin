import { describe, expect, it } from "vitest";
import {
  normalizeThumbnailRailWidth,
  resolveThumbnailRailWidth,
  thumbnailPreviewWidth,
} from "../src/thumbnail-rail-sizing";

describe("thumbnail rail sizing", () => {
  it("keeps the saved preference within the agreed 120px to 480px range", () => {
    expect(normalizeThumbnailRailWidth(80)).toBe(120);
    expect(normalizeThumbnailRailWidth(300.4)).toBe(300);
    expect(normalizeThumbnailRailWidth(700)).toBe(480);
    expect(normalizeThumbnailRailWidth(Number.NaN)).toBe(168);
  });

  it("temporarily limits the rail to 45% without changing its preferred width", () => {
    expect(resolveThumbnailRailWidth(1_000, 480)).toBe(450);
    expect(resolveThumbnailRailWidth(800, 300)).toBe(300);
    expect(resolveThumbnailRailWidth(200, 300)).toBe(90);
    expect(resolveThumbnailRailWidth(2_000, 480)).toBe(480);
  });

  it("reserves the agreed rail chrome width for the rendered preview", () => {
    expect(thumbnailPreviewWidth(168)).toBe(144);
    expect(thumbnailPreviewWidth(300)).toBe(276);
  });
});
