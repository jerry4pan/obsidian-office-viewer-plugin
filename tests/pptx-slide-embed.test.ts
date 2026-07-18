import { afterEach, describe, expect, it, vi } from "vitest";
import { TFile, type MarkdownRenderChild } from "obsidian";
import { ENGLISH_MESSAGE_TRANSLATOR } from "../src/i18n";
import { processPptxSlideEmbeds } from "../src/pptx-slide-embed";
import { PptxOpenError, type PptxOpenErrorCategory } from "../src/pptx-open-error";
import type { PptxRendererAdapter } from "../src/renderer/pptx-renderer-adapter";
import type { PptxRendererSession } from "../src/renderer/pptx-renderer-adapter";
import { SlideEmbedScheduler } from "../src/slide-embed-scheduler";

const originalIntersectionObserver = globalThis.IntersectionObserver;

afterEach(() => {
  globalThis.IntersectionObserver = originalIntersectionObserver;
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

interface FixtureOptions {
  readonly open?: PptxRendererAdapter["open"];
  readonly showDiagnostics?: boolean;
  readonly openExternally?: () => Promise<void>;
  readonly scheduler?: SlideEmbedScheduler;
}

function fixture(
  session: PptxRendererSession,
  source = "deck.pptx#slide-id=261&slide=1",
  options: FixtureOptions = {},
) {
  globalThis.IntersectionObserver = undefined as never;
  const element = document.createElement("div");
  element.className = "internal-embed";
  element.setAttribute("src", source);
  const file = Object.assign(new TFile(), {
    path: "deck.pptx",
    stat: { size: 10, mtime: 20 },
    basename: "deck",
    extension: "pptx",
  });
  const children: MarkdownRenderChild[] = [];
  const app = {
    vault: { readBinary: vi.fn(async () => new ArrayBuffer(8)) },
    metadataCache: { getFirstLinkpathDest: vi.fn(() => file) },
  };
  processPptxSlideEmbeds(element, {
    sourcePath: "note.md",
    addChild: (child: MarkdownRenderChild) => {
      children.push(child);
      child.load();
    },
  } as never, {
    app: app as never,
    renderer: { open: vi.fn(options.open ?? (async () => session)) },
    scheduler: options.scheduler ?? new SlideEmbedScheduler(2),
    messages: ENGLISH_MESSAGE_TRANSLATOR,
    showDiagnostics: () => options.showDiagnostics ?? false,
    openExternally: options.openExternally === undefined
      ? undefined
      : async () => options.openExternally!(),
  });
  return { app, children, element };
}

describe("PPTX slide embeds", () => {
  it("renders the stable identity and discloses its current ordinal", async () => {
    const session = makeSession();
    const { children, element } = fixture(session);

    await vi.waitFor(() => expect(element.dataset.state).toBe("ready"));

    expect(session.renderSlide).toHaveBeenCalledWith(1);
    expect(element.dataset.currentSlide).toBe("2");
    expect(element.getAttribute("role")).toBe("group");
    expect(element.getAttribute("aria-label")).toBe("deck — Slide 2");
    expect(element.textContent).toContain("deck — Slide 2");
    expect(element.textContent).toContain(
      "created for slide 1; the same slide is now slide 2",
    );
    expect(
      element.querySelector("a.internal-link")?.getAttribute("data-href"),
    ).toBe("deck.pptx#slide-id=261&slide=1");

    children[0]?.unload();
    expect(session.dispose).toHaveBeenCalledOnce();
    expect(element.dataset.state).toBe("waiting");
  });

  it("keeps special characters encoded in its source recovery link", async () => {
    const { element } = fixture(
      makeSession(),
      "clients/a%23b/%5Bdeck%5D%7C100%25.pptx#slide-id=261&slide=1",
    );

    await vi.waitFor(() => expect(element.dataset.state).toBe("ready"));

    expect(
      element.querySelector("a.internal-link")?.getAttribute("data-href"),
    ).toBe(
      "clients/a%23b/%5Bdeck%5D%7C100%25.pptx#slide-id=261&slide=1",
    );
  });

  it("shows compatibility warnings only when diagnostic summary is enabled", async () => {
    const session = {
      ...makeSession(),
      compatibilityWarnings: ["unsupported-content" as const],
    };
    const { element } = fixture(session, undefined, { showDiagnostics: true });

    await vi.waitFor(() => expect(element.dataset.state).toBe("ready"));

    expect(element.textContent).toContain(
      "Some presentation content may not render correctly",
    );
    expect(
      element.querySelector(".pptx-slide-embed__compatibility")
        ?.getAttribute("role"),
    ).toBe("note");
  });

  it.each([
    ["diagnostic setting", {
      showDiagnostics: (): boolean => {
        throw new Error("setting unavailable");
      },
    }],
    ["compatibility detector", {
      showDiagnostics: (): boolean => true,
      detectCompatibilityWarnings: () => {
        throw new Error("detector failed");
      },
    }],
  ] as const)("keeps a rendered slide ready when the optional %s fails", async (
    _label,
    failure,
  ) => {
    const session = { ...makeSession(), ...failure };
    globalThis.IntersectionObserver = undefined as never;
    const element = document.createElement("div");
    element.className = "internal-embed";
    element.setAttribute("src", "deck.pptx#slide-id=261&slide=1");
    const file = Object.assign(new TFile(), {
      path: "deck.pptx",
      stat: { size: 10, mtime: 20 },
      basename: "deck",
      extension: "pptx",
    });
    processPptxSlideEmbeds(element, {
      sourcePath: "note.md",
      addChild: (child: MarkdownRenderChild) => child.load(),
    } as never, {
      app: {
        vault: { readBinary: vi.fn(async () => new ArrayBuffer(8)) },
        metadataCache: { getFirstLinkpathDest: vi.fn(() => file) },
      } as never,
      renderer: { open: vi.fn(async () => session) },
      scheduler: new SlideEmbedScheduler(2),
      messages: ENGLISH_MESSAGE_TRANSLATOR,
      showDiagnostics: failure.showDiagnostics,
    });

    await vi.waitFor(() => expect(element.dataset.state).toBe("ready"));
    expect(element.textContent).toContain("deck — Slide 2");
    expect(session.dispose).not.toHaveBeenCalled();
  });

  it("includes scheduler queue time in first-readable timing", async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const scheduler = new SlideEmbedScheduler(1);
    const now = vi.spyOn(performance, "now");
    let clock = 100;
    now.mockImplementation(() => clock);
    const firstOpen = vi.fn(async () => {
      await firstGate;
      return makeSession();
    });
    const secondOpen = vi.fn(async () => makeSession());
    const first = fixture(makeSession(), undefined, {
      scheduler,
      open: firstOpen,
    });
    await vi.waitFor(() => expect(firstOpen).toHaveBeenCalledOnce());
    clock = 200;
    const second = fixture(makeSession(), undefined, {
      scheduler,
      open: secondOpen,
    });
    expect(secondOpen).not.toHaveBeenCalled();

    clock = 4_000;
    releaseFirst();
    await vi.waitFor(() => expect(second.element.dataset.state).toBe("ready"));

    expect(Number(second.element.dataset.firstReadableMs)).toBe(3_800);
    first.children[0]?.unload();
    second.children[0]?.unload();
  });

  it.each([
    ["malformed", "This PPTX is damaged or incomplete."],
    ["protected", "This PPTX is encrypted or password-protected."],
    ["resource-exhausted", "This PPTX is too large or complex"],
    ["incompatible", "This PPTX uses content this viewer cannot safely display."],
  ] as const)("bounds a %s renderer failure with source recovery", async (
    category,
    expected,
  ) => {
    const { element } = fixture(makeSession(), undefined, {
      open: vi.fn(async () => {
        throw new PptxOpenError(
          category as PptxOpenErrorCategory,
          "fixture failure",
        );
      }),
    });

    await vi.waitFor(() => expect(element.dataset.state).toBe("error"));

    expect(element.textContent).toContain(expected);
    expect(element.querySelector("a.internal-link")).not.toBeNull();
    expect(element.querySelector(".pptx-slide-embed__canvas")?.childElementCount)
      .toBe(0);
  });

  it("aborts in-flight adapter work and clears DOM when the render child unloads", async () => {
    let observedSignal: AbortSignal | undefined;
    const open = vi.fn(async (
      _buffer: ArrayBuffer,
      _container: HTMLElement,
      signal: AbortSignal,
    ): Promise<PptxRendererSession> => {
      observedSignal = signal;
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(
          new DOMException("aborted", "AbortError"),
        ), { once: true });
      });
      return makeSession();
    });
    const { children, element } = fixture(makeSession(), undefined, { open });
    await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());

    children[0]?.unload();

    expect(observedSignal?.aborted).toBe(true);
    expect(element.dataset.state).toBe("waiting");
    expect(element.querySelector(".pptx-slide-embed__canvas")?.childElementCount)
      .toBe(0);
  });

  it("offers the desktop fallback and reports a local launch failure", async () => {
    const openExternally = vi.fn(async () => {
      throw new Error("launch failed");
    });
    const { element } = fixture(makeSession(), undefined, { openExternally });
    await vi.waitFor(() => expect(element.dataset.state).toBe("ready"));

    element.querySelector<HTMLButtonElement>(
      '[data-action="open-externally"]',
    )!.click();

    await vi.waitFor(() => expect(openExternally).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(element.textContent).toContain(
      "Unable to open the default application.",
    ));
  });

  it("shows a stale placeholder without ordinal fallback", async () => {
    const session = makeSession();
    const { element } = fixture(
      session,
      "deck.pptx#slide-id=999&slide=2",
    );

    await vi.waitFor(() => {
      expect(element.dataset.state).toBe("stale-reference");
    });

    expect(session.renderSlide).not.toHaveBeenCalled();
    expect(session.dispose).toHaveBeenCalledOnce();
    expect(element.textContent).toContain(
      "The referenced slide is no longer available",
    );
  });

  it("restores Obsidian's native embed fallback when its render child unloads", async () => {
    globalThis.IntersectionObserver = undefined as never;
    const wrapper = document.createElement("div");
    const nativeEmbed = wrapper.createDiv({ cls: "internal-embed" });
    nativeEmbed.setAttribute("src", "deck.pptx#slide-id=261&slide=1");
    const file = Object.assign(new TFile(), {
      path: "deck.pptx",
      basename: "deck",
      extension: "pptx",
    });
    let child: MarkdownRenderChild | undefined;
    processPptxSlideEmbeds(wrapper, {
      sourcePath: "note.md",
      addChild: (created: MarkdownRenderChild) => {
        child = created;
        created.load();
      },
    } as never, {
      app: {
        vault: { readBinary: vi.fn(async () => new ArrayBuffer(8)) },
        metadataCache: { getFirstLinkpathDest: vi.fn(() => file) },
      } as never,
      renderer: { open: vi.fn(async () => makeSession()) },
      scheduler: new SlideEmbedScheduler(2),
      messages: ENGLISH_MESSAGE_TRANSLATOR,
      showDiagnostics: () => false,
    });

    await vi.waitFor(() => expect(
      wrapper.querySelector<HTMLElement>(".pptx-slide-embed")?.dataset.state,
    ).toBe("ready"));
    expect(nativeEmbed.hidden).toBe(true);

    child?.unload();

    expect(nativeEmbed.hidden).toBe(false);
    expect(nativeEmbed.classList.contains("pptx-slide-embed__native")).toBe(false);
    expect(nativeEmbed.dataset.pptxSlideEmbedProcessed).toBeUndefined();

    let replacement: MarkdownRenderChild | undefined;
    processPptxSlideEmbeds(wrapper, {
      sourcePath: "note.md",
      addChild: (created: MarkdownRenderChild) => {
        replacement = created;
        created.load();
      },
    } as never, {
      app: {
        vault: { readBinary: vi.fn(async () => new ArrayBuffer(8)) },
        metadataCache: { getFirstLinkpathDest: vi.fn(() => file) },
      } as never,
      renderer: { open: vi.fn(async () => makeSession()) },
      scheduler: new SlideEmbedScheduler(2),
      messages: ENGLISH_MESSAGE_TRANSLATOR,
      showDiagnostics: () => false,
    });
    expect(replacement).toBeDefined();
    replacement?.unload();
  });

  it("reports a missing source before allocating a renderer", () => {
    const element = document.createElement("div");
    element.className = "internal-embed";
    element.setAttribute("src", "missing.pptx#slide-id=256&slide=1");
    const open = vi.fn();

    processPptxSlideEmbeds(element, {
      sourcePath: "note.md",
      addChild: vi.fn(),
    } as never, {
      app: {
        metadataCache: { getFirstLinkpathDest: vi.fn(() => null) },
      } as never,
      renderer: { open },
      scheduler: new SlideEmbedScheduler(2),
      messages: ENGLISH_MESSAGE_TRANSLATOR,
      showDiagnostics: () => false,
    });

    expect(element.dataset.state).toBe("missing-source");
    expect(element.getAttribute("role")).toBe("group");
    expect(element.getAttribute("aria-label")).toBe(
      "The source presentation is no longer available.",
    );
    expect(element.textContent).toContain("source presentation is no longer available");
    expect(
      element.querySelector("a.internal-link")?.getAttribute("data-href"),
    ).toBe("missing.pptx#slide-id=256&slide=1");
    expect(open).not.toHaveBeenCalled();
  });

  it("restores a missing source's native fallback when the static child unloads", () => {
    const wrapper = document.createElement("div");
    const nativeEmbed = wrapper.createDiv({ cls: "internal-embed" });
    nativeEmbed.setAttribute(
      "src",
      "missing.pptx#slide-id=256&slide=1",
    );
    let child: MarkdownRenderChild | undefined;
    processPptxSlideEmbeds(wrapper, {
      sourcePath: "note.md",
      addChild: (created: MarkdownRenderChild) => {
        child = created;
        created.load();
      },
    } as never, {
      app: {
        metadataCache: { getFirstLinkpathDest: vi.fn(() => null) },
      } as never,
      renderer: { open: vi.fn() },
      scheduler: new SlideEmbedScheduler(2),
      messages: ENGLISH_MESSAGE_TRANSLATOR,
      showDiagnostics: () => false,
    });

    expect(nativeEmbed.hidden).toBe(true);
    child?.unload();
    expect(nativeEmbed.hidden).toBe(false);
    expect(wrapper.querySelector(".pptx-slide-embed")).toBeNull();
  });
});
