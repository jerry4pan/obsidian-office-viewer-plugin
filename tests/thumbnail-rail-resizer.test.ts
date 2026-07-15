import { describe, expect, it, vi } from "vitest";
import { ThumbnailRailResizer } from "../src/thumbnail-rail-resizer";
import type { ThumbnailRail } from "../src/thumbnail-rail";

function pointer(type: string, clientX: number): Event {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX,
  });
  Object.defineProperty(event, "pointerId", { value: 3 });
  return event;
}

describe("ThumbnailRailResizer", () => {
  it("starts an explicit resize from the narrow-pane actual width", () => {
    const host = document.createElement("div");
    const railElement = document.createElement("nav");
    Object.defineProperty(host, "clientWidth", { value: 400 });
    const rail = {
      beginResize: vi.fn(),
      setThumbnailWidth: vi.fn(),
    } as unknown as ThumbnailRail;
    const onCommit = vi.fn();
    const resizer = new ThumbnailRailResizer(host, railElement, rail, {
      preferredWidth: 400,
      onCommit,
      createResizeObserver: () => ({ observe: vi.fn(), disconnect: vi.fn() }),
    });

    expect(railElement.style.width).toBe("180px");
    resizer.element.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "ArrowRight",
      }),
    );
    expect(onCommit).toHaveBeenLastCalledWith(416);
    expect(railElement.style.width).toBe("180px");

    resizer.element.dispatchEvent(pointer("pointerdown", 180));
    window.dispatchEvent(pointer("pointermove", 164));
    expect(railElement.style.width).toBe("164px");
    window.dispatchEvent(pointer("pointerup", 164));
    expect(onCommit).toHaveBeenLastCalledWith(164);

    resizer.dispose();
  });
});
