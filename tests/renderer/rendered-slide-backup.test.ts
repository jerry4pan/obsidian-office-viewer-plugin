import { describe, expect, it, vi } from "vitest";
import { captureRenderedSlide } from "../../src/renderer/rendered-slide-backup";

describe("captureRenderedSlide", () => {
  it("copies canvas pixels into the restorable snapshot", () => {
    const container = document.createElement("div");
    const canvas = document.createElement("canvas");
    container.append(canvas);
    const drawImage = vi.fn();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);

    try {
      const backup = captureRenderedSlide(container);
      container.replaceChildren();
      backup.restore();

      expect(drawImage).toHaveBeenCalledWith(canvas, 0, 0);
      expect(container.querySelector("canvas")).not.toBeNull();
    } finally {
      getContext.mockRestore();
    }
  });

  it("rejects an unusable canvas snapshot before visible content changes", () => {
    const container = document.createElement("div");
    container.append(document.createElement("canvas"));
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(null);

    try {
      expect(() => captureRenderedSlide(container)).toThrow(
        "The rendered slide canvas could not be captured",
      );
      expect(container.querySelector("canvas")).not.toBeNull();
    } finally {
      getContext.mockRestore();
    }
  });
});
