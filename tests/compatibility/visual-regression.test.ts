import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import {
  assertVisualMatch,
  comparePngBuffers,
} from "./visual-regression";

function solidPng(red: number): Buffer {
  const png = new PNG({ width: 2, height: 2 });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = red;
    png.data[offset + 1] = 0;
    png.data[offset + 2] = 0;
    png.data[offset + 3] = 255;
  }
  return PNG.sync.write(png);
}

describe("PPTX visual regression", () => {
  it("reports no difference for identical PNGs", () => {
    const png = solidPng(20);
    expect(comparePngBuffers(png, png)).toEqual({
      differentPixels: 0,
      totalPixels: 4,
      ratio: 0,
    });
  });

  it("reports and rejects a material visual change", () => {
    const result = comparePngBuffers(solidPng(0), solidPng(255));

    expect(result.ratio).toBe(1);
    expect(() => assertVisualMatch("changed", result, 0.005)).toThrow(
      "changed visual diff 100.000% exceeds 0.500%",
    );
  });

  it("rejects screenshots with different dimensions", () => {
    const wider = new PNG({ width: 3, height: 2 });
    expect(() =>
      comparePngBuffers(solidPng(0), PNG.sync.write(wider)),
    ).toThrow("PNG dimensions differ");
  });
});
