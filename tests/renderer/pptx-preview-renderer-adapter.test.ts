import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PptxPreviewRendererAdapter } from "../../src/renderer/pptx-preview-renderer-adapter";
import { PreflightPptxRendererAdapter } from "../../src/renderer/preflight-pptx-renderer-adapter";
import {
  expectedFailureFixtures,
  fixturePath,
  safeRenderFixtures,
} from "../failure/failure-fixtures";

async function loadFixture(pathname: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path.resolve(pathname));
  return Uint8Array.from(bytes).buffer;
}

describe("PptxPreviewRendererAdapter", () => {
  it("exposes the candidate slide count after loading a presentation", async () => {
    const previewer = {
      slideCount: 3,
      load: vi.fn(async () => ({})),
      renderSingleSlide: vi.fn(),
      destroy: vi.fn(),
    };
    const createPreviewer = vi.fn(() => previewer);
    const adapter = new PptxPreviewRendererAdapter(createPreviewer);
    const buffer = new ArrayBuffer(8);
    const container = document.createElement("div");

    const session = await adapter.open(
      buffer,
      container,
      new AbortController().signal,
    );

    expect(session.slideCount).toBe(3);
    expect(createPreviewer).toHaveBeenCalledWith(container, {
      width: 960,
      height: 540,
      mode: "slide",
    });
    expect(previewer.load).toHaveBeenCalledWith(buffer);
  });

  it("fits the candidate viewport to the available Obsidian slide surface", async () => {
    const previewer = {
      slideCount: 1,
      load: vi.fn(async () => ({})),
      renderSingleSlide: vi.fn(),
      destroy: vi.fn(),
    };
    const createPreviewer = vi.fn(() => previewer);
    const container = document.createElement("div");
    Object.defineProperties(container, {
      clientWidth: { value: 632 },
      clientHeight: { value: 589 },
    });

    await new PptxPreviewRendererAdapter(createPreviewer).open(
      new ArrayBuffer(8),
      container,
      new AbortController().signal,
    );

    expect(createPreviewer).toHaveBeenCalledWith(container, {
      width: 632,
      height: 474,
      mode: "slide",
    });
  });

  it("passes zero-based slide indexes to the candidate", async () => {
    const previewer = {
      slideCount: 3,
      load: vi.fn(async () => ({})),
      renderSingleSlide: vi.fn(),
      destroy: vi.fn(),
    };
    const session = await new PptxPreviewRendererAdapter(() => previewer).open(
      new ArrayBuffer(8),
      document.createElement("div"),
      new AbortController().signal,
    );

    await session.renderSlide(0);
    await session.renderSlide(2);

    expect(previewer.renderSingleSlide).toHaveBeenNthCalledWith(1, 0);
    expect(previewer.renderSingleSlide).toHaveBeenNthCalledWith(2, 2);
  });

  it("restores the last readable slide when candidate navigation fails", async () => {
    const container = document.createElement("div");
    const previewer = {
      slideCount: 2,
      load: vi.fn(async () => ({})),
      renderSingleSlide: vi.fn((index: number) => {
        if (index === 1) {
          container.textContent = "renderer error placeholder";
          throw new Error("private renderer details");
        }
        container.textContent = "slide 1";
      }),
      destroy: vi.fn(),
    };
    const session = await new PptxPreviewRendererAdapter(() => previewer).open(
      new ArrayBuffer(8),
      container,
      new AbortController().signal,
    );
    await session.renderSlide(0);

    await expect(session.renderSlide(1)).rejects.toThrow(
      "The renderer could not display slide 2",
    );
    expect(previewer.renderSingleSlide).toHaveBeenNthCalledWith(3, 0);
    expect(container.textContent).toBe("slide 1");
  });

  it("falls back to a DOM snapshot when candidate rollback also fails", async () => {
    const container = document.createElement("div");
    let shouldFail = false;
    const previewer = {
      slideCount: 2,
      load: vi.fn(async () => ({})),
      renderSingleSlide: vi.fn((index: number) => {
        if (shouldFail) {
          container.textContent = "renderer error placeholder";
          throw new Error(`failed slide ${index}`);
        }
        container.textContent = "slide 1";
      }),
      destroy: vi.fn(),
    };
    const session = await new PptxPreviewRendererAdapter(() => previewer).open(
      new ArrayBuffer(8),
      container,
      new AbortController().signal,
    );
    await session.renderSlide(0);
    shouldFail = true;

    await expect(session.renderSlide(1)).rejects.toThrow(
      "The renderer could not display slide 2",
    );
    expect(container.textContent).toBe("slide 1");
  });

  it("disposes once, clears candidate DOM, and rejects later rendering", async () => {
    const container = document.createElement("div");
    const previewer = {
      slideCount: 1,
      load: vi.fn(async () => {
        container.append(document.createElement("section"));
      }),
      renderSingleSlide: vi.fn(),
      destroy: vi.fn(),
    };
    const session = await new PptxPreviewRendererAdapter(() => previewer).open(
      new ArrayBuffer(8),
      container,
      new AbortController().signal,
    );

    session.dispose();
    session.dispose();

    expect(previewer.destroy).toHaveBeenCalledOnce();
    expect(container.childElementCount).toBe(0);
    await expect(session.renderSlide(0)).rejects.toThrow(
      "PPTX renderer session has been disposed",
    );
  });

  it("rejects before allocating a previewer when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const createPreviewer = vi.fn();

    await expect(
      new PptxPreviewRendererAdapter(createPreviewer).open(
        new ArrayBuffer(8),
        document.createElement("div"),
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(createPreviewer).not.toHaveBeenCalled();
  });

  it("checks cancellation after load and cleans up without claiming interruption", async () => {
    const controller = new AbortController();
    const container = document.createElement("div");
    const previewer = {
      slideCount: 1,
      load: vi.fn(async () => {
        container.append(document.createElement("section"));
        controller.abort();
      }),
      renderSingleSlide: vi.fn(),
      destroy: vi.fn(),
    };

    await expect(
      new PptxPreviewRendererAdapter(() => previewer).open(
        new ArrayBuffer(8),
        container,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(previewer.load).toHaveBeenCalledOnce();
    expect(previewer.destroy).toHaveBeenCalledOnce();
    expect(container.childElementCount).toBe(0);
  });

  it("maps candidate parse failures to the stable incompatible category", async () => {
    const failure = new Error("candidate parse failed");
    const container = document.createElement("div");
    const previewer = {
      slideCount: 0,
      load: vi.fn(async () => {
        container.append(document.createElement("section"));
        throw failure;
      }),
      renderSingleSlide: vi.fn(),
      destroy: vi.fn(),
    };

    await expect(
      new PptxPreviewRendererAdapter(() => previewer).open(
        new ArrayBuffer(8),
        container,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      name: "PptxOpenError",
      category: "incompatible",
      cause: failure,
    });
    expect(previewer.destroy).toHaveBeenCalledOnce();
    expect(container.childElementCount).toBe(0);
  });

  it("rejects a loaded package without a usable slide", async () => {
    const previewer = {
      slideCount: 0,
      load: vi.fn(async () => ({})),
      renderSingleSlide: vi.fn(),
      destroy: vi.fn(),
    };

    await expect(
      new PptxPreviewRendererAdapter(() => previewer).open(
        new ArrayBuffer(8),
        document.createElement("div"),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      name: "PptxOpenError",
      category: "incompatible",
    });
    expect(previewer.destroy).toHaveBeenCalledOnce();
  });

  it("loads and renders a real PPTX through the package API", async () => {
    const container = document.createElement("div");
    const session = await new PptxPreviewRendererAdapter().open(
      await loadFixture("tests/fixtures/minimal.pptx"),
      container,
      new AbortController().signal,
    );

    expect(session.slideCount).toBe(1);
    await session.renderSlide(0);
    expect(container.textContent).toContain("Obsidian PPTX smoke test");

    session.dispose();
    expect(container.childElementCount).toBe(0);
  });

  it("classifies the representative performance fixture as incompatible", async () => {
    const container = document.createElement("div");

    await expect(
      new PptxPreviewRendererAdapter().open(
        await loadFixture(
          "tests/fixtures/performance/representative-12-slides.pptx",
        ),
        container,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      name: "PptxOpenError",
      category: "incompatible",
    });
    expect(container.childElementCount).toBe(0);
  });

  it("keeps adapter-owned DOM cleanup isolated between sessions", async () => {
    const firstContainer = document.createElement("div");
    const secondContainer = document.createElement("div");
    const createPreviewer = (container: HTMLElement) => ({
      slideCount: 1,
      load: vi.fn(async () => {
        container.append(document.createElement("section"));
      }),
      renderSingleSlide: vi.fn(),
      destroy: vi.fn(),
    });
    const firstPreviewer = createPreviewer(firstContainer);
    const secondPreviewer = createPreviewer(secondContainer);
    const factory = vi
      .fn()
      .mockReturnValueOnce(firstPreviewer)
      .mockReturnValueOnce(secondPreviewer);
    const adapter = new PptxPreviewRendererAdapter(factory);
    const firstSession = await adapter.open(
      new ArrayBuffer(8),
      firstContainer,
      new AbortController().signal,
    );
    const secondSession = await adapter.open(
      new ArrayBuffer(8),
      secondContainer,
      new AbortController().signal,
    );

    firstSession.dispose();

    expect(firstPreviewer.destroy).toHaveBeenCalledOnce();
    expect(firstContainer.childElementCount).toBe(0);
    expect(secondPreviewer.destroy).not.toHaveBeenCalled();
    expect(secondContainer.childElementCount).toBe(1);
    secondSession.dispose();
  });

  for (const fixture of expectedFailureFixtures) {
    it(`reports ${fixture.id} as ${fixture.category} after shared preflight`, async () => {
      const container = document.createElement("div");

      await expect(
        new PreflightPptxRendererAdapter(new PptxPreviewRendererAdapter()).open(
          await loadFixture(fixturePath(fixture)),
          container,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({
        name: "PptxOpenError",
        category: fixture.category,
      });
      expect(container.childElementCount).toBe(0);
      expect(container.textContent).toBe("");
    });
  }

  for (const fixture of safeRenderFixtures) {
    it(`renders preflight-safe fixture ${fixture.id} without external access`, async () => {
      const container = document.createElement("div");
      const session = await new PreflightPptxRendererAdapter(
        new PptxPreviewRendererAdapter(),
      ).open(
        await loadFixture(fixturePath(fixture)),
        container,
        new AbortController().signal,
      );

      await session.renderSlide(0);
      expect(session.slideCount).toBeGreaterThan(0);
      session.dispose();
      expect(container.childElementCount).toBe(0);
    });
  }
});
