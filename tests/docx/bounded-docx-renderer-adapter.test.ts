import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { DocxOpenError } from "../../src/docx/docx-open-error";
import { inspectDocxPackage } from "../../src/docx/docx-semantic-model";
import type { DocxSemanticModel } from "../../src/docx/docx-semantic-model";
import { BoundedDocxRendererAdapter } from "../../src/docx/renderer/bounded-docx-renderer-adapter";
import type {
  DocxRendererAdapter,
  DocxRendererSession,
} from "../../src/docx/renderer/docx-renderer-adapter";

async function stressFixture(): Promise<ArrayBuffer> {
  const bytes = await readFile(
    path.resolve(
      "tests/fixtures/docx-exploration/performance-stress-5000-paragraphs.docx",
    ),
  );
  return Uint8Array.from(bytes).buffer;
}

function readingSession(): DocxRendererSession {
  return {
    candidate: "docx-preview",
    mode: "reading",
    supportedModes: ["reading", "layout"],
    paragraphAnchors: new Map(),
    warnings: [],
    mount: () => undefined,
    revealParagraph: () => null,
    dispose: () => undefined,
  };
}

describe("bounded DOCX renderer", () => {
  it("never materializes the full stress document and can reveal a distant paragraph", async () => {
    const source = await stressFixture();
    const signal = new AbortController().signal;
    const model = await inspectDocxPackage(source, signal);
    const delegateOpen = vi.fn();
    const delegate = { open: delegateOpen } as unknown as DocxRendererAdapter;
    const renderer = new BoundedDocxRendererAdapter(delegate, {
      largeParagraphThreshold: 1_000,
      windowSize: 240,
    });
    const container = document.createElement("div");

    const session = await renderer.open(source, model, {
      mode: "reading",
      signal,
    });
    session.mount(container);

    expect(delegateOpen).not.toHaveBeenCalled();
    expect(session.mode).toBe("reading");
    expect(session.supportedModes).toEqual(["reading"]);
    expect(
      container.querySelectorAll("[data-docx-paragraph-ordinal]").length,
    ).toBeLessThanOrEqual(240);
    expect(container.querySelectorAll("*").length).toBeLessThanOrEqual(1_200);

    const distant = session.revealParagraph(4_999);
    expect(distant?.textContent).toContain("Stress paragraph 4999");
    expect(distant?.dataset.docxParagraphOrdinal).toBe("4999");
    expect(
      container.querySelectorAll("[data-docx-paragraph-ordinal]").length,
    ).toBeLessThanOrEqual(240);
    expect(container.querySelectorAll("*").length).toBeLessThanOrEqual(1_200);
  });

  it("rejects layout for large documents without calling the rich delegate", async () => {
    const source = await stressFixture();
    const signal = new AbortController().signal;
    const model = await inspectDocxPackage(source, signal);
    const delegateOpen = vi.fn();
    const renderer = new BoundedDocxRendererAdapter(
      { open: delegateOpen } as unknown as DocxRendererAdapter,
      { largeParagraphThreshold: 1_000, windowSize: 240 },
    );

    await expect(
      renderer.open(source, model, { mode: "layout", signal }),
    ).rejects.toBeInstanceOf(DocxOpenError);
    expect(delegateOpen).not.toHaveBeenCalled();
  });

  it("propagates small-document layout failures without faking success", async () => {
    const model: DocxSemanticModel = {
      paragraphs: [
        {
          ordinal: 1,
          text: "Only paragraph",
          searchText: "only paragraph",
          styleId: null,
          listItem: false,
          tableDepth: 0,
          bookmarks: [],
          hyperlinks: [],
          unavailableContent: [],
          inlineImageCount: 0,
        },
      ],
      bookmarkTargets: [],
      unavailableBodyBlocks: [],
      hasUnavailableBodyContent: false,
    };
    const delegateOpen = vi.fn(async () => {
      throw new DocxOpenError("incompatible", "layout failed");
    });
    const renderer = new BoundedDocxRendererAdapter(
      { open: delegateOpen } as unknown as DocxRendererAdapter,
      { largeParagraphThreshold: 1_000, windowSize: 240 },
    );

    await expect(
      renderer.open(new ArrayBuffer(0), model, {
        mode: "layout",
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(DocxOpenError);
    expect(delegateOpen).toHaveBeenCalledOnce();
  });

  it("falls back to reading-only support when preview is incompatible", async () => {
    const model: DocxSemanticModel = {
      paragraphs: [
        {
          ordinal: 1,
          text: "Only paragraph",
          searchText: "only paragraph",
          styleId: null,
          listItem: false,
          tableDepth: 0,
          bookmarks: [],
          hyperlinks: [],
          unavailableContent: [],
          inlineImageCount: 0,
        },
      ],
      bookmarkTargets: [],
      unavailableBodyBlocks: [],
      hasUnavailableBodyContent: false,
    };
    const renderer = new BoundedDocxRendererAdapter(
      {
        open: vi.fn(async () => {
          throw new DocxOpenError("incompatible", "preview failed");
        }),
      } as unknown as DocxRendererAdapter,
      { largeParagraphThreshold: 1_000, windowSize: 240 },
    );
    const container = document.createElement("div");
    const session = await renderer.open(new ArrayBuffer(0), model, {
      mode: "reading",
      signal: new AbortController().signal,
    });
    session.mount(container);
    expect(session.candidate).toBe("bounded-semantic");
    expect(session.supportedModes).toEqual(["reading"]);
    expect(session.warnings).toContain(
      "preview-unavailable-simplified-rendering",
    );
  });

  it("delegates ordinary documents in either mode", async () => {
    const model: DocxSemanticModel = {
      paragraphs: [
        {
          ordinal: 1,
          text: "Body",
          searchText: "body",
          styleId: null,
          listItem: false,
          tableDepth: 0,
          bookmarks: [],
          hyperlinks: [],
          unavailableContent: [],
          inlineImageCount: 0,
        },
      ],
      bookmarkTargets: [],
      unavailableBodyBlocks: [],
      hasUnavailableBodyContent: false,
    };
    const delegateOpen = vi.fn(async () => readingSession());
    const renderer = new BoundedDocxRendererAdapter(
      { open: delegateOpen } as unknown as DocxRendererAdapter,
      { largeParagraphThreshold: 1_000, windowSize: 240 },
    );
    await renderer.open(new ArrayBuffer(0), model, {
      mode: "layout",
      signal: new AbortController().signal,
    });
    expect(delegateOpen).toHaveBeenCalledOnce();
    const openArgs = delegateOpen.mock.calls[0] as
      | [ArrayBuffer, DocxSemanticModel, { mode: string }]
      | undefined;
    expect(openArgs?.[2]).toMatchObject({ mode: "layout" });
  });

  it("does not silently omit links, images, or unavailable body content", async () => {
    const paragraphs = Array.from({ length: 1_001 }, (_, index) => ({
      ordinal: index + 1,
      text: index === 1_000 ? "Read evidence and equation" : `Paragraph ${index + 1}`,
      searchText: index === 1_000 ? "read evidence and equation" : `paragraph ${index + 1}`,
      styleId: null,
      listItem: false,
      tableDepth: 0,
      bookmarks: [],
      hyperlinks: index === 1_000
        ? [{ kind: "external" as const, label: "evidence", target: "https://example.com/evidence" }]
        : [],
      unavailableContent: index === 1_000 ? ["equation" as const] : [],
      inlineImageCount: index === 1_000 ? 1 : 0,
    }));
    const model: DocxSemanticModel = {
      paragraphs,
      bookmarkTargets: [],
      unavailableBodyBlocks: [
        { afterParagraphOrdinal: 1_001, kinds: ["alt-chunk"] },
      ],
      hasUnavailableBodyContent: true,
    };
    const renderer = new BoundedDocxRendererAdapter(
      { open: vi.fn() } as unknown as DocxRendererAdapter,
      { largeParagraphThreshold: 1_000, windowSize: 240 },
    );
    const container = document.createElement("div");

    const session = await renderer.open(
      new ArrayBuffer(0),
      model,
      { mode: "reading", signal: new AbortController().signal },
    );
    session.mount(container);
    const distant = session.revealParagraph(1_001)!;

    const external = distant.querySelector<HTMLAnchorElement>(
      'a[data-docx-external-link="true"]',
    );
    expect(external?.textContent).toBe("evidence");
    expect(external?.href).toBe("https://example.com/evidence");
    expect(
      container.querySelectorAll(".office-viewer-docx-unavailable-content"),
    ).toHaveLength(3);
  });
});
