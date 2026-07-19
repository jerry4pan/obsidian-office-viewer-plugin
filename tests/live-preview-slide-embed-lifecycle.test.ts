import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorSelection, EditorState, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { ENGLISH_MESSAGE_TRANSLATOR } from "../src/i18n";
import { createLivePreviewSlideEmbedExtension } from "../src/live-preview-slide-embed";
import type { PptxRendererSession } from "../src/renderer/pptx-renderer-adapter";
import { SlideEmbedScheduler } from "../src/slide-embed-scheduler";

const originalIntersectionObserver = globalThis.IntersectionObserver;

afterEach(() => {
  globalThis.IntersectionObserver = originalIntersectionObserver;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("Live Preview slide embed lifecycle bounds", () => {
  it("observes viewport visibility instead of eagerly rendering off-screen widgets", async () => {
    const observed: HTMLElement[] = [];
    const callbacks: IntersectionObserverCallback[] = [];
    globalThis.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }
      observe(target: Element): void {
        observed.push(target as HTMLElement);
      }
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      readonly root = null;
      readonly rootMargin = "0px";
      readonly thresholds = [0];
    } as unknown as typeof IntersectionObserver;

    const livePreviewField = StateField.define<boolean>({
      create: () => true,
      update: (value) => value,
    });
    const sourcePathField = StateField.define<string>({
      create: () => "note.md",
      update: (value) => value,
    });
    const session: PptxRendererSession = {
      slideCount: 1,
      slideIdentities: [261],
      slideWidth: 16,
      slideHeight: 9,
      capabilities: { thumbnails: false, prefetch: false },
      compatibilityWarnings: [],
      renderSlide: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };
    const open = vi.fn(async () => session);
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "\n![[deck.pptx#slide-id=261&slide=1]]\n",
        selection: EditorSelection.cursor(0),
        extensions: [
          livePreviewField,
          sourcePathField,
          createLivePreviewSlideEmbedExtension({
            livePreviewField,
            getSourcePath: (state) => state.field(sourcePathField),
            resolveFile: () => ({ basename: "deck", path: "deck.pptx" }),
            readBinary: async () => new ArrayBuffer(8),
            renderer: { open },
            scheduler: new SlideEmbedScheduler(2),
            messages: ENGLISH_MESSAGE_TRANSLATOR,
            showDiagnostics: () => false,
          }),
        ],
      }),
    });

    await vi.waitFor(() => expect(observed.length).toBeGreaterThanOrEqual(1));
    expect(open).not.toHaveBeenCalled();

    const latest = callbacks.at(-1);
    latest?.([{ isIntersecting: true } as IntersectionObserverEntry], {
      disconnect() {},
    } as IntersectionObserver);
    await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());

    latest?.([{ isIntersecting: false } as IntersectionObserverEntry], {
      disconnect() {},
    } as IntersectionObserver);
    await vi.waitFor(() => expect(session.dispose).toHaveBeenCalled());
    view.destroy();
  });

  it("shares one scheduler so concurrent Live Preview opens stay at most two", async () => {
    globalThis.IntersectionObserver = undefined as never;
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const scheduler = new SlideEmbedScheduler(2);
    const open = vi.fn(async () => {
      await gate;
      return {
        slideCount: 1,
        slideIdentities: [261],
        slideWidth: 16,
        slideHeight: 9,
        capabilities: { thumbnails: false, prefetch: false },
        compatibilityWarnings: [],
        renderSlide: vi.fn(async () => undefined),
        dispose: vi.fn(),
      } satisfies PptxRendererSession;
    });

    const makeView = (doc: string) => {
      const livePreviewField = StateField.define<boolean>({
        create: () => true,
        update: (value) => value,
      });
      const sourcePathField = StateField.define<string>({
        create: () => "note.md",
        update: (value) => value,
      });
      const parent = document.createElement("div");
      document.body.append(parent);
      return new EditorView({
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
              resolveFile: () => ({ basename: "deck", path: "deck.pptx" }),
              readBinary: async () => new ArrayBuffer(8),
              renderer: { open },
              scheduler,
              messages: ENGLISH_MESSAGE_TRANSLATOR,
              showDiagnostics: () => false,
            }),
          ],
        }),
      });
    };

    const first = makeView("\n![[deck.pptx#slide-id=261&slide=1]]\n");
    const second = makeView("\n![[deck.pptx#slide-id=261&slide=1|two]]\n");
    const third = makeView("\n![[deck.pptx#slide-id=261&slide=1|three]]\n");

    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(2));
    expect(scheduler.activeCount).toBe(2);
    expect(open).toHaveBeenCalledTimes(2);

    releaseGate();
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(3));
    expect(scheduler.peakActiveCount).toBeLessThanOrEqual(2);

    first.destroy();
    second.destroy();
    third.destroy();
  });
});
