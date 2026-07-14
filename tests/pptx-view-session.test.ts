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

  it("disposes renderer resources when first-slide rendering fails", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const rendererSession: PptxRendererSession = {
      slideCount: 1,
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
      renderSlide: vi.fn(async () => {}),
      dispose: vi.fn(),
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
    await opening;

    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.childElementCount).toBe(0);
  });
});
