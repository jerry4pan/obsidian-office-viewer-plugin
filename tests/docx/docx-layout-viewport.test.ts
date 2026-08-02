import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateDocxLayoutScale,
  DocxLayoutViewport,
} from "../../src/docx/renderer/docx-layout-viewport";

const OriginalResizeObserver = globalThis.ResizeObserver;

afterEach(() => {
  globalThis.ResizeObserver = OriginalResizeObserver;
});

function setClientWidth(element: HTMLElement, width: number): void {
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: width,
  });
}

function createPage(widthPx: number): HTMLElement {
  const page = document.createElement("section");
  page.className = "docx";
  page.style.width = `${widthPx}px`;
  return page;
}

function createFixture(pageWidths: number[], availableWidth: number): {
  container: HTMLElement;
  pagesRoot: HTMLElement;
} {
  const container = document.createElement("div");
  const pagesRoot = document.createElement("div");
  for (const width of pageWidths) {
    pagesRoot.append(createPage(width));
  }
  container.append(pagesRoot);
  setClientWidth(container, availableWidth);
  document.body.append(container);
  return { container, pagesRoot };
}

describe("calculateDocxLayoutScale", () => {
  it("scales 800px page into 760px available width to 0.95", () => {
    expect(calculateDocxLayoutScale(760, 800)).toBe(0.95);
  });

  it("clamps 800px page in 300px available width to 0.65", () => {
    expect(calculateDocxLayoutScale(300, 800)).toBe(0.65);
  });

  it("does not upscale a 500px page in 600px available width", () => {
    expect(calculateDocxLayoutScale(600, 500)).toBe(1);
  });
});

describe("DocxLayoutViewport", () => {
  it("uses the widest page as the unified scale baseline", () => {
    globalThis.ResizeObserver = class implements ResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}
      disconnect(): void {}
      observe(): void {}
      unobserve(): void {}
    };

    const { container, pagesRoot } = createFixture([600, 800, 700], 760);
    const viewport = new DocxLayoutViewport({ container, pagesRoot });
    viewport.start();

    expect(container.style.getPropertyValue("--office-viewer-docx-layout-scale")).toBe(
      "0.95",
    );
    expect(container.dataset.layoutScale).toBe("0.95");
    for (const page of pagesRoot.querySelectorAll<HTMLElement>("section.docx")) {
      expect(page.style.zoom).toBe("0.95");
    }

    viewport.dispose();
    container.remove();
  });

  it("updates the CSS variable when the reading body resizes", () => {
    let resize!: ResizeObserverCallback;
    const disconnect = vi.fn();
    const observe = vi.fn();
    globalThis.ResizeObserver = class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      disconnect = disconnect;
      observe = observe;
      unobserve(): void {}
    };

    const { container, pagesRoot } = createFixture([800], 760);
    const viewport = new DocxLayoutViewport({ container, pagesRoot });
    viewport.start();

    expect(observe).toHaveBeenCalledWith(container);
    expect(container.style.getPropertyValue("--office-viewer-docx-layout-scale")).toBe(
      "0.95",
    );

    setClientWidth(container, 300);
    resize([], {} as ResizeObserver);

    expect(container.style.getPropertyValue("--office-viewer-docx-layout-scale")).toBe(
      "0.65",
    );
    expect(container.dataset.layoutScale).toBe("0.65");
    expect(
      pagesRoot.querySelector<HTMLElement>("section.docx")?.style.zoom,
    ).toBe("0.65");

    viewport.dispose();
    expect(disconnect).toHaveBeenCalledTimes(1);
    container.remove();
  });

  it("falls back to scale 1 without throwing when pages are missing", () => {
    globalThis.ResizeObserver = class implements ResizeObserver {
      disconnect(): void {}
      observe(): void {}
      unobserve(): void {}
    };

    const { container, pagesRoot } = createFixture([], 760);
    const viewport = new DocxLayoutViewport({ container, pagesRoot });

    expect(() => viewport.start()).not.toThrow();
    expect(container.style.getPropertyValue("--office-viewer-docx-layout-scale")).toBe(
      "1",
    );
    expect(container.dataset.layoutScale).toBe("1");

    viewport.dispose();
    container.remove();
  });

  it("falls back to scale 1 without throwing when ResizeObserver is missing", () => {
    // @ts-expect-error intentional absence for fallback coverage
    delete globalThis.ResizeObserver;

    const { container, pagesRoot } = createFixture([800], 760);
    const viewport = new DocxLayoutViewport({ container, pagesRoot });

    expect(() => viewport.start()).not.toThrow();
    expect(container.style.getPropertyValue("--office-viewer-docx-layout-scale")).toBe(
      "1",
    );
    expect(container.dataset.layoutScale).toBe("1");
    expect(
      pagesRoot.querySelector<HTMLElement>("section.docx")?.style.zoom,
    ).toBe("1");

    expect(() => viewport.dispose()).not.toThrow();
    container.remove();
  });

  it("stops applying resize updates after dispose", () => {
    let resize!: ResizeObserverCallback;
    const disconnect = vi.fn();
    globalThis.ResizeObserver = class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      disconnect = disconnect;
      observe(): void {}
      unobserve(): void {}
    };

    const { container, pagesRoot } = createFixture([800], 760);
    const viewport = new DocxLayoutViewport({ container, pagesRoot });
    viewport.start();
    expect(container.dataset.layoutScale).toBe("0.95");

    viewport.dispose();
    expect(disconnect).toHaveBeenCalledTimes(1);

    setClientWidth(container, 300);
    resize([], {} as ResizeObserver);

    expect(container.style.getPropertyValue("--office-viewer-docx-layout-scale")).toBe(
      "0.95",
    );
    expect(container.dataset.layoutScale).toBe("0.95");
    expect(
      pagesRoot.querySelector<HTMLElement>("section.docx")?.style.zoom,
    ).toBe("0.95");

    container.remove();
  });
});
