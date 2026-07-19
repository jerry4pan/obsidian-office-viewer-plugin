import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorSelection, EditorState, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { ENGLISH_MESSAGE_TRANSLATOR } from "../src/i18n";
import { createLivePreviewSlideEmbedExtension } from "../src/live-preview-slide-embed";
import { PptxOpenError, type PptxOpenErrorCategory } from "../src/pptx-open-error";
import type { PptxRendererSession } from "../src/renderer/pptx-renderer-adapter";
import { SlideEmbedScheduler } from "../src/slide-embed-scheduler";

const originalIntersectionObserver = globalThis.IntersectionObserver;

afterEach(() => {
  globalThis.IntersectionObserver = originalIntersectionObserver;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function makeSession(
  identities: readonly number[] = [256, 261],
): PptxRendererSession {
  return {
    slideCount: identities.length,
    slideIdentities: identities,
    slideWidth: 16,
    slideHeight: 9,
    capabilities: { thumbnails: false, prefetch: false },
    compatibilityWarnings: ["unsupported-content"],
    renderSlide: vi.fn(async () => undefined),
    dispose: vi.fn(),
  };
}

function createFailureHarness(options: {
  readonly doc?: string;
  readonly open?: () => Promise<PptxRendererSession>;
  readonly resolveFile?: (sourcePath: string) => { basename: string; path: string } | null;
  readonly showDiagnostics?: () => boolean;
  readonly openExternally?: () => Promise<void>;
}) {
  const livePreviewField = StateField.define<boolean>({
    create: () => true,
    update: (value) => value,
  });
  const sourcePathField = StateField.define<string>({
    create: () => "note.md",
    update: (value) => value,
  });
  const open = vi.fn(options.open ?? (async () => makeSession()));
  const parent = document.createElement("div");
  document.body.append(parent);
  globalThis.IntersectionObserver = undefined as never;
  const doc = options.doc ?? "\n![[deck.pptx#slide-id=261&slide=1|deck]]\n";
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(0),
      extensions: [
        livePreviewField,
        sourcePathField,
        createLivePreviewSlideEmbedExtension({
          livePreviewField,
          getSourcePath: (state) => state.field(sourcePathField),
          resolveFile: options.resolveFile
            ?? ((sourcePath) =>
              sourcePath === "deck.pptx"
                ? { basename: "deck", path: "deck.pptx" }
                : null),
          readBinary: async () => new ArrayBuffer(8),
          renderer: { open },
          scheduler: new SlideEmbedScheduler(2),
          messages: ENGLISH_MESSAGE_TRANSLATOR,
          showDiagnostics: options.showDiagnostics ?? (() => false),
          openExternally: options.openExternally,
        }),
      ],
    }),
  });
  return { view, open, parent };
}

describe("Live Preview slide embed trusted failures", () => {
  it("reports missing source without allocating a renderer", async () => {
    const { view, open } = createFailureHarness({
      resolveFile: () => null,
    });
    await vi.waitFor(() => {
      expect(
        view.dom.querySelector(".pptx-slide-embed")?.getAttribute("data-state"),
      ).toBe("missing-source");
    });
    expect(open).not.toHaveBeenCalled();
    expect(view.dom.querySelector(".pptx-slide-embed")?.getAttribute("role")).toBe(
      "group",
    );
    expect(view.dom.querySelector("a.internal-link")).not.toBeNull();
    const cursorBefore = view.state.selection.main.from;
    view.dom.querySelector<HTMLAnchorElement>("a.internal-link")!.focus();
    expect(view.state.selection.main.from).toBe(cursorBefore);
    view.destroy();
  });

  it("shows stale-reference without ordinal fallback", async () => {
    const session = makeSession([256]);
    const { view } = createFailureHarness({
      doc: "\n![[deck.pptx#slide-id=999&slide=2|deck]]\n",
      open: async () => session,
    });
    await vi.waitFor(() => {
      expect(
        view.dom.querySelector(".pptx-slide-embed")?.getAttribute("data-state"),
      ).toBe("stale-reference");
    });
    expect(session.renderSlide).not.toHaveBeenCalled();
    expect(view.dom.textContent).toContain(
      "The referenced slide is no longer available",
    );
    view.destroy();
  });

  it.each([
    ["malformed", "This PPTX is damaged or incomplete."],
    ["protected", "This PPTX is encrypted or password-protected."],
    ["resource-exhausted", "This PPTX is too large or complex"],
    ["incompatible", "This PPTX uses content this viewer cannot safely display."],
  ] as const)("bounds a %s failure with recovery chrome", async (category, message) => {
    const { view } = createFailureHarness({
      open: async () => {
        throw new PptxOpenError(category as PptxOpenErrorCategory, "fixture");
      },
    });
    await vi.waitFor(() => {
      expect(
        view.dom.querySelector(".pptx-slide-embed")?.getAttribute("data-state"),
      ).toBe("error");
    });
    const host = view.dom.querySelector(".pptx-slide-embed")!;
    expect(host.textContent).toContain(message);
    expect(host.querySelector("a.internal-link")).not.toBeNull();
    expect(host.getAttribute("aria-label")).toContain(message.slice(0, 12));
    view.destroy();
  });

  it("keeps diagnostics optional and reports external-open failure without moving selection", async () => {
    const session = {
      ...makeSession(),
      detectCompatibilityWarnings: () => {
        throw new Error("detector failed");
      },
    };
    const openExternally = vi.fn(async () => {
      throw new Error("launch failed");
    });
    const { view } = createFailureHarness({
      open: async () => session,
      showDiagnostics: () => true,
      openExternally,
    });
    await vi.waitFor(() => {
      expect(
        view.dom.querySelector(".pptx-slide-embed")?.getAttribute("data-state"),
      ).toBe("ready");
    });
    expect(view.dom.textContent).toContain("deck — Slide 2");
    const cursor = view.state.selection.main.from;
    view.dom.querySelector<HTMLButtonElement>(
      '[data-action="open-externally"]',
    )!.click();
    await vi.waitFor(() => expect(openExternally).toHaveBeenCalledOnce());
    await vi.waitFor(() => {
      expect(view.dom.textContent).toContain(
        "Unable to open the default application.",
      );
    });
    expect(view.state.selection.main.from).toBe(cursor);
    view.destroy();
  });
});
