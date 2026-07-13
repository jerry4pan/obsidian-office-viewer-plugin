import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PptxViewer } from "@aiden0z/pptx-renderer";
import { AidenPptxRendererAdapter } from "../../src/renderer/aiden-pptx-renderer-adapter";

async function loadFixture(): Promise<ArrayBuffer> {
  const bytes = await readFile(path.resolve("tests/fixtures/minimal.pptx"));
  return Uint8Array.from(bytes).buffer;
}

describe("AidenPptxRendererAdapter", () => {
  it("renders slide 1 from a real PPTX and disposes its DOM", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const adapter = new AidenPptxRendererAdapter();

    const session = await adapter.open(
      await loadFixture(),
      container,
      new AbortController().signal,
    );

    expect(session.slideCount).toBe(1);
    await session.renderSlide(0);
    expect(container.textContent).toContain("Obsidian PPTX smoke test");

    session.dispose();
    expect(container.childElementCount).toBe(0);
  });

  it("rejects before parsing when the caller already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      new AidenPptxRendererAdapter().open(
        await loadFixture(),
        document.createElement("div"),
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("destroys an allocated viewer exactly once when instance open rejects", async () => {
    const failure = new Error("parse failed");
    const open = vi.spyOn(PptxViewer.prototype, "open").mockRejectedValue(failure);
    const destroy = vi
      .spyOn(PptxViewer.prototype, "destroy")
      .mockImplementation(() => {});

    try {
      await expect(
        new AidenPptxRendererAdapter().open(
          await loadFixture(),
          document.createElement("div"),
          new AbortController().signal,
        ),
      ).rejects.toBe(failure);
      expect(open).toHaveBeenCalledOnce();
      expect(destroy).toHaveBeenCalledOnce();
    } finally {
      open.mockRestore();
      destroy.mockRestore();
    }
  });

  it("destroys an allocated viewer exactly once when abort wins after open", async () => {
    const controller = new AbortController();
    const open = vi
      .spyOn(PptxViewer.prototype, "open")
      .mockImplementation(async () => {
        controller.abort();
      });
    const destroy = vi
      .spyOn(PptxViewer.prototype, "destroy")
      .mockImplementation(() => {});

    try {
      await expect(
        new AidenPptxRendererAdapter().open(
          await loadFixture(),
          document.createElement("div"),
          controller.signal,
        ),
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(open).toHaveBeenCalledOnce();
      expect(destroy).toHaveBeenCalledOnce();
    } finally {
      open.mockRestore();
      destroy.mockRestore();
    }
  });
});
