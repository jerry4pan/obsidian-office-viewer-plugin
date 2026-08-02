import { readFile } from "node:fs/promises";
import path from "node:path";
import { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { DocxFileView } from "../../src/docx/docx-file-view";
import { createDocxMessageTranslator } from "../../src/docx/docx-messages";
import { DocxOpenError } from "../../src/docx/docx-open-error";
import { BoundedDocxRendererAdapter } from "../../src/docx/renderer/bounded-docx-renderer-adapter";
import type {
  DocxRendererAdapter,
  DocxRendererSession,
  DocxViewMode,
} from "../../src/docx/renderer/docx-renderer-adapter";

async function fixtureBuffer(name: string): Promise<ArrayBuffer> {
  const bytes = await readFile(
    path.resolve("tests/fixtures/docx-exploration", name),
  );
  return Uint8Array.from(bytes).buffer;
}

class SemanticTestRenderer implements DocxRendererAdapter {
  openCalls = 0;
  lastMode: DocxViewMode | null = null;
  private failLayout = false;

  setFailLayout(value: boolean): void {
    this.failLayout = value;
  }

  async open(
    _buffer: ArrayBuffer,
    model: Parameters<DocxRendererAdapter["open"]>[1],
    options: Parameters<DocxRendererAdapter["open"]>[2],
  ): Promise<DocxRendererSession> {
    options.signal.throwIfAborted();
    this.openCalls += 1;
    this.lastMode = options.mode;
    if (options.mode === "layout" && this.failLayout) {
      throw new DocxOpenError("incompatible", "layout failed");
    }

    const mapping = new Map<number, HTMLElement>();
    const body = document.createElement("div");
    body.className =
      options.mode === "layout"
        ? "office-viewer-docx office-viewer-docx--layout"
        : "office-viewer-docx office-viewer-docx--reading";
    for (const paragraph of model.paragraphs) {
      const element = document.createElement("p");
      element.textContent = paragraph.text;
      element.dataset.docxParagraphOrdinal = String(paragraph.ordinal);
      mapping.set(paragraph.ordinal, element);
      body.append(element);
    }

    let mountedContainer: HTMLElement | null = null;
    let disposed = false;
    return {
      candidate: "docx-preview",
      mode: options.mode,
      supportedModes: ["reading", "layout"],
      paragraphAnchors: mapping,
      warnings: [],
      mount: (container) => {
        mountedContainer = container;
        container.replaceChildren(body);
      },
      revealParagraph: (ordinal) => mapping.get(ordinal) ?? null,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        if (
          mountedContainer !== null &&
          body.parentElement === mountedContainer
        ) {
          mountedContainer.replaceChildren();
        } else {
          body.remove();
        }
      },
    };
  }
}

describe("DOCX reading and search view", () => {
  it("reads and searches a document without paragraph reference controls", async () => {
    const source = await fixtureBuffer("read-search-only.docx");
    const sourceBefore = new Uint8Array(source).slice();
    const app = {
      scope: undefined,
      vault: { readBinary: vi.fn(async () => source) },
    };
    const view = new DocxFileView(
      { app } as never,
      {
        renderer: new SemanticTestRenderer(),
        messages: createDocxMessageTranslator("en"),
      },
    );
    const file = Object.assign(new TFile(), {
      path: "docx-exploration/read-search-only.docx",
      basename: "read-search-only",
      extension: "docx",
      stat: { size: source.byteLength, mtime: 1 },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });

    await view.onLoadFile(file);

    const root = view.contentEl.querySelector<HTMLElement>(
      ".office-viewer-docx-shell",
    )!;
    expect(root.dataset.state).toBe("ready");
    expect(root.dataset.viewMode).toBe("reading");
    expect(root.dataset.renderer).toBe("docx-preview");
    expect(
      root
        .querySelector('[data-action="docx-view-mode-reading"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      root
        .querySelector('[data-action="docx-view-mode-layout"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("false");
    expect(root.textContent).toContain("This paragraph has a native identity.");
    expect(root.textContent).toContain(
      "This generated paragraph has no native identity.",
    );
    expect(root.textContent).not.toContain("stable source identities");
    expect(
      root.querySelector('[data-action="open-docx-search"]'),
    ).not.toBeNull();
    expect(
      root.querySelector('[data-action="open-externally"]')
        ?.textContent,
    ).toBe("Open in default application");
    const brand = root.querySelector("[data-office-viewer-brand]")!;
    expect(brand).not.toBeNull();
    expect(brand.querySelector(".office-viewer-brand__product")?.textContent)
      .toBe("Office Viewer");
    expect(brand.querySelector(".office-viewer-brand__format")?.textContent)
      .toBe("DOCX");
    expect(brand.querySelector(".office-viewer-brand__creator")).toBeNull();
    expect(
      root.querySelector(".office-viewer-toolbar__primary")
        ?.previousElementSibling,
    ).toBe(brand);

    root
      .querySelector<HTMLButtonElement>('[data-action="open-docx-search"]')!
      .click();
    expect(root.dataset.searchOpen).toBe("true");
    const search = root.querySelector<HTMLInputElement>(
      '[data-action="docx-search-input"]',
    )!;
    search.value = "generated paragraph";
    search.dispatchEvent(new Event("input"));
    const result = root.querySelector<HTMLButtonElement>(
      ".office-viewer-docx-search-result",
    )!;
    expect(result.getAttribute("aria-label")).toContain(
      "Paragraph 2, matches: 1",
    );
    expect(result.textContent).toContain("generated paragraph");
    result.click();
    expect(
      root
        .querySelector('[data-docx-paragraph-ordinal="2"]')
        ?.classList.contains("is-active-docx-paragraph"),
    ).toBe(true);
    expect(result.getAttribute("aria-current")).toBe("location");
    expect(new Uint8Array(source)).toEqual(sourceBefore);
  });

  it("switches to layout using the retained safe buffer", async () => {
    const source = await fixtureBuffer("read-search-only.docx");
    const sourceBefore = new Uint8Array(source).slice();
    const readBinary = vi.fn(async () => source);
    const renderer = new SemanticTestRenderer();
    const app = {
      scope: undefined,
      vault: { readBinary },
    };
    const view = new DocxFileView(
      { app } as never,
      {
        renderer,
        messages: createDocxMessageTranslator("en"),
      },
    );
    const file = Object.assign(new TFile(), {
      path: "docx-exploration/read-search-only.docx",
      basename: "read-search-only",
      extension: "docx",
      stat: { size: source.byteLength, mtime: 1 },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });

    await view.onLoadFile(file);
    const root = view.contentEl.querySelector<HTMLElement>(
      ".office-viewer-docx-shell",
    )!;
    expect(renderer.openCalls).toBe(1);
    root
      .querySelector<HTMLButtonElement>('[data-action="docx-view-mode-layout"]')!
      .click();
    await vi.waitFor(() => {
      expect(root.dataset.viewMode).toBe("layout");
    });
    expect(readBinary).toHaveBeenCalledTimes(1);
    expect(renderer.openCalls).toBe(2);
    expect(renderer.lastMode).toBe("layout");
    expect(root.querySelectorAll(".office-viewer-docx")).toHaveLength(1);
    expect(
      root
        .querySelector('[data-action="docx-view-mode-layout"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(new Uint8Array(source)).toEqual(sourceBefore);
  });

  it("keeps the previous view when layout switching fails", async () => {
    const source = await fixtureBuffer("read-search-only.docx");
    const renderer = new SemanticTestRenderer();
    const app = {
      scope: undefined,
      vault: { readBinary: vi.fn(async () => source) },
    };
    const view = new DocxFileView(
      { app } as never,
      {
        renderer,
        messages: createDocxMessageTranslator("en"),
      },
    );
    const file = Object.assign(new TFile(), {
      path: "docx-exploration/read-search-only.docx",
      basename: "read-search-only",
      extension: "docx",
      stat: { size: source.byteLength, mtime: 1 },
    });
    await view.onLoadFile(file);
    const root = view.contentEl.querySelector<HTMLElement>(
      ".office-viewer-docx-shell",
    )!;
    expect(root.querySelector(".office-viewer-docx--reading")).not.toBeNull();
    renderer.setFailLayout(true);
    root
      .querySelector<HTMLButtonElement>('[data-action="docx-view-mode-layout"]')!
      .click();
    await vi.waitFor(() => {
      expect(root.querySelector(".office-viewer-docx-action-status")?.textContent)
        .toContain("Unable to switch document view");
    });
    expect(root.dataset.viewMode).toBe("reading");
    expect(root.querySelector(".office-viewer-docx--reading")).not.toBeNull();
    expect(root.dataset.state).toBe("ready");
  });

  it("exposes a stable local error state without changing the source", async () => {
    const source = Uint8Array.from([1, 2, 3, 4]).buffer;
    const sourceBefore = new Uint8Array(source).slice();
    const app = {
      scope: undefined,
      vault: { readBinary: vi.fn(async () => source) },
    };
    const view = new DocxFileView(
      { app } as never,
      {
        renderer: new SemanticTestRenderer(),
        messages: createDocxMessageTranslator("en"),
        openInDefaultApplication: vi.fn(async () => undefined),
      },
    );
    const file = Object.assign(new TFile(), {
      path: "broken.docx",
      basename: "broken",
      extension: "docx",
      stat: { size: source.byteLength, mtime: 1 },
    });

    await view.onLoadFile(file);

    const root = view.contentEl.querySelector<HTMLElement>(
      ".office-viewer-docx-shell",
    )!;
    expect(root.dataset.state).toBe("error");
    expect(root.dataset.errorCategory).toBe("malformed");
    expect(root.querySelector(".office-viewer-error")).not.toBeNull();
    expect(
      root.querySelector<HTMLButtonElement>(
        '[data-action="docx-view-mode-layout"]',
      )?.disabled,
    ).toBe(true);
    expect(root.querySelector('[data-action="retry"]')?.textContent).toBe(
      "Retry",
    );
    expect(root.querySelector('[data-action="open-externally"]')?.textContent)
      .toBe("Open in default application");
    expect(root.querySelectorAll("[data-office-viewer-brand]")).toHaveLength(1);
    expect(
      root.querySelector(".office-viewer-brand__format")?.textContent,
    ).toBe("DOCX");
    expect(root.textContent).toContain("original DOCX file was not modified");
    expect(new Uint8Array(source)).toEqual(sourceBefore);
  });

  it("searches and reveals a distant result while keeping stress DOM bounded", async () => {
    const source = await fixtureBuffer(
      "performance-stress-5000-paragraphs.docx",
    );
    const app = {
      scope: undefined,
      vault: { readBinary: vi.fn(async () => source) },
    };
    const renderer = new BoundedDocxRendererAdapter(
      { open: vi.fn() } as unknown as DocxRendererAdapter,
      { largeParagraphThreshold: 1_000, windowSize: 240 },
    );
    const view = new DocxFileView(
      { app } as never,
      {
        renderer,
        messages: createDocxMessageTranslator("en"),
      },
    );
    const file = Object.assign(new TFile(), {
      path: "docx-exploration/performance-stress-5000-paragraphs.docx",
      basename: "performance-stress-5000-paragraphs",
      extension: "docx",
      stat: { size: source.byteLength, mtime: 1 },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });

    await view.onLoadFile(file);
    const root = view.contentEl.querySelector<HTMLElement>(
      ".office-viewer-docx-shell",
    )!;
    expect(root.textContent).toContain(
      "This large document is shown in a simplified reading mode.",
    );
    expect(
      root.querySelectorAll(".office-viewer-docx-reading-body *").length,
    ).toBeLessThanOrEqual(1_200);
    expect(
      root.querySelector<HTMLButtonElement>(
        '[data-action="docx-view-mode-layout"]',
      )?.disabled,
    ).toBe(true);

    root
      .querySelector<HTMLButtonElement>('[data-action="open-docx-search"]')!
      .click();
    const search = root.querySelector<HTMLInputElement>(
      '[data-action="docx-search-input"]',
    )!;
    search.value = "Stress paragraph 4999:";
    search.dispatchEvent(new Event("input"));
    root
      .querySelector<HTMLButtonElement>(".office-viewer-docx-search-result")!
      .click();

    const active = root.querySelector<HTMLElement>(
      '[data-docx-paragraph-ordinal="4999"]',
    );
    expect(active?.classList.contains("is-active-docx-paragraph")).toBe(true);
    expect(
      root.querySelectorAll(".office-viewer-docx-reading-body *").length,
    ).toBeLessThanOrEqual(1_200);
  }, 30_000);
});
