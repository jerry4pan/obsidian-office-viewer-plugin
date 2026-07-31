import { createCanvas, Image, ImageData } from "canvas";

type NodeCanvas = ReturnType<typeof createCanvas>;

function canvasDataUrl(
  canvas: NodeCanvas,
  type?: string,
  quality?: number,
): string {
  if (type === undefined) return canvas.toDataURL();
  return canvas.toDataURL(type as "image/png");
}

// jsdom has no canvas implementation; wire node-canvas for WMF→PNG conversion tests.
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value(this: HTMLCanvasElement, type: string) {
    if (type !== "2d") return null;
    const backing = createCanvas(this.width || 1, this.height || 1);
    const context = backing.getContext("2d");
    Object.defineProperty(this, "__nodeCanvas", {
      value: backing,
      configurable: true,
    });
    return context;
  },
});
Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
  value(this: HTMLCanvasElement, type?: string, quality?: number) {
    const backing = (this as HTMLCanvasElement & {
      __nodeCanvas?: NodeCanvas;
    }).__nodeCanvas;
    if (backing === undefined) {
      return canvasDataUrl(
        createCanvas(this.width || 1, this.height || 1),
        type,
        quality,
      );
    }
    // Keep dimensions in sync when wmf mutates canvas.width/height.
    if (backing.width !== this.width || backing.height !== this.height) {
      const resized = createCanvas(this.width || 1, this.height || 1);
      resized.getContext("2d").drawImage(backing, 0, 0);
      return canvasDataUrl(resized, type, quality);
    }
    return canvasDataUrl(backing, type, quality);
  },
});
(globalThis as unknown as { Image: typeof Image }).Image = Image;
(globalThis as unknown as { ImageData: typeof ImageData }).ImageData = ImageData;

class TestResizeObserver implements ResizeObserver {
  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
}

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0];

  disconnect(): void {}
  observe(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;
globalThis.IntersectionObserver = TestIntersectionObserver;

// Polyfill for Obsidian's createEl on HTMLElement.prototype
interface DomElementInfo {
  cls?: string;
  text?: string | DocumentFragment;
  attr?: Record<string, string | number | boolean>;
  title?: string;
  parent?: Node;
  value?: string;
  type?: string;
  href?: string;
  placeholder?: string;
  prepend?: boolean;
}

function applyDomElementInfo(el: HTMLElement, options?: DomElementInfo | string): void {
  if (options === undefined) return;
  if (typeof options === "string") {
    el.className = options;
    return;
  }
  if (options.cls) el.className = options.cls;
  if (options.text !== undefined) {
    el.textContent =
      options.text instanceof DocumentFragment ? "" : options.text;
  }
  if (options.attr) {
    for (const [key, val] of Object.entries(options.attr)) {
      el.setAttribute(key, String(val));
    }
  }
  if (options.title) el.title = options.title;
  if (
    options.type &&
    (el instanceof HTMLButtonElement || el instanceof HTMLInputElement)
  ) {
    (el as HTMLInputElement).type = options.type;
  }
  if (options.value !== undefined && el instanceof HTMLInputElement) {
    el.value = options.value;
  }
  if (options.href && el instanceof HTMLAnchorElement) {
    el.href = options.href;
  }
  if (
    options.placeholder &&
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
  ) {
    (el as HTMLInputElement).placeholder = options.placeholder;
  }
}

function createDetachedEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: DomElementInfo | string,
  callback?: (el: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag) as HTMLElementTagNameMap[K];
  applyDomElementInfo(el as HTMLElement, options);
  if (callback) callback(el);
  return el;
}

(HTMLElement.prototype as any).createEl = function <K extends keyof HTMLElementTagNameMap>(
  this: HTMLElement,
  tag: K,
  options?: DomElementInfo | string,
  callback?: (el: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
  const el = createDetachedEl(tag, options, callback);
  const prepend =
    typeof options === "object" && options !== null && options.prepend;
  if (prepend) {
    this.prepend(el);
  } else {
    this.append(el);
  }
  return el;
};

(HTMLElement.prototype as any).createDiv = function (
  this: HTMLElement,
  options?: DomElementInfo | string,
  callback?: (el: HTMLDivElement) => void,
): HTMLDivElement {
  return this.createEl("div", options, callback);
};

(HTMLElement.prototype as any).createSpan = function (
  this: HTMLElement,
  options?: DomElementInfo | string,
  callback?: (el: HTMLSpanElement) => void,
): HTMLSpanElement {
  return this.createEl("span", options, callback);
};

// Global Obsidian helpers create detached elements (no automatic append).
(globalThis as any).createEl = createDetachedEl;
(globalThis as any).createDiv = function (
  options?: DomElementInfo | string,
  callback?: (el: HTMLDivElement) => void,
): HTMLDivElement {
  return createDetachedEl("div", options, callback);
};
(globalThis as any).createSpan = function (
  options?: DomElementInfo | string,
  callback?: (el: HTMLSpanElement) => void,
): HTMLSpanElement {
  return createDetachedEl("span", options, callback);
};

// Polyfill for Obsidian's setCssStyles on HTMLElement.prototype
(HTMLElement.prototype as any).setCssStyles = function (
  this: HTMLElement,
  styles: Record<string, string>,
): void {
  for (const [property, value] of Object.entries(styles)) {
    (this.style as any)[property] = value;
  }
};
