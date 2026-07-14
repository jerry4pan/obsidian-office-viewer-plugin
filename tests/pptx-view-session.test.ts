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
  });

  it("disposes the previous renderer before reopening", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
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
    await session.open("second.pptx");

    expect(first.rendererSession.dispose).toHaveBeenCalledOnce();
    expect(second.rendererSession.dispose).not.toHaveBeenCalled();
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
