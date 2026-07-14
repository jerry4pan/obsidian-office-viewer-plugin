import { describe, expect, it, vi } from "vitest";
import { PptxViewSession } from "../src/pptx-view-session";
import { PptxOpenError } from "../src/pptx-open-error";
import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "../src/renderer/pptx-renderer-adapter";

function makeRenderer(slideCount = 1) {
  const rendererSession: PptxRendererSession = {
    slideCount,
    slideWidth: 960,
    slideHeight: 540,
    capabilities: { thumbnails: false, prefetch: false, zoom: false },
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

function makeM2Renderer(slideCount = 10) {
  const rendererSession: PptxRendererSession = {
    slideCount,
    slideWidth: 960,
    slideHeight: 540,
    capabilities: { thumbnails: true, prefetch: true, zoom: true },
    renderSlide: vi.fn(async () => {}),
    renderThumbnail: vi.fn((index, container) => {
      container.textContent = `Preview ${index + 1}`;
      return { ready: Promise.resolve(), dispose: vi.fn() };
    }),
    prefetchSlide: vi.fn(async () => {}),
    setZoomPercent: vi.fn(async () => {}),
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

function makeFullscreen() {
  let activeRoot: HTMLElement | null = null;
  const listeners = new Set<() => void>();
  return {
    api: {
      isActive: vi.fn((root: HTMLElement) => root === activeRoot),
      enter: vi.fn(async (root: HTMLElement) => {
        activeRoot = root;
        listeners.forEach((listener) => listener());
      }),
      exit: vi.fn(async () => {
        activeRoot = null;
        listeners.forEach((listener) => listener());
      }),
      subscribe: vi.fn((listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
    },
    listeners,
  };
}

describe("PptxViewSession", () => {
  it("renders a restored page exactly once and records only later successful navigation", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter, rendererSession } = makeM2Renderer(10);
    const record = vi.fn();
    const session = new PptxViewSession(root, reader, adapter, {
      positions: { initialSlideFor: vi.fn(() => 7), record },
    });

    await session.open("deck.pptx");

    expect(reader.readBinary).toHaveBeenCalledOnce();
    expect(rendererSession.renderSlide).toHaveBeenCalledTimes(1);
    expect(rendererSession.renderSlide).toHaveBeenCalledWith(7);
    expect(record).not.toHaveBeenCalled();
    root.querySelector<HTMLButtonElement>('[data-action="next-slide"]')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain("9 / 10"));
    expect(record).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledWith("deck.pptx", 8);
    session.dispose();
  });

  it("keeps reading when a position callback fails", async () => {
    const root = document.createElement("div");
    const { adapter } = makeM2Renderer(3);
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      {
        positions: {
          initialSlideFor: () => 0,
          record: () => { throw new Error("private persistence detail"); },
        },
      },
    );
    await session.open("deck.pptx");

    root.querySelector<HTMLButtonElement>('[data-action="next-slide"]')!.click();

    await vi.waitFor(() => expect(root.textContent).toContain("2 / 3"));
    expect(root.dataset.state).toBe("ready");
    expect(root.textContent).not.toContain("private persistence detail");
    session.dispose();
  });

  it("keeps page and zoom state independent between sessions", async () => {
    const firstRoot = document.createElement("div");
    const secondRoot = document.createElement("div");
    document.body.append(firstRoot, secondRoot);
    const first = makeM2Renderer(4);
    const second = makeM2Renderer(4);
    const adapter: PptxRendererAdapter = {
      open: vi.fn().mockImplementationOnce(first.adapter.open).mockImplementationOnce(second.adapter.open),
    };
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const firstSession = new PptxViewSession(firstRoot, reader, adapter);
    const secondSession = new PptxViewSession(secondRoot, reader, adapter);
    await Promise.all([firstSession.open("a.pptx"), secondSession.open("b.pptx")]);

    firstRoot.querySelector<HTMLButtonElement>('[data-action="next-slide"]')!.click();
    firstRoot.querySelector<HTMLButtonElement>('[data-action="zoom-in"]')!.click();
    await vi.waitFor(() => expect(firstRoot.textContent).toContain("2 / 4"));
    await vi.waitFor(() => expect(firstRoot.dataset.zoomPercent).toBe("125"));

    expect(secondRoot.textContent).toContain("1 / 4");
    expect(secondRoot.dataset.zoomPercent).toBe("100");
    expect(second.rendererSession.renderSlide).toHaveBeenCalledTimes(1);
    expect(second.rendererSession.setZoomPercent).not.toHaveBeenCalled();
    firstSession.dispose();
    secondSession.dispose();
  });

  it("supports accessible keyboard, thumbnail, zoom, collapse, and full-screen actions", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const { adapter, rendererSession } = makeM2Renderer(6);
    const fullscreen = makeFullscreen();
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      { fullscreen: fullscreen.api },
    );
    await session.open("deck.pptx");

    expect(document.activeElement).toBe(root);
    expect(root.tabIndex).toBe(0);
    expect(root.querySelector('[data-action="zoom-out"]')?.getAttribute("aria-label")).toBe("Zoom out");
    expect(root.querySelector('[data-action="zoom-in"]')?.getAttribute("aria-label")).toBe("Zoom in");
    expect(root.querySelector('[data-action="fit-slide"]')?.getAttribute("aria-label")).toBe("Fit slide");
    expect(root.querySelector('[data-action="toggle-fullscreen"]')?.getAttribute("aria-label")).toBe("Enter full screen");
    expect(root.querySelector('[aria-label="Slide thumbnails"]')).not.toBeNull();
    expect(root.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();

    for (const [key, page] of [["ArrowRight", "2 / 6"], ["PageDown", "3 / 6"], ["ArrowLeft", "2 / 6"], ["PageUp", "1 / 6"]] as const) {
      const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
      root.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(root.textContent).toContain(page));
    }
    const boundary = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowLeft" });
    root.dispatchEvent(boundary);
    expect(boundary.defaultPrevented).toBe(false);

    const input = root.querySelector<HTMLInputElement>('[data-action="page-number"]')!;
    const editableEvent = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowRight" });
    input.dispatchEvent(editableEvent);
    expect(editableEvent.defaultPrevented).toBe(false);
    expect(rendererSession.renderSlide).toHaveBeenCalledTimes(5);

    root.querySelector<HTMLButtonElement>('[data-slide-index="2"]')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain("3 / 6"));
    expect(root.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe("Slide 3");

    root.querySelector<HTMLButtonElement>('[data-action="zoom-in"]')!.click();
    await vi.waitFor(() => expect(root.dataset.zoomPercent).toBe("125"));
    expect(root.dataset.zoomMode).toBe("manual");
    root.querySelector<HTMLButtonElement>('[data-action="zoom-out"]')!.click();
    await vi.waitFor(() => expect(root.dataset.zoomPercent).toBe("100"));
    expect(root.dataset.zoomMode).toBe("manual");
    root.querySelector<HTMLButtonElement>('[data-action="fit-slide"]')!.click();
    await vi.waitFor(() => expect(root.dataset.zoomMode).toBe("fit"));

    root.querySelector<HTMLButtonElement>('[data-action="toggle-thumbnails"]')!.click();
    expect(root.dataset.thumbnailsCollapsed).toBe("true");
    expect(root.querySelector('[data-action="toggle-thumbnails"]')?.getAttribute("aria-expanded")).toBe("false");

    root.querySelector<HTMLButtonElement>('[data-action="toggle-fullscreen"]')!.click();
    await vi.waitFor(() => expect(root.dataset.fullscreen).toBe("true"));
    expect(fullscreen.api.enter).toHaveBeenCalledWith(root);
    expect(root.querySelector('[data-action="toggle-fullscreen"]')?.getAttribute("aria-label")).toBe("Exit full screen");
    root.querySelector<HTMLButtonElement>('[data-action="toggle-fullscreen"]')!.click();
    await vi.waitFor(() => expect(root.dataset.fullscreen).toBe("false"));
    expect(fullscreen.api.exit).toHaveBeenCalledOnce();

    const actions = Array.from(root.querySelectorAll<HTMLElement>("button, input"), (item) => item.dataset.action).filter(Boolean);
    expect(actions.indexOf("previous-slide")).toBeLessThan(actions.indexOf("page-number"));
    expect(actions.indexOf("page-number")).toBeLessThan(actions.indexOf("zoom-out"));
    expect(actions.indexOf("zoom-out")).toBeLessThan(actions.indexOf("toggle-fullscreen"));
    session.dispose();
  });

  it("keeps zoom and full-screen failures local and disposes session-owned work", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const { adapter, rendererSession } = makeM2Renderer(20);
    rendererSession.setZoomPercent = vi.fn(async () => { throw new Error("candidate detail"); });
    const fullscreen = makeFullscreen();
    fullscreen.api.enter.mockRejectedValueOnce(new Error("platform detail"));
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      { fullscreen: fullscreen.api },
    );
    await session.open("deck.pptx");

    root.querySelector<HTMLButtonElement>('[data-action="zoom-in"]')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain("Unable to change zoom."));
    expect(root.dataset.state).toBe("ready");
    expect(root.dataset.zoomPercent).toBe("100");
    expect(root.textContent).not.toContain("candidate detail");

    root.querySelector<HTMLButtonElement>('[data-action="toggle-fullscreen"]')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain("Unable to change full-screen mode."));
    expect(root.dataset.fullscreen).toBe("false");
    expect(root.textContent).not.toContain("platform detail");
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      mountedThumbnails: expect.any(Number),
      zoomMode: "fit",
      zoomPercent: 100,
    });
    expect(Number(root.dataset.mountedThumbnailCount)).toBeGreaterThan(0);

    session.dispose();
    expect(fullscreen.listeners.size).toBe(0);
    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      backgroundPending: 0,
      backgroundRunning: 0,
      mountedThumbnails: 0,
    });
    const afterDispose = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowRight" });
    root.dispatchEvent(afterDispose);
    expect(afterDispose.defaultPrevented).toBe(false);
  });
  it("starts in an explicit empty state before a file is selected", () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter } = makeRenderer();

    new PptxViewSession(root, reader, adapter);

    expect(root.dataset.state).toBe("empty");
    expect(root.dataset.lifecyclePhase).toBe("idle");
    expect(root.textContent).toContain(
      "Open a PPTX file from your Vault to start reading.",
    );
  });

  it("exposes a candidate-independent in-flight phase after Vault reading completes", async () => {
    const root = document.createElement("div");
    let finishRead: ((bytes: ArrayBuffer) => void) | undefined;
    let finishAdapterOpen: ((session: PptxRendererSession) => void) | undefined;
    const rendererSession = makeRenderer().rendererSession;
    const reader = {
      readBinary: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            finishRead = resolve;
          }),
      ),
    };
    const adapter: PptxRendererAdapter = {
      open: vi.fn(
        () =>
          new Promise<PptxRendererSession>((resolve) => {
            finishAdapterOpen = resolve;
          }),
      ),
    };
    const session = new PptxViewSession(root, reader, adapter);

    const opening = session.open("stress.pptx");
    expect(root.dataset.lifecyclePhase).toBe("reading");

    finishRead?.(new ArrayBuffer(1));
    await vi.waitFor(() => expect(adapter.open).toHaveBeenCalledOnce());
    expect(root.dataset.lifecyclePhase).toBe("adapter-opening");
    expect(session.getPerformanceDiagnostics().lifecyclePhase).toBe(
      "adapter-opening",
    );

    finishAdapterOpen?.(rendererSession);
    await opening;
    expect(root.dataset.lifecyclePhase).toBe("ready");

    session.dispose();
    expect(root.dataset.lifecyclePhase).toBeUndefined();
    expect(session.getPerformanceDiagnostics().lifecyclePhase).toBe("disposed");
  });

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
    expect(
      root.querySelector<HTMLInputElement>('[data-action="page-number"]')
        ?.disabled,
    ).toBe(true);
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="jump-to-slide"]')
        ?.disabled,
    ).toBe(true);

    finishRead?.(new ArrayBuffer(1));
    await opening;
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      openPending: false,
      rendererActive: true,
      disposed: false,
    });
    expect(
      root.querySelector<HTMLInputElement>('[data-action="page-number"]')
        ?.disabled,
    ).toBe(false);
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="jump-to-slide"]')
        ?.disabled,
    ).toBe(false);

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

  it("jumps to a valid one-based slide number", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter, rendererSession } = makeRenderer(3);
    const session = new PptxViewSession(root, reader, adapter);
    await session.open("deck.pptx");

    const input = root.querySelector<HTMLInputElement>(
      '[data-action="page-number"]',
    );
    const jump = root.querySelector<HTMLButtonElement>(
      '[data-action="jump-to-slide"]',
    );
    expect(input).not.toBeNull();
    expect(jump).not.toBeNull();

    input!.value = "3";
    jump!.click();

    await vi.waitFor(() =>
      expect(rendererSession.renderSlide).toHaveBeenLastCalledWith(2),
    );
    await vi.waitFor(() => expect(root.textContent).toContain("3 / 3"));
    expect(root.dataset.state).toBe("ready");
    expect(input?.value).toBe("3");
  });

  it.each(["", "0", "4", "1.5"])(
    "rejects invalid page input %j without changing the readable slide",
    async (value) => {
      const root = document.createElement("div");
      const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
      const { adapter, rendererSession } = makeRenderer(3);
      const session = new PptxViewSession(root, reader, adapter);
      await session.open("deck.pptx");
      const input = root.querySelector<HTMLInputElement>(
        '[data-action="page-number"]',
      )!;

      input.value = value;
      root
        .querySelector<HTMLButtonElement>('[data-action="jump-to-slide"]')!
        .click();

      expect(rendererSession.renderSlide).toHaveBeenCalledTimes(1);
      expect(root.textContent).toContain("1 / 3");
      expect(root.textContent).toContain(
        "Enter a slide number from 1 to 3.",
      );
      expect(root.dataset.state).toBe("ready");
    },
  );

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

  it("continues ordered teardown and clears the root when component disposers throw", async () => {
    const root = document.createElement("div");
    const { adapter, rendererSession } = makeM2Renderer(20);
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
    );
    await session.open("deck.pptx");
    const internals = session as unknown as {
      thumbnailRail: { dispose(): void };
      viewerController: { dispose(): void };
      backgroundQueue: { dispose(): void };
    };
    const railDispose = vi.spyOn(internals.thumbnailRail, "dispose").mockImplementation(() => {
      throw new Error("rail cleanup failed");
    });
    const controllerDispose = vi.spyOn(internals.viewerController, "dispose");
    const queueDispose = vi.spyOn(internals.backgroundQueue, "dispose");
    vi.mocked(rendererSession.dispose).mockImplementation(() => {
      throw new Error("renderer cleanup failed");
    });

    expect(() => session.dispose()).not.toThrow();

    expect(railDispose).toHaveBeenCalledOnce();
    expect(controllerDispose).toHaveBeenCalledOnce();
    expect(queueDispose).toHaveBeenCalledOnce();
    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.childElementCount).toBe(0);
    expect(root.dataset.state).toBeUndefined();
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      backgroundPending: 0,
      backgroundRunning: 0,
      mountedThumbnails: 0,
      rendererActive: false,
    });
  });

  it("survives a throwing previous renderer disposer while reopening", async () => {
    const root = document.createElement("div");
    const first = makeRenderer(2);
    const second = makeRenderer(2);
    vi.mocked(first.rendererSession.dispose).mockImplementation(() => {
      throw new Error("old renderer cleanup failed");
    });
    const adapter: PptxRendererAdapter = {
      open: vi.fn().mockImplementationOnce(first.adapter.open).mockImplementationOnce(second.adapter.open),
    };
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
    );
    await session.open("first.pptx");

    await expect(session.open("second.pptx")).resolves.toBeUndefined();

    expect(first.rendererSession.dispose).toHaveBeenCalledOnce();
    expect(second.rendererSession.dispose).not.toHaveBeenCalled();
    expect(root.dataset.state).toBe("ready");
    expect(root.textContent).toContain("1 / 2");
    session.dispose();
  });

  it("finishes the open-error surface when renderer cleanup throws", async () => {
    const root = document.createElement("div");
    const { adapter, rendererSession } = makeRenderer(1);
    vi.mocked(rendererSession.renderSlide).mockRejectedValueOnce(new Error("render failed"));
    vi.mocked(rendererSession.dispose).mockImplementation(() => {
      throw new Error("renderer cleanup failed");
    });
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
    );

    await expect(session.open("broken.pptx")).resolves.toBeUndefined();

    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.dataset.state).toBe("error");
    expect(root.dataset.errorCategory).toBe("incompatible");
    expect(session.getPerformanceDiagnostics().rendererActive).toBe(false);
  });

  it("keeps the mounted-thumbnail data attribute live and stale-safe", async () => {
    const root = document.createElement("div");
    const { adapter } = makeM2Renderer(200);
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
    );
    await session.open("large.pptx");
    const rail = root.querySelector<HTMLElement>('[aria-label="Slide thumbnails"]')!;
    const initial = Number(root.dataset.mountedThumbnailCount);

    Object.defineProperty(rail, "clientHeight", { configurable: true, value: 100 });
    rail.dispatchEvent(new Event("scroll"));

    expect(Number(root.dataset.mountedThumbnailCount)).toBe(
      rail.querySelectorAll('[data-action="thumbnail-slide"]').length,
    );
    expect(Number(root.dataset.mountedThumbnailCount)).not.toBe(initial);

    session.dispose();
    expect(root.dataset.mountedThumbnailCount).toBeUndefined();
    rail.dispatchEvent(new Event("scroll"));
    expect(root.dataset.mountedThumbnailCount).toBeUndefined();
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

    await vi.waitFor(() => expect(root.dataset.state).toBe("degraded"));
    expect(root.textContent).toContain(
      "Slide 2 could not be rendered. The previous slide is still shown. Try another slide or open it in the default application.",
    );
    expect(root.textContent).toContain("Obsidian PPTX smoke test");
    expect(root.textContent).toContain("1 / 3");
    expect(
      root.querySelector<HTMLInputElement>('[data-action="page-number"]')
        ?.value,
    ).toBe("1");
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

  const errorCases = [
    ["malformed", "This PPTX is damaged or incomplete."],
    ["protected", "This PPTX is encrypted or password-protected."],
    [
      "incompatible",
      "This PPTX uses content this viewer cannot safely display.",
    ],
    ["unknown", "An unexpected error prevented this PPTX from opening."],
  ] as const;

  for (const [category, message] of errorCases) {
    it(`shows a stable ${category} failure without rejecting the view load`, async () => {
      const root = document.createElement("div");
      const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
      const adapter: PptxRendererAdapter = {
        open: vi.fn(async () => {
          throw new PptxOpenError(category, "candidate-specific details");
        }),
      };
      const session = new PptxViewSession(root, reader, adapter);

      await expect(session.open("deck.pptx")).resolves.toBeUndefined();

      expect(root.dataset.state).toBe("error");
      expect(root.dataset.errorCategory).toBe(category);
      expect(root.textContent).toContain(message);
      expect(root.textContent).toContain("The original PPTX file was not modified.");
      expect(
        root.querySelector<HTMLButtonElement>('[data-action="retry"]'),
      ).not.toBeNull();
      expect(root.textContent).not.toContain("candidate-specific details");
    });
  }

  it("classifies an unexpected Vault read failure as unknown", async () => {
    const root = document.createElement("div");
    const reader = {
      readBinary: vi.fn(async () => {
        throw new Error("private filesystem details");
      }),
    };
    const { adapter } = makeRenderer();
    const session = new PptxViewSession(root, reader, adapter);

    await expect(session.open("deck.pptx")).resolves.toBeUndefined();

    expect(root.dataset.errorCategory).toBe("unknown");
    expect(root.textContent).not.toContain("private filesystem details");
  });

  it("retries the same file and reaches ready after a recoverable failure", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const recovered = makeRenderer(2);
    const adapter: PptxRendererAdapter = {
      open: vi
        .fn()
        .mockRejectedValueOnce(new PptxOpenError("malformed", "first failure"))
        .mockImplementationOnce(recovered.adapter.open),
    };
    const session = new PptxViewSession(root, reader, adapter);
    await session.open("deck.pptx");

    root.querySelector<HTMLButtonElement>('[data-action="retry"]')?.click();

    await vi.waitFor(() => expect(root.dataset.state).toBe("ready"));
    expect(reader.readBinary).toHaveBeenCalledTimes(2);
    expect(root.textContent).toContain("1 / 2");
    expect(root.dataset.errorCategory).toBeUndefined();
  });

  it("offers the injected default-application fallback", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const adapter: PptxRendererAdapter = {
      open: vi.fn(async () => {
        throw new PptxOpenError("protected", "protected");
      }),
    };
    const openExternally = vi.fn(async () => {});
    const session = new PptxViewSession(root, reader, adapter, {
      openExternally,
    });
    await session.open("deck.pptx");

    root
      .querySelector<HTMLButtonElement>('[data-action="open-externally"]')
      ?.click();

    await vi.waitFor(() =>
      expect(openExternally).toHaveBeenCalledWith("deck.pptx"),
    );
  });

  it("offers the default-application fallback while a deck is readable", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter } = makeRenderer(2);
    const openExternally = vi.fn(async () => {});
    const session = new PptxViewSession(root, reader, adapter, {
      openExternally,
    });
    await session.open("deck.pptx");

    root
      .querySelector<HTMLButtonElement>('[data-action="open-externally"]')
      ?.click();

    await vi.waitFor(() =>
      expect(openExternally).toHaveBeenCalledWith("deck.pptx"),
    );
    expect(root.dataset.state).toBe("ready");
  });

  it("disposes renderer resources when first-slide rendering fails", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const rendererSession: PptxRendererSession = {
      slideCount: 1,
      slideWidth: 960,
      slideHeight: 540,
      capabilities: { thumbnails: false, prefetch: false, zoom: false },
      renderSlide: vi.fn(async () => {
        throw new Error("renderer exploded");
      }),
      dispose: vi.fn(),
    };
    const adapter: PptxRendererAdapter = {
      open: vi.fn(async () => rendererSession),
    };
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("deck.pptx");

    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.dataset.errorCategory).toBe("incompatible");
  });

  it("disposes a late renderer result after the view closes", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const rendererSession: PptxRendererSession = {
      slideCount: 1,
      slideWidth: 960,
      slideHeight: 540,
      capabilities: { thumbnails: false, prefetch: false, zoom: false },
      renderSlide: vi.fn(async () => {}),
      dispose: vi.fn(() => {
        throw new Error("late candidate cleanup failed");
      }),
    };
    let resolveOpen!: (value: PptxRendererSession) => void;
    const adapter: PptxRendererAdapter = {
      open: vi.fn(
        async () =>
          new Promise<PptxRendererSession>((resolve) => {
            resolveOpen = resolve;
          }),
      ),
    };
    const session = new PptxViewSession(root, reader, adapter);
    const opening = session.open("deck.pptx");
    await vi.waitFor(() => expect(adapter.open).toHaveBeenCalledOnce());

    session.dispose();
    resolveOpen(rendererSession);
    await expect(opening).resolves.toBeUndefined();

    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.childElementCount).toBe(0);
  });
});
