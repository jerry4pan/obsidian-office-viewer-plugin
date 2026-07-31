import { readFile } from "node:fs/promises";
import path from "node:path";
import { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { DocxFileView } from "../../src/docx/docx-file-view";
import { createDocxMessageTranslator } from "../../src/docx/docx-messages";
import { BoundedDocxRendererAdapter } from "../../src/docx/renderer/bounded-docx-renderer-adapter";
import type {
  DocxRendererAdapter,
  DocxRendererSession,
} from "../../src/docx/renderer/docx-renderer-adapter";

async function fixtureBuffer(name: string): Promise<ArrayBuffer> {
  const bytes = await readFile(
    path.resolve("tests/fixtures/docx-exploration", name),
  );
  return Uint8Array.from(bytes).buffer;
}

class SemanticTestRenderer implements DocxRendererAdapter {
  async open(
    _buffer: ArrayBuffer,
    container: HTMLElement,
    model: Parameters<DocxRendererAdapter["open"]>[2],
    signal: AbortSignal,
  ): Promise<DocxRendererSession> {
    signal.throwIfAborted();
    const mapping = new Map<number, HTMLElement>();
    const body = document.createElement("div");
    for (const paragraph of model.paragraphs) {
      const element = document.createElement("p");
      element.textContent = paragraph.text;
      element.dataset.docxParagraphOrdinal = String(paragraph.ordinal);
      mapping.set(paragraph.ordinal, element);
      body.append(element);
    }
    container.replaceChildren(body);
    return {
      candidate: "docx-preview",
      paragraphElements: mapping,
      warnings: [],
      revealParagraph: (ordinal) => mapping.get(ordinal) ?? null,
      dispose: () => body.remove(),
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
    expect(root.dataset.renderer).toBe("docx-preview");
    expect(root.textContent).toContain("This paragraph has a native identity.");
    expect(root.textContent).toContain(
      "This generated paragraph has no native identity.",
    );
    expect(root.textContent).not.toContain("stable source identities");
    expect(
      Array.from(root.querySelectorAll("button"), (item) => item.textContent),
    ).toEqual(["Open in default application"]);

    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = "generated paragraph";
    search.dispatchEvent(new Event("input"));
    const result = root.querySelector<HTMLButtonElement>(
      ".office-viewer-docx-search-result",
    )!;
    expect(result.textContent).toContain("Paragraph 2, matches: 1");
    result.click();
    expect(
      root
        .querySelector('[data-docx-paragraph-ordinal="2"]')
        ?.classList.contains("is-active-docx-paragraph"),
    ).toBe(true);
    expect(new Uint8Array(source)).toEqual(sourceBefore);
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

    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
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
  });
});
