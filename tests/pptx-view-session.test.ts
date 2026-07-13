import { describe, expect, it, vi } from "vitest";
import { PptxViewSession } from "../src/pptx-view-session";
import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "../src/renderer/pptx-renderer-adapter";

function makeRenderer(slideCount = 1) {
  const rendererSession: PptxRendererSession = {
    slideCount,
    renderSlide: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
  const adapter: PptxRendererAdapter = {
    open: vi.fn(async (_buffer, container) => {
      container.textContent = "Obsidian PPTX smoke test";
      return rendererSession;
    }),
  };
  return { adapter, rendererSession };
}

describe("PptxViewSession", () => {
  it("exposes adapter work diagnostics through open and disposal", async () => {
    const root = document.createElement("div");
    let finishRead: ((value: ArrayBuffer) => void) | undefined;
    const reader = {
      readBinary: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            finishRead = resolve;
          }),
      ),
    };
    const { adapter } = makeRenderer();
    const session = new PptxViewSession(root, reader, adapter);

    const opening = session.open("deck.pptx");
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      openPending: true,
      rendererActive: false,
      disposed: false,
    });

    finishRead?.(new ArrayBuffer(1));
    await opening;
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      openPending: false,
      rendererActive: true,
      disposed: false,
    });

    session.dispose();
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      openPending: false,
      rendererActive: false,
      disposed: true,
    });
  });

  it("reads once, renders slide 1, and exposes ready state", async () => {
    const root = document.createElement("div");
    const bytes = new ArrayBuffer(8);
    const reader = { readBinary: vi.fn(async () => bytes) };
    const { adapter, rendererSession } = makeRenderer(3);
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("deck.pptx");

    expect(reader.readBinary).toHaveBeenCalledOnce();
    expect(reader.readBinary).toHaveBeenCalledWith("deck.pptx");
    expect(adapter.open).toHaveBeenCalledOnce();
    expect(adapter.open).toHaveBeenCalledWith(
      bytes,
      expect.any(HTMLElement),
      expect.any(AbortSignal),
    );
    expect(rendererSession.renderSlide).toHaveBeenCalledWith(0);
    expect(root.dataset.state).toBe("ready");
    expect(root.textContent).toContain("1 / 3");
    expect(root.textContent).toContain("Obsidian PPTX smoke test");
  });

  it("exposes full-open timings and navigates with product controls", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter, rendererSession } = makeRenderer(3);
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("deck.pptx");

    expect(root.dataset.metadataMs).toMatch(/^\d/);
    expect(root.dataset.firstReadableMs).toMatch(/^\d/);
    const previous = root.querySelector<HTMLButtonElement>(
      '[data-action="previous-slide"]',
    );
    const next = root.querySelector<HTMLButtonElement>(
      '[data-action="next-slide"]',
    );
    expect(previous?.disabled).toBe(true);
    expect(next?.disabled).toBe(false);

    next?.click();

    await vi.waitFor(() =>
      expect(rendererSession.renderSlide).toHaveBeenLastCalledWith(1),
    );
    await vi.waitFor(() => expect(root.textContent).toContain("2 / 3"));
    expect(root.dataset.lastSlideSwitchMs).toMatch(/^\d/);
    expect(previous?.disabled).toBe(false);
    expect(next?.disabled).toBe(false);
  });

  it("captures slide-switch timing before updating product UI", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter } = makeRenderer(3);
    const session = new PptxViewSession(root, reader, adapter);
    const textSeenAtTimingBoundaries: string[] = [];
    const now = vi.spyOn(performance, "now").mockImplementation(() => {
      textSeenAtTimingBoundaries.push(root.textContent ?? "");
      return textSeenAtTimingBoundaries.length;
    });

    try {
      await session.open("deck.pptx");
      textSeenAtTimingBoundaries.length = 0;

      root
        .querySelector<HTMLButtonElement>('[data-action="next-slide"]')
        ?.click();

      await vi.waitFor(() =>
        expect(root.dataset.lastSlideSwitchMs).toMatch(/^\d/),
      );
      expect(textSeenAtTimingBoundaries.slice(0, 2)).toEqual([
        expect.stringContaining("1 / 3"),
        expect.stringContaining("1 / 3"),
      ]);
    } finally {
      now.mockRestore();
    }
  });

  it("disposes the renderer and clears the view", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter, rendererSession } = makeRenderer();
    const session = new PptxViewSession(root, reader, adapter);
    await session.open("deck.pptx");

    session.dispose();
    session.dispose();

    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.childElementCount).toBe(0);
    expect(root.dataset.metadataMs).toBeUndefined();
    expect(root.dataset.firstReadableMs).toBeUndefined();
    expect(root.dataset.lastSlideSwitchMs).toBeUndefined();
  });

  it("disposes the previous renderer before reopening", async () => {
    const root = document.createElement("div");
    const bytes = new ArrayBuffer(1);
    let finishSecondRead: (() => void) | undefined;
    const reader = {
      readBinary: vi
        .fn()
        .mockResolvedValueOnce(bytes)
        .mockImplementationOnce(
          () =>
            new Promise<ArrayBuffer>((resolve) => {
              finishSecondRead = () => resolve(bytes);
            }),
        ),
    };
    const first = makeRenderer();
    const second = makeRenderer();
    const adapter: PptxRendererAdapter = {
      open: vi
        .fn()
        .mockImplementationOnce(first.adapter.open)
        .mockImplementationOnce(second.adapter.open),
    };
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("first.pptx");
    root.dataset.lastSlideSwitchMs = "12.345";
    const reopening = session.open("second.pptx");

    expect(first.rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.dataset.metadataMs).toBeUndefined();
    expect(root.dataset.firstReadableMs).toBeUndefined();
    expect(root.dataset.lastSlideSwitchMs).toBeUndefined();

    finishSecondRead?.();
    await reopening;

    expect(second.rendererSession.dispose).not.toHaveBeenCalled();
    expect(root.dataset.metadataMs).toMatch(/^\d/);
    expect(root.dataset.firstReadableMs).toMatch(/^\d/);
    expect(root.dataset.lastSlideSwitchMs).toBeUndefined();
  });

  it("does not apply a completed navigation after reopening", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    let finishNavigation: (() => void) | undefined;
    const first = makeRenderer(3);
    first.rendererSession.renderSlide = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishNavigation = resolve;
          }),
      );
    const second = makeRenderer(2);
    const adapter: PptxRendererAdapter = {
      open: vi
        .fn()
        .mockImplementationOnce(first.adapter.open)
        .mockImplementationOnce(second.adapter.open),
    };
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("first.pptx");
    root
      .querySelector<HTMLButtonElement>('[data-action="next-slide"]')
      ?.click();
    await vi.waitFor(() =>
      expect(first.rendererSession.renderSlide).toHaveBeenLastCalledWith(1),
    );

    await session.open("second.pptx");
    finishNavigation?.();
    await Promise.resolve();

    expect(root.textContent).toContain("1 / 2");
    expect(root.dataset.lastSlideSwitchMs).toBeUndefined();
  });

  it("reports navigation failures and restores the controls", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter, rendererSession } = makeRenderer(3);
    rendererSession.renderSlide = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("render failed"))
      .mockResolvedValueOnce(undefined);
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("deck.pptx");
    const previous = root.querySelector<HTMLButtonElement>(
      '[data-action="previous-slide"]',
    );
    const next = root.querySelector<HTMLButtonElement>(
      '[data-action="next-slide"]',
    );

    next?.click();

    await vi.waitFor(() => expect(root.dataset.state).toBe("error"));
    expect(root.textContent).toContain("Unable to render this slide.");
    expect(root.textContent).toContain("1 / 3");
    expect(root.dataset.lastSlideSwitchMs).toBeUndefined();
    expect(previous?.disabled).toBe(true);
    expect(next?.disabled).toBe(false);

    next?.click();

    await vi.waitFor(() => expect(root.textContent).toContain("2 / 3"));
    expect(root.dataset.state).toBe("ready");
    expect(root.textContent).not.toContain("Unable to render this slide.");
    expect(root.dataset.lastSlideSwitchMs).toMatch(/^\d/);
    expect(previous?.disabled).toBe(false);
    expect(next?.disabled).toBe(false);
  });

  it("ignores a rejected navigation after disposal", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    let failNavigation: ((error: Error) => void) | undefined;
    const { adapter, rendererSession } = makeRenderer(3);
    rendererSession.renderSlide = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            failNavigation = reject;
          }),
      );
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("deck.pptx");
    root
      .querySelector<HTMLButtonElement>('[data-action="next-slide"]')
      ?.click();
    await vi.waitFor(() =>
      expect(rendererSession.renderSlide).toHaveBeenLastCalledWith(1),
    );

    session.dispose();
    failNavigation?.(new Error("disposed"));
    await Promise.resolve();

    expect(root.childElementCount).toBe(0);
    expect(root.dataset.state).toBeUndefined();
    expect(root.dataset.lastSlideSwitchMs).toBeUndefined();
  });
});
