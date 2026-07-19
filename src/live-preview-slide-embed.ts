import {
  EditorSelection,
  Prec,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import type { MessageTranslator } from "./i18n";
import type { PptxRendererAdapter } from "./renderer/pptx-renderer-adapter";
import {
  SlideEmbedController,
  type SlideEmbedSourceFile,
} from "./slide-embed-core";
import { matchStandaloneSlideEmbedLine } from "./slide-embed-line";
import type { SlideReferenceTarget } from "./slide-reference";
import { SlideEmbedScheduler } from "./slide-embed-scheduler";

export interface LivePreviewSlideEmbedOptions<
  TFile extends SlideEmbedSourceFile = SlideEmbedSourceFile,
> {
  readonly livePreviewField: StateField<boolean>;
  readonly getSourcePath: (state: EditorState) => string;
  readonly resolveFile: (
    sourcePath: string,
    notePath: string,
  ) => TFile | null;
  readonly readBinary: (file: TFile) => Promise<ArrayBuffer>;
  readonly renderer: PptxRendererAdapter;
  readonly scheduler: SlideEmbedScheduler;
  readonly messages: MessageTranslator;
  readonly showDiagnostics: () => boolean;
  readonly openExternally?: (file: TFile) => Promise<void>;
  readonly openSource?: (linkTarget: string, notePath: string) => void | Promise<void>;
}

class LivePreviewSlideEmbedWidget<
  TFile extends SlideEmbedSourceFile = SlideEmbedSourceFile,
> extends WidgetType {
  private controller: SlideEmbedController<TFile> | null = null;

  constructor(
    private readonly from: number,
    private readonly to: number,
    private readonly sourcePath: string,
    private readonly target: SlideReferenceTarget,
    private readonly notePath: string,
    private readonly options: LivePreviewSlideEmbedOptions<TFile>,
  ) {
    super();
  }

  override eq(other: LivePreviewSlideEmbedWidget<TFile>): boolean {
    return (
      this.from === other.from
      && this.to === other.to
      && this.sourcePath === other.sourcePath
      && this.target.slideId === other.target.slideId
      && this.target.createdSlideNumber === other.target.createdSlideNumber
      && this.notePath === other.notePath
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const host = document.createElement("div");
    const file = this.options.resolveFile(this.sourcePath, this.notePath);
    const notePath = this.notePath;
    this.controller = new SlideEmbedController(host, {
      readBinary: this.options.readBinary,
      renderer: this.options.renderer,
      scheduler: this.options.scheduler,
      messages: this.options.messages,
      showDiagnostics: this.options.showDiagnostics,
      openExternally: this.options.openExternally,
      openSource: this.options.openSource === undefined
        ? undefined
        : (linkTarget) => this.options.openSource!(linkTarget, notePath),
    });
    this.controller.mount({
      file,
      sourcePath: this.sourcePath,
      target: this.target,
    });
    if (file !== null) {
      this.controller.setVisible(true);
    }
    const revealSyntax = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest("a.internal-link") !== null
        || target.closest('[data-action="open-externally"]') !== null
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        selection: EditorSelection.cursor(this.from + 1),
      });
    };
    host.addEventListener("mousedown", revealSyntax);
    host.addEventListener("click", revealSyntax);
    return host;
  }

  override destroy(): void {
    this.controller?.dispose();
    this.controller = null;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

function selectionTouches(state: EditorState, from: number, to: number): boolean {
  for (const range of state.selection.ranges) {
    if (range.from <= to && range.to >= from) return true;
  }
  return false;
}

function isLivePreviewEditorSurface(
  view: EditorView,
  livePreview: boolean,
): boolean {
  if (!livePreview) return false;
  const sourceView = view.dom.closest(".markdown-source-view");
  // Focused EditorView harnesses do not wrap Obsidian chrome.
  if (!(sourceView instanceof HTMLElement)) return true;
  if (!sourceView.classList.contains("is-live-preview")) return false;
  return getComputedStyle(sourceView).display !== "none";
}

function buildDecorations<TFile extends SlideEmbedSourceFile>(
  state: EditorState,
  options: LivePreviewSlideEmbedOptions<TFile>,
  surfaceActive: boolean,
): DecorationSet {
  if (!surfaceActive || !state.field(options.livePreviewField)) {
    return Decoration.none;
  }
  const notePath = options.getSourcePath(state);
  const builder = new RangeSetBuilder<Decoration>();
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const match = matchStandaloneSlideEmbedLine(line.text);
    if (match === null) continue;
    const from = line.from + match.fromOffset;
    const to = line.from + match.toOffset;
    // Include the trailing line break when present so the block widget fully
    // replaces Obsidian's native file-embed line decoration.
    const blockFrom = line.from;
    const blockTo = lineNumber < state.doc.lines ? line.to + 1 : to;
    if (selectionTouches(state, blockFrom, blockTo)) continue;
    builder.add(
      blockFrom,
      blockTo,
      Decoration.replace({
        widget: new LivePreviewSlideEmbedWidget(
          from,
          to,
          match.sourcePath,
          match.target,
          notePath,
          options,
        ),
        block: true,
      }),
    );
  }
  return builder.finish();
}

/**
 * Public Live Preview editor extension. Uses a StateField + Prec.highest so
 * block replace widgets can override Obsidian's native file-embed decoration
 * for standalone canonical PPTX slide embeds. Decorations clear when the
 * Markdown source view is hidden (Reading View), releasing renderer work.
 */
export function createLivePreviewSlideEmbedExtension<
  TFile extends SlideEmbedSourceFile = SlideEmbedSourceFile,
>(
  options: LivePreviewSlideEmbedOptions<TFile>,
): Extension {
  const setSurfaceActive = StateEffect.define<boolean>();
  const surfaceActiveField = StateField.define<boolean>({
    create: () => true,
    update: (value, transaction) => {
      for (const effect of transaction.effects) {
        if (effect.is(setSurfaceActive)) return effect.value;
      }
      return value;
    },
  });

  const decorationsField = StateField.define<DecorationSet>({
    create: (state) =>
      buildDecorations(state, options, state.field(surfaceActiveField)),
    update: (decorations, transaction) => {
      const livePreviewChanged =
        transaction.startState.field(options.livePreviewField)
        !== transaction.state.field(options.livePreviewField);
      const surfaceChanged =
        transaction.startState.field(surfaceActiveField)
        !== transaction.state.field(surfaceActiveField);
      if (
        transaction.docChanged
        || transaction.selection
        || livePreviewChanged
        || surfaceChanged
      ) {
        return buildDecorations(
          transaction.state,
          options,
          transaction.state.field(surfaceActiveField),
        );
      }
      return decorations.map(transaction.changes);
    },
    provide: (value) => Prec.highest(EditorView.decorations.from(value)),
  });

  const surfaceMonitor = ViewPlugin.fromClass(class {
    private readonly observer: MutationObserver;

    constructor(private readonly view: EditorView) {
      this.observer = new MutationObserver(() => this.sync());
      const sourceView = view.dom.closest(".markdown-source-view");
      const leafContent = view.dom.closest(".workspace-leaf-content");
      if (sourceView instanceof HTMLElement) {
        this.observer.observe(sourceView, {
          attributes: true,
          attributeFilter: ["class", "style"],
        });
      }
      if (leafContent instanceof HTMLElement) {
        this.observer.observe(leafContent, {
          attributes: true,
          attributeFilter: ["data-mode", "class"],
        });
      }
      this.sync();
    }

    update(): void {
      this.sync();
    }

    destroy(): void {
      this.observer.disconnect();
    }

    private sync(): void {
      const active = isLivePreviewEditorSurface(
        this.view,
        this.view.state.field(options.livePreviewField),
      );
      if (active === this.view.state.field(surfaceActiveField)) return;
      this.view.dispatch({ effects: setSurfaceActive.of(active) });
    }
  });

  return [surfaceActiveField, decorationsField, surfaceMonitor];
}
