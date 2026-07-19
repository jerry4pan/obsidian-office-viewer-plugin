import { afterEach, describe, expect, it, vi } from "vitest";
import { ENGLISH_MESSAGE_TRANSLATOR } from "../src/i18n";
import { PptxOpenError } from "../src/pptx-open-error";
import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "../src/renderer/pptx-renderer-adapter";
import { SlideEmbedController } from "../src/slide-embed-core";
import { SlideEmbedScheduler } from "../src/slide-embed-scheduler";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeSession(
  identities: readonly number[] = [256, 261, 300],
): PptxRendererSession {
  return {
    slideCount: identities.length,
    slideIdentities: identities,
    slideWidth: 16,
    slideHeight: 9,
    capabilities: { thumbnails: false, prefetch: false },
    compatibilityWarnings: [],
    renderSlide: vi.fn(async (index: number) => {
      document.querySelector(".pptx-slide-embed__canvas")?.append(
        Object.assign(document.createElement("div"), {
          textContent: `rendered ${index}`,
        }),
      );
    }),
    dispose: vi.fn(),
  };
}

interface CoreFixtureOptions {
  readonly open?: PptxRendererAdapter["open"];
  readonly showDiagnostics?: boolean;
  readonly openExternally?: () => Promise<void>;
  readonly scheduler?: SlideEmbedScheduler;
  readonly file?: { basename: string } | null;
  readonly sourcePath?: string;
  readonly slideId?: number;
  readonly createdSlideNumber?: number;
}

function mountCore(
  session: PptxRendererSession,
  options: CoreFixtureOptions = {},
) {
  const host = document.createElement("div");
  document.body.append(host);
  const file = options.file === undefined
    ? { basename: "deck" }
    : options.file;
  const readBinary = vi.fn(async () => new ArrayBuffer(8));
  const open = vi.fn(options.open ?? (async () => session));
  const controller = new SlideEmbedController(host, {
    readBinary,
    renderer: { open },
    scheduler: options.scheduler ?? new SlideEmbedScheduler(2),
    messages: ENGLISH_MESSAGE_TRANSLATOR,
    showDiagnostics: () => options.showDiagnostics ?? false,
    openExternally: options.openExternally === undefined
      ? undefined
      : async () => options.openExternally!(),
  });
  controller.mount({
    file,
    sourcePath: options.sourcePath ?? "deck.pptx",
    target: {
      slideId: options.slideId ?? 261,
      createdSlideNumber: options.createdSlideNumber ?? 1,
    },
  });
  return { host, controller, readBinary, open, session };
}

describe("SlideEmbedController", () => {
  it("does not depend on MarkdownRenderChild and renders through host-agnostic ports", async () => {
    const session = makeSession();
    const { host, controller, readBinary, open } = mountCore(session);

    expect(host.dataset.state).toBe("waiting");
    expect(open).not.toHaveBeenCalled();

    controller.setVisible(true);
    await vi.waitFor(() => expect(host.dataset.state).toBe("ready"));

    expect(readBinary).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
    expect(session.renderSlide).toHaveBeenCalledWith(1);
    expect(host.dataset.currentSlide).toBe("2");
    expect(host.getAttribute("role")).toBe("group");
    expect(host.getAttribute("aria-label")).toBe("deck — Slide 2");
    expect(host.textContent).toContain("deck — Slide 2");
    expect(host.textContent).toContain(
      "created for slide 1; the same slide is now slide 2",
    );
    expect(
      host.querySelector("a.internal-link")?.getAttribute("data-href"),
    ).toBe("deck.pptx#slide-id=261&slide=1");

    controller.dispose();
    expect(session.dispose).toHaveBeenCalledOnce();
    expect(host.dataset.state).toBe("waiting");
    expect(host.querySelector(".pptx-slide-embed__canvas")?.childElementCount)
      .toBe(0);
    host.remove();
  });

  it("reports missing source without allocating a renderer", () => {
    const session = makeSession();
    const { host, controller, open } = mountCore(session, { file: null });

    expect(host.dataset.state).toBe("missing-source");
    expect(host.getAttribute("aria-label")).toBe(
      "The source presentation is no longer available.",
    );
    expect(
      host.querySelector("a.internal-link")?.getAttribute("data-href"),
    ).toBe("deck.pptx#slide-id=261&slide=1");
    expect(open).not.toHaveBeenCalled();

    controller.setVisible(true);
    expect(open).not.toHaveBeenCalled();
    controller.dispose();
    host.remove();
  });

  it("ignores stale async completion after release and dispose", async () => {
    let finishOpen!: (session: PptxRendererSession) => void;
    const openGate = new Promise<PptxRendererSession>((resolve) => {
      finishOpen = resolve;
    });
    const staleSession = makeSession();
    const { host, controller, open } = mountCore(staleSession, {
      open: vi.fn(async () => openGate),
    });

    controller.setVisible(true);
    await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());
    controller.setVisible(false);
    finishOpen(staleSession);
    await Promise.resolve();
    await Promise.resolve();

    expect(host.dataset.state).toBe("waiting");
    expect(staleSession.renderSlide).not.toHaveBeenCalled();
    expect(staleSession.dispose).toHaveBeenCalledOnce();

    controller.dispose();
    host.remove();
  });

  it("maps protected package failures through the shared error path", async () => {
    const { host, controller } = mountCore(makeSession(), {
      open: vi.fn(async () => {
        throw new PptxOpenError("protected", "fixture failure");
      }),
    });

    controller.setVisible(true);
    await vi.waitFor(() => expect(host.dataset.state).toBe("error"));
    expect(host.textContent).toContain(
      "This PPTX is encrypted or password-protected.",
    );
    controller.dispose();
    host.remove();
  });

  it("keeps diagnostics optional and never upgrades them to render failure", async () => {
    const session = {
      ...makeSession(),
      compatibilityWarnings: ["unsupported-content" as const],
      detectCompatibilityWarnings: () => {
        throw new Error("detector failed");
      },
    };
    const { host, controller } = mountCore(session, {
      showDiagnostics: true,
    });

    controller.setVisible(true);
    await vi.waitFor(() => expect(host.dataset.state).toBe("ready"));
    expect(host.textContent).toContain("deck — Slide 2");
    expect(session.dispose).not.toHaveBeenCalled();
    controller.dispose();
    host.remove();
  });
});
