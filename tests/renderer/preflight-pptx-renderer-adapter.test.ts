import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreflightPptxRendererAdapter } from "../../src/renderer/preflight-pptx-renderer-adapter";
import type { PptxRendererAdapter } from "../../src/renderer/pptx-renderer-adapter";
import {
  expectedFailureFixtures,
  fixturePath,
} from "../failure/failure-fixtures";

async function loadFixture(id: string): Promise<ArrayBuffer> {
  const fixture = expectedFailureFixtures.find((entry) => entry.id === id)!;
  const bytes = await readFile(path.resolve(fixturePath(fixture)));
  return Uint8Array.from(bytes).buffer;
}

describe("PreflightPptxRendererAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("caches local font measurements across repeated opens", async () => {
    const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.style.fontFamily.startsWith('"') &&
            !this.style.fontFamily.includes("Definitely Missing Font")
          ? 120
          : 100;
      });
    const bytes = Uint8Array.from(await readFile(path.resolve(
      "tests/fixtures/compatibility/text-theme-wide.pptx",
    ))).buffer;
    const session = {
      slideCount: 1,
      slideWidth: 960,
      slideHeight: 540,
      capabilities: { thumbnails: false, prefetch: false },
      renderSlide: vi.fn(async () => {}),
      dispose: vi.fn(),
    };
    const adapter = new PreflightPptxRendererAdapter({
      open: vi.fn(async () => session),
    });

    const first = await adapter.open(
      bytes,
      document.createElement("div"),
      new AbortController().signal,
    );
    const second = await adapter.open(
      bytes,
      document.createElement("div"),
      new AbortController().signal,
    );

    expect(first.compatibilityWarnings).toEqual([]);
    expect(first.detectCompatibilityWarnings?.()).toEqual([
      "font-substitution",
    ]);
    const firstMeasurementCount = width.mock.calls.length;
    expect(second.detectCompatibilityWarnings?.()).toEqual([
      "font-substitution",
    ]);
    expect(firstMeasurementCount).toBeGreaterThan(0);
    expect(width).toHaveBeenCalledTimes(firstMeasurementCount);
  });

  it("forwards candidate-neutral M2 session capabilities unchanged", async () => {
    const renderThumbnail = vi.fn();
    const prefetchSlide = vi.fn(async () => {});
    const session = {
      slideCount: 1,
      slideWidth: 960,
      slideHeight: 540,
      capabilities: { thumbnails: true, prefetch: true },
      renderSlide: vi.fn(async () => {}),
      renderThumbnail,
      prefetchSlide,
      dispose: vi.fn(),
    };
    const candidate: PptxRendererAdapter = {
      open: vi.fn(async () => session),
    };
    const safeBuffer = Uint8Array.from(
      await readFile(path.resolve("tests/fixtures/minimal.pptx")),
    ).buffer;

    const result = await new PreflightPptxRendererAdapter(candidate).open(
      safeBuffer,
      document.createElement("div"),
      new AbortController().signal,
    );

    expect(result.slideWidth).toBe(960);
    expect(result.slideHeight).toBe(540);
    expect(result.slideIdentities).toEqual([256]);
    expect(result.sourceAuthoredSlideText).toEqual([{
      slideId: 256,
      text: ["Obsidian PPTX smoke test"],
    }]);
    expect(result.speakerNoteContent).toEqual([{
      slideId: 256,
      paragraphs: [],
    }]);
    expect(result.capabilities).toEqual(session.capabilities);
    result.renderThumbnail?.(0, document.createElement("div"), new AbortController().signal);
    await result.prefetchSlide?.(0, new AbortController().signal);
    expect(renderThumbnail).toHaveBeenCalledOnce();
    expect(prefetchSlide).toHaveBeenCalledOnce();
    expect(result.compatibilityWarnings).toEqual([]);
  });

  it("forwards speaker-note content from project-owned package inspection", async () => {
    const session = {
      slideCount: 3,
      slideWidth: 960,
      slideHeight: 540,
      capabilities: { thumbnails: false, prefetch: false },
      renderSlide: vi.fn(async () => {}),
      dispose: vi.fn(),
    };
    const candidate: PptxRendererAdapter = {
      open: vi.fn(async () => session),
    };
    const buffer = Uint8Array.from(
      await readFile(path.resolve("tests/fixtures/speaker-notes.pptx")),
    ).buffer;

    const result = await new PreflightPptxRendererAdapter(candidate).open(
      buffer,
      document.createElement("div"),
      new AbortController().signal,
    );

    expect(result.slideIdentities).toEqual([256, 257, 258]);
    expect(result.speakerNoteContent).toEqual([
      {
        slideId: 256,
        paragraphs: [
          "AUTHOR_NOTE_P1 First author paragraph",
          "AUTHOR_NOTE_P2 Second author paragraph",
          "讲者备注标记 NOTE_ZH_HANS",
          "講者備註標記 NOTE_ZH_HANT",
        ],
      },
      { slideId: 257, paragraphs: [] },
      { slideId: 258, paragraphs: [] },
    ]);
    expect(Object.prototype.hasOwnProperty.call(result, "speakerNoteContent"))
      .toBe(true);
  });

  it("rejects a candidate whose slide count disagrees with inspected identities", async () => {
    const dispose = vi.fn();
    const candidate: PptxRendererAdapter = {
      open: vi.fn(async () => ({
        slideCount: 2,
        slideWidth: 960,
        slideHeight: 540,
        capabilities: { thumbnails: false, prefetch: false },
        renderSlide: vi.fn(async () => {}),
        dispose,
      })),
    };
    const safeBuffer = Uint8Array.from(
      await readFile(path.resolve("tests/fixtures/minimal.pptx")),
    ).buffer;

    await expect(
      new PreflightPptxRendererAdapter(candidate).open(
        safeBuffer,
        document.createElement("div"),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "incompatible" });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("blocks active content before invoking a candidate renderer", async () => {
    const candidate: PptxRendererAdapter = { open: vi.fn() };

    await expect(
      new PreflightPptxRendererAdapter(candidate).open(
        await loadFixture("active-content"),
        document.createElement("div"),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "incompatible" });
    expect(candidate.open).not.toHaveBeenCalled();
  });

  it("blocks the shared single-entry limit before invoking a candidate", async () => {
    const candidate: PptxRendererAdapter = {
      open: vi.fn(),
    };

    await expect(
      new PreflightPptxRendererAdapter(candidate).open(
        await loadFixture("renderer-resource-limit"),
        document.createElement("div"),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "resource-exhausted" });
    expect(candidate.open).not.toHaveBeenCalled();
  });
});
