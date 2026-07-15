import { describe, expect, it, vi } from "vitest";
import { createMessageTranslator } from "../src/i18n";
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
  it.each([
    ["en", "Resize slide thumbnails", "Drag to resize thumbnails; double-click to reset", "180 pixels"],
    ["zh-CN", "调整幻灯片缩略图大小", "拖动以调整缩略图大小；双击以重置", "180 像素"],
    ["zh-TW", "調整投影片縮圖大小", "拖曳以調整縮圖大小；按兩下以重設", "180 像素"],
  ] as const)(
    "renders accessible resize text for %s",
    (language, label, title, value) => {
      const host = document.createElement("div");
      const railElement = document.createElement("nav");
      Object.defineProperty(host, "clientWidth", { value: 400 });
      const rail = {
        beginResize: vi.fn(),
        setThumbnailWidth: vi.fn(),
      } as unknown as ThumbnailRail;
      const resizer = new ThumbnailRailResizer(host, railElement, rail, {
        messages: createMessageTranslator(language),
        preferredWidth: 400,
        createResizeObserver: () => ({ observe: vi.fn(), disconnect: vi.fn() }),
      });

      expect(resizer.element.getAttribute("aria-label")).toBe(label);
      expect(resizer.element.title).toBe(title);
      expect(resizer.element.getAttribute("aria-valuetext")).toBe(value);

      resizer.dispose();
    },
  );

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
