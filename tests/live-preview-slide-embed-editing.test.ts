import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorSelection, EditorState, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { ENGLISH_MESSAGE_TRANSLATOR } from "../src/i18n";
import { createLivePreviewSlideEmbedExtension } from "../src/live-preview-slide-embed";
import type { PptxRendererSession } from "../src/renderer/pptx-renderer-adapter";
import { SlideEmbedScheduler } from "../src/slide-embed-scheduler";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function makeSession(): PptxRendererSession {
  return {
    slideCount: 3,
    slideIdentities: [256, 261, 300],
    slideWidth: 16,
    slideHeight: 9,
    capabilities: { thumbnails: false, prefetch: false },
    compatibilityWarnings: [],
    renderSlide: vi.fn(async () => undefined),
    dispose: vi.fn(),
  };
}

function createEditingHarness(doc: string, cursor = 0) {
  const livePreviewField = StateField.define<boolean>({
    create: () => true,
    update: (value) => value,
  });
  const sourcePathField = StateField.define<string>({
    create: () => "note.md",
    update: (value) => value,
  });
  const open = vi.fn(async () => makeSession());
  const parent = document.createElement("div");
  document.body.append(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(cursor),
      extensions: [
        livePreviewField,
        sourcePathField,
        createLivePreviewSlideEmbedExtension({
          livePreviewField,
          getSourcePath: (state) => state.field(sourcePathField),
          resolveFile: (sourcePath) =>
            sourcePath.endsWith(".pptx")
              ? { basename: sourcePath.replace(/\.pptx$/i, "").split("/").pop()!, path: sourcePath }
              : null,
          readBinary: async () => new ArrayBuffer(8),
          renderer: { open },
          scheduler: new SlideEmbedScheduler(2),
          messages: ENGLISH_MESSAGE_TRANSLATOR,
          showDiagnostics: () => false,
        }),
      ],
    }),
  });
  return { view, open, parent };
}

const EMBED_A = "![[deck.pptx#slide-id=261&slide=1|deck — Slide 1]]";
const EMBED_B = "![[other.pptx#slide-id=256&slide=2|other — Slide 2]]";

describe("Live Preview slide embed editing semantics", () => {
  it("renders only standalone canonical embeds in a syntax matrix document", async () => {
    const doc = [
      "intro paragraph",
      "",
      `  ${EMBED_A}  `,
      "",
      `see ${EMBED_A}`,
      `${EMBED_A} ${EMBED_B}`,
      "![[deck.pptx]]",
      "![[note.md#slide-id=261&slide=1]]",
      "![[deck.pptx#slide-id=261&slide=1",
      "![[deck.pptx#slide=1]]",
      "",
      EMBED_B,
      "",
      "outro",
    ].join("\n");
    const { view, open } = createEditingHarness(doc, 0);

    await vi.waitFor(() => {
      expect(view.dom.querySelectorAll(".pptx-slide-embed").length).toBe(2);
    });
    expect(open).toHaveBeenCalledTimes(2);
    expect(view.state.doc.toString()).toBe(doc);
    view.destroy();
  });

  it("does not mutate Markdown when widgets appear, hide, or destroy", async () => {
    const doc = `before\n\n${EMBED_A}\n\nafter`;
    const embedFrom = "before\n\n".length;
    const { view } = createEditingHarness(doc, 0);

    await vi.waitFor(() => {
      expect(view.dom.querySelector(".pptx-slide-embed")).not.toBeNull();
    });
    expect(view.state.doc.toString()).toBe(doc);

    view.dispatch({ selection: EditorSelection.cursor(embedFrom + 3) });
    await vi.waitFor(() => {
      expect(view.dom.querySelector(".pptx-slide-embed")).toBeNull();
    });
    expect(view.state.doc.toString()).toBe(doc);

    view.dispatch({ selection: EditorSelection.cursor(0) });
    await vi.waitFor(() => {
      expect(view.dom.querySelector(".pptx-slide-embed")).not.toBeNull();
    });
    expect(view.state.doc.toString()).toBe(doc);

    view.destroy();
    expect(view.state.doc.toString()).toBe(doc);
  });

  it("keeps document and selection coherent for delete, range select, and multi-selection", async () => {
    const doc = `alpha\n\n${EMBED_A}\n\nomega`;
    const { view } = createEditingHarness(doc, 0);

    await vi.waitFor(() => {
      expect(view.dom.querySelector(".pptx-slide-embed")).not.toBeNull();
    });

    view.dispatch({
      changes: { from: 0, to: 1, insert: "" },
      selection: EditorSelection.cursor(0),
    });
    const afterDelete = `lpha\n\n${EMBED_A}\n\nomega`;
    expect(view.state.doc.toString()).toBe(afterDelete);
    await vi.waitFor(() => {
      expect(view.dom.querySelector(".pptx-slide-embed")).not.toBeNull();
    });

    const embedFrom = afterDelete.indexOf(EMBED_A);
    view.dispatch({
      selection: EditorSelection.range(embedFrom + 2, embedFrom + 6),
    });
    await vi.waitFor(() => {
      expect(view.dom.querySelector(".pptx-slide-embed")).toBeNull();
    });

    const after = view.state.doc.toString().lastIndexOf("omega");
    view.dispatch({
      changes: { from: after, to: after + 5, insert: "end" },
      selection: EditorSelection.cursor(after + 3),
    });
    expect(view.state.doc.toString().endsWith("end")).toBe(true);
    expect(view.state.doc.toString()).toContain(EMBED_A);
    view.destroy();

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
    const multiView = new EditorView({
      parent,
      state: EditorState.create({
        doc: afterDelete,
        selection: EditorSelection.cursor(0),
        extensions: [
          EditorState.allowMultipleSelections.of(true),
          livePreviewField,
          sourcePathField,
          createLivePreviewSlideEmbedExtension({
            livePreviewField,
            getSourcePath: (state) => state.field(sourcePathField),
            resolveFile: () => ({ basename: "deck", path: "deck.pptx" }),
            readBinary: async () => new ArrayBuffer(8),
            renderer: { open: vi.fn(async () => makeSession()) },
            scheduler: new SlideEmbedScheduler(2),
            messages: ENGLISH_MESSAGE_TRANSLATOR,
            showDiagnostics: () => false,
          }),
        ],
      }),
    });
    await vi.waitFor(() => {
      expect(multiView.dom.querySelector(".pptx-slide-embed")).not.toBeNull();
    });
    multiView.dispatch({
      selection: EditorSelection.create([
        EditorSelection.range(0, 1),
        EditorSelection.range(embedFrom + 1, embedFrom + 4),
      ]),
    });
    await vi.waitFor(() => {
      expect(multiView.dom.querySelector(".pptx-slide-embed")).toBeNull();
    });
    expect(multiView.state.doc.toString()).toBe(afterDelete);
    multiView.destroy();
  });

  it("preserves canonical markup through type-over of surrounding prose and select-all replace", async () => {
    const doc = `keep\n\n${EMBED_A}\n\ntail`;
    const { view } = createEditingHarness(doc, 0);
    await vi.waitFor(() => {
      expect(view.dom.querySelector(".pptx-slide-embed")).not.toBeNull();
    });

    view.dispatch({
      changes: { from: 0, to: 4, insert: "kept" },
      selection: EditorSelection.cursor(4),
    });
    expect(view.state.doc.toString()).toContain(EMBED_A);

    const whole = view.state.doc.toString();
    view.dispatch({
      changes: { from: 0, to: whole.length, insert: "replaced" },
      selection: EditorSelection.cursor(8),
    });
    expect(view.state.doc.toString()).toBe("replaced");
    expect(view.dom.querySelector(".pptx-slide-embed")).toBeNull();
    view.destroy();
  });

  it("round-trips Live Preview off and on without rewriting Markdown", async () => {
    const { StateEffect } = await import("@codemirror/state");
    const toggle = StateEffect.define<boolean>();
    const lpField = StateField.define<boolean>({
      create: () => true,
      update: (value, tr) => {
        for (const effect of tr.effects) {
          if (effect.is(toggle)) return effect.value;
        }
        return value;
      },
    });
    const sourcePathField = StateField.define<string>({
      create: () => "note.md",
      update: (value) => value,
    });
    const parent = document.createElement("div");
    document.body.append(parent);
    const doc = `\n${EMBED_A}\n`;
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        selection: EditorSelection.cursor(0),
        extensions: [
          lpField,
          sourcePathField,
          createLivePreviewSlideEmbedExtension({
            livePreviewField: lpField,
            getSourcePath: (state) => state.field(sourcePathField),
            resolveFile: () => ({ basename: "deck", path: "deck.pptx" }),
            readBinary: async () => new ArrayBuffer(8),
            renderer: { open: vi.fn(async () => makeSession()) },
            scheduler: new SlideEmbedScheduler(2),
            messages: ENGLISH_MESSAGE_TRANSLATOR,
            showDiagnostics: () => false,
          }),
        ],
      }),
    });

    await vi.waitFor(() => {
      expect(view.dom.querySelector(".pptx-slide-embed")).not.toBeNull();
    });
    view.dispatch({ effects: toggle.of(false) });
    await vi.waitFor(() => {
      expect(view.dom.querySelector(".pptx-slide-embed")).toBeNull();
    });
    expect(view.state.doc.toString()).toBe(doc);
    view.dispatch({ effects: toggle.of(true) });
    await vi.waitFor(() => {
      expect(view.dom.querySelector(".pptx-slide-embed")).not.toBeNull();
    });
    expect(view.state.doc.toString()).toBe(doc);
    expect(view.dom.querySelectorAll(".pptx-slide-embed").length).toBe(1);
    view.destroy();
  });
});
