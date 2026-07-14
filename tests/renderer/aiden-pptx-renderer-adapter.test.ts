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
  it("opens parse-only with M2 capabilities and renders on explicit request", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const adapter = new AidenPptxRendererAdapter();

    const session = await adapter.open(
      await loadFixture(),
      container,
      new AbortController().signal,
    );

    expect(session.slideCount).toBe(1);
    expect(session.slideWidth).toBeGreaterThan(0);
    expect(session.slideHeight).toBeGreaterThan(0);
    expect(session.capabilities).toEqual({
      thumbnails: true,
      prefetch: true,
      zoom: true,
    });
    expect(container.childElementCount).toBe(0);
    await session.renderSlide(0);
    expect(container.textContent).toContain("Obsidian PPTX smoke test");

    session.dispose();
    expect(container.childElementCount).toBe(0);
  });

  it("exposes thumbnail, prefetch, and zoom without leaking candidate handles", async () => {
    const container = document.createElement("div");
    const session = await new AidenPptxRendererAdapter().open(
      await loadFixture(),
      container,
      new AbortController().signal,
    );
    const thumbnailContainer = document.createElement("div");
    const thumbnailDispose = vi.fn();
    const prefetchDispose = vi.fn();
    const renderThumbnail = vi
      .spyOn(PptxViewer.prototype, "renderThumbnailToContainer")
      .mockReturnValue({
        element: document.createElement("div"),
        ready: Promise.resolve(),
        dispose: thumbnailDispose,
        [Symbol.dispose]: thumbnailDispose,
      });
    const renderToContainer = vi
      .spyOn(PptxViewer.prototype, "renderSlideToContainer")
      .mockReturnValue({
        element: document.createElement("div"),
        ready: Promise.resolve(),
        dispose: prefetchDispose,
        [Symbol.dispose]: prefetchDispose,
      });
    const setZoom = vi
      .spyOn(PptxViewer.prototype, "setZoom")
      .mockResolvedValue();

    try {
      const signal = new AbortController().signal;
      const thumbnail = session.renderThumbnail!(
        0,
        thumbnailContainer,
        signal,
      );
      await thumbnail.ready;
      thumbnail.dispose();
      await session.prefetchSlide!(0, signal);
      await session.setZoomPercent!(150);

      expect(renderThumbnail).toHaveBeenCalledWith(0, thumbnailContainer, {
        width: 144,
      });
      expect(thumbnailDispose).toHaveBeenCalledOnce();
      expect(renderToContainer).toHaveBeenCalledWith(
        0,
        expect.any(HTMLElement),
      );
      expect(prefetchDispose).toHaveBeenCalledOnce();
      expect(setZoom).toHaveBeenCalledWith(150);
    } finally {
      renderThumbnail.mockRestore();
      renderToContainer.mockRestore();
      setZoom.mockRestore();
      session.dispose();
    }
  });

  it("does not allocate a thumbnail handle when already aborted", async () => {
    const session = await new AidenPptxRendererAdapter().open(
      await loadFixture(),
      document.createElement("div"),
      new AbortController().signal,
    );
    const renderThumbnail = vi.spyOn(
      PptxViewer.prototype,
      "renderThumbnailToContainer",
    );
    const controller = new AbortController();
    controller.abort();

    try {
      expect(() =>
        session.renderThumbnail!(
          0,
          document.createElement("div"),
          controller.signal,
        ),
      ).toThrow(expect.objectContaining({ name: "AbortError" }));
      expect(renderThumbnail).not.toHaveBeenCalled();
    } finally {
      renderThumbnail.mockRestore();
      session.dispose();
    }
  });

  it("disposes a thumbnail handle when abort wins during readiness", async () => {
    let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const dispose = vi.fn();
    const renderThumbnail = vi
      .spyOn(PptxViewer.prototype, "renderThumbnailToContainer")
      .mockReturnValue({
        element: document.createElement("div"),
        ready,
        dispose,
        [Symbol.dispose]: dispose,
      });
    const session = await new AidenPptxRendererAdapter().open(
      await loadFixture(),
      document.createElement("div"),
      new AbortController().signal,
    );
    const controller = new AbortController();

    try {
      const resource = session.renderThumbnail!(
        0,
        document.createElement("div"),
        controller.signal,
      );
      controller.abort();
      expect(dispose).toHaveBeenCalledOnce();
      resolveReady();
      await expect(resource.ready).rejects.toMatchObject({ name: "AbortError" });
      resource.dispose();
      expect(dispose).toHaveBeenCalledOnce();
    } finally {
      renderThumbnail.mockRestore();
      session.dispose();
    }
  });

  it("always disposes a detached prefetch handle when readiness rejects", async () => {
    const failure = new Error("resource failed");
    let rejectReady!: (reason: Error) => void;
    const ready = new Promise<void>((_resolve, reject) => {
      rejectReady = reject;
    });
    const dispose = vi.fn();
    const renderToContainer = vi
      .spyOn(PptxViewer.prototype, "renderSlideToContainer")
      .mockReturnValue({
        element: document.createElement("div"),
        ready,
        dispose,
        [Symbol.dispose]: dispose,
      });
    const session = await new AidenPptxRendererAdapter().open(
      await loadFixture(),
      document.createElement("div"),
      new AbortController().signal,
    );

    try {
      const prefetch = session.prefetchSlide!(
        0,
        new AbortController().signal,
      );
      rejectReady(failure);
      await expect(prefetch).rejects.toBe(failure);
      expect(dispose).toHaveBeenCalledOnce();
    } finally {
      renderToContainer.mockRestore();
      session.dispose();
    }
  });

  it("session disposal releases every still-owned external handle exactly once", async () => {
    const disposals = [vi.fn(), vi.fn()];
    let call = 0;
    const renderThumbnail = vi
      .spyOn(PptxViewer.prototype, "renderThumbnailToContainer")
      .mockImplementation(() => {
        const dispose = disposals[call++]!;
        return {
          element: document.createElement("div"),
          ready: Promise.resolve(),
          dispose,
          [Symbol.dispose]: dispose,
        };
      });
    const session = await new AidenPptxRendererAdapter().open(
      await loadFixture(),
      document.createElement("div"),
      new AbortController().signal,
    );

    try {
      const first = session.renderThumbnail!(
        0,
        document.createElement("div"),
        new AbortController().signal,
      );
      session.renderThumbnail!(
        0,
        document.createElement("div"),
        new AbortController().signal,
      );
      first.dispose();
      session.dispose();
      session.dispose();

      expect(disposals[0]).toHaveBeenCalledOnce();
      expect(disposals[1]).toHaveBeenCalledOnce();
    } finally {
      renderThumbnail.mockRestore();
      session.dispose();
    }
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

  it("destroys an allocated viewer exactly once when load rejects", async () => {
    const failure = new Error("parse failed");
    const load = vi.spyOn(PptxViewer.prototype, "load").mockImplementation(() => {
      throw failure;
    });
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
      expect(load).toHaveBeenCalledOnce();
      expect(destroy).toHaveBeenCalledOnce();
    } finally {
      load.mockRestore();
      destroy.mockRestore();
    }
  });

  it("destroys an allocated viewer exactly once when abort wins after load", async () => {
    const controller = new AbortController();
    const load = vi
      .spyOn(PptxViewer.prototype, "load")
      .mockImplementation(() => {
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
      expect(load).toHaveBeenCalledOnce();
      expect(destroy).toHaveBeenCalledOnce();
    } finally {
      load.mockRestore();
      destroy.mockRestore();
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
