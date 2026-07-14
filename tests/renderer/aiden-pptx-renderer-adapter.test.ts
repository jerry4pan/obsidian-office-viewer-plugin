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

  it("turns an internally handled first-slide error into a blocking open error", async () => {
    const open = vi.spyOn(PptxViewer.prototype, "open").mockImplementation(
      async function (this: PptxViewer) {
        this.dispatchEvent(
          new CustomEvent("slideerror", {
            detail: { index: 0, error: new Error("private renderer details") },
          }),
        );
      },
    );

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
        message: "The renderer could not display the first slide",
      });
    } finally {
      open.mockRestore();
    }
  });

  it("restores the visible slide when navigation rendering reports an internal failure", async () => {
    const container = document.createElement("div");
    const session = await new AidenPptxRendererAdapter().open(
      await loadFixture(),
      container,
      new AbortController().signal,
    );
    await session.renderSlide(0);
    const readableContent = container.textContent;
    let attempt = 0;
    const renderSlide = vi
      .spyOn(PptxViewer.prototype, "renderSlide")
      .mockImplementation(async function (this: PptxViewer) {
        attempt += 1;
        if (attempt === 1) {
          container.textContent = "renderer error placeholder";
          this.dispatchEvent(
            new CustomEvent("slideerror", {
              detail: { index: 0, error: new Error("private renderer details") },
            }),
          );
          return;
        }
        container.textContent = readableContent;
      });

    try {
      await expect(session.renderSlide(0)).rejects.toThrow(
        "The renderer could not display slide 1",
      );
      expect(container.textContent).toBe(readableContent);
      expect(container.textContent).toContain("Obsidian PPTX smoke test");
    } finally {
      expect(renderSlide).toHaveBeenCalledTimes(2);
      renderSlide.mockRestore();
      session.dispose();
    }
  });

  it("falls back to a DOM snapshot when both navigation and rollback fail", async () => {
    const container = document.createElement("div");
    const session = await new AidenPptxRendererAdapter().open(
      await loadFixture(),
      container,
      new AbortController().signal,
    );
    await session.renderSlide(0);
    const readableContent = container.textContent;
    const renderSlide = vi
      .spyOn(PptxViewer.prototype, "renderSlide")
      .mockImplementation(async () => {
        container.textContent = "renderer error placeholder";
        throw new Error("private renderer details");
      });

    try {
      await expect(session.renderSlide(0)).rejects.toThrow(
        "The renderer could not display slide 1",
      );
      expect(renderSlide).toHaveBeenCalledTimes(2);
      expect(container.textContent).toBe(readableContent);
    } finally {
      renderSlide.mockRestore();
      session.dispose();
    }
  });

  it("does not restore stale content when a pending render rejects after disposal", async () => {
    const container = document.createElement("div");
    const session = await new AidenPptxRendererAdapter().open(
      await loadFixture(),
      container,
      new AbortController().signal,
    );
    await session.renderSlide(0);
    let rejectRender: ((reason: Error) => void) | undefined;
    const renderSlide = vi
      .spyOn(PptxViewer.prototype, "renderSlide")
      .mockImplementation(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectRender = reject;
          }),
      );

    const pendingRender = session.renderSlide(0);
    session.dispose();
    container.textContent = "newly opened presentation";
    rejectRender?.(new Error("late renderer failure"));

    await expect(pendingRender).rejects.toThrow(
      "PPTX renderer session has been disposed",
    );
    expect(renderSlide).toHaveBeenCalledOnce();
    expect(container.textContent).toBe("newly opened presentation");
    renderSlide.mockRestore();
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
