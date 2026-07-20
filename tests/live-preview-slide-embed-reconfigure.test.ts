import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Compartment,
  EditorSelection,
  EditorState,
  StateField,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { ENGLISH_MESSAGE_TRANSLATOR } from "../src/i18n";
import { createLivePreviewSlideEmbedExtension } from "../src/live-preview-slide-embed";
import { SlideEmbedScheduler } from "../src/slide-embed-scheduler";

const originalIntersectionObserver = globalThis.IntersectionObserver;

afterEach(() => {
  globalThis.IntersectionObserver = originalIntersectionObserver;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("Live Preview slide embed reconfigure", () => {
  it("survives compartment reconfigure that adds the extension after editor creation", () => {
    // Obsidian's registerEditorExtension reconfigures a compartment on every
    // open Markdown editor. CodeMirror then runs StateField.update with a
    // startState that does not yet contain the newly added fields. Accessing
    // those fields with the default (required) field() throws and aborts
    // plugin load ("Field is not present in this state").
    globalThis.IntersectionObserver = undefined as never;
    const livePreviewField = StateField.define<boolean>({
      create: () => true,
      update: (value) => value,
    });
    const sourcePathField = StateField.define<string>({
      create: () => "note.md",
      update: (value) => value,
    });
    const compartment = new Compartment();
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "hello\n",
        selection: EditorSelection.cursor(0),
        extensions: [livePreviewField, sourcePathField, compartment.of([])],
      }),
    });

    expect(() => {
      view.dispatch({
        effects: compartment.reconfigure(
          createLivePreviewSlideEmbedExtension({
            livePreviewField,
            getSourcePath: (state) => state.field(sourcePathField, false) ?? "",
            resolveFile: () => null,
            readBinary: async () => new ArrayBuffer(8),
            renderer: {
              open: async () => {
                throw new Error("unused");
              },
            },
            scheduler: new SlideEmbedScheduler(2),
            messages: ENGLISH_MESSAGE_TRANSLATOR,
            showDiagnostics: () => false,
          }),
        ),
      });
    }).not.toThrow();

    expect(view.state.doc.toString()).toBe("hello\n");
    view.destroy();
  });

  it("survives compartment reconfigure that removes the extension", () => {
    globalThis.IntersectionObserver = undefined as never;
    const livePreviewField = StateField.define<boolean>({
      create: () => true,
      update: (value) => value,
    });
    const sourcePathField = StateField.define<string>({
      create: () => "note.md",
      update: (value) => value,
    });
    const compartment = new Compartment();
    const extension = createLivePreviewSlideEmbedExtension({
      livePreviewField,
      getSourcePath: (state) => state.field(sourcePathField, false) ?? "",
      resolveFile: () => null,
      readBinary: async () => new ArrayBuffer(8),
      renderer: {
        open: async () => {
          throw new Error("unused");
        },
      },
      scheduler: new SlideEmbedScheduler(2),
      messages: ENGLISH_MESSAGE_TRANSLATOR,
      showDiagnostics: () => false,
    });
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "hello\n",
        selection: EditorSelection.cursor(0),
        extensions: [
          livePreviewField,
          sourcePathField,
          compartment.of(extension),
        ],
      }),
    });

    expect(() => {
      view.dispatch({ effects: compartment.reconfigure([]) });
    }).not.toThrow();

    view.destroy();
  });
});
