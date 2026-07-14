import { describe, expect, it, vi } from "vitest";
import {
  captureRenderedSlide,
  renderSlideAtomically,
} from "../../src/renderer/rendered-slide-backup";

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

describe("renderSlideAtomically", () => {
  it("rolls back through the candidate before using the DOM snapshot", async () => {
    const container = document.createElement("div");
    container.textContent = "slide 1";
    const calls: number[] = [];

    await expect(
      renderSlideAtomically({
        container,
        targetIndex: 1,
        previousIndex: 0,
        render: async (index) => {
          calls.push(index);
          if (index === 1) {
            container.textContent = "candidate error";
            throw new Error("private candidate failure");
          }
          container.textContent = "slide 1 rerendered";
        },
      }),
    ).rejects.toThrow("The renderer could not display slide 2");
    expect(calls).toEqual([1, 0]);
    expect(container.textContent).toBe("slide 1 rerendered");
  });

  it("restores the snapshot when target and rollback rendering both fail", async () => {
    const container = document.createElement("div");
    container.textContent = "slide 1";

    await expect(
      renderSlideAtomically({
        container,
        targetIndex: 1,
        previousIndex: 0,
        render: async () => {
          container.textContent = "candidate error";
          throw new Error("private candidate failure");
        },
      }),
    ).rejects.toThrow("The renderer could not display slide 2");
    expect(container.textContent).toBe("slide 1");
  });
});
