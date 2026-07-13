import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PptxViewer } from "@aiden0z/pptx-renderer";
import { AidenPptxRendererAdapter } from "../../src/renderer/aiden-pptx-renderer-adapter";
import { PreflightPptxRendererAdapter } from "../../src/renderer/preflight-pptx-renderer-adapter";
import {
  expectedFailureFixtures,
  fixturePath,
} from "../failure/failure-fixtures";

async function loadFixture(
  relativePath = "tests/fixtures/minimal.pptx",
): Promise<ArrayBuffer> {
  const bytes = await readFile(path.resolve(relativePath));
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
      ).rejects.toMatchObject({
        name: "PptxOpenError",
        category: "incompatible",
        cause: failure,
      });
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

  for (const fixture of expectedFailureFixtures) {
    it(`reports ${fixture.id} as ${fixture.category} without leaving renderer DOM`, async () => {
      const container = document.createElement("div");
      container.textContent = "stale renderer output";

      await expect(
        new PreflightPptxRendererAdapter(new AidenPptxRendererAdapter()).open(
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
});
