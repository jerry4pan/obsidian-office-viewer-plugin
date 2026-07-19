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
import {
  matchStandaloneSlideEmbedLine,
  type SlideReferenceTarget,
} from "./slide-reference";
import { SlideEmbedScheduler } from "./slide-embed-scheduler";

export interface LivePreviewSlideEmbedOptions<
  TFile extends SlideEmbedSourceFile = SlideEmbedSourceFile,
> {
  readonly livePreviewField: StateField<boolean>;
  readonly getSourcePath: (state: EditorState) => string;
  readonly resolveFile: (sourcePath: string, notePath: string) => TFile | null;
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
  private observer: IntersectionObserver | null = null;

  constructor(
    private readonly from: number,
    private readonly sourcePath: string,
    private readonly target: SlideReferenceTarget,
    private readonly notePath: string,
    private readonly options: LivePreviewSlideEmbedOptions<TFile>,
  ) {
    super();
  }

  override eq(other: LivePreviewSlideEmbedWidget<TFile>): boolean {
    return this.from === other.from
      && this.sourcePath === other.sourcePath
      && this.target.slideId === other.target.slideId
      && this.target.createdSlideNumber === other.target.createdSlideNumber
      && this.notePath === other.notePath;
  }

  override toDOM(view: EditorView): HTMLElement {
    const host = document.createElement("div");
    const file = this.options.resolveFile(this.sourcePath, this.notePath);
    const { options, notePath, sourcePath, target, from } = this;
    this.controller = new SlideEmbedController(host, {
      readBinary: options.readBinary,
      renderer: options.renderer,
      scheduler: options.scheduler,
      messages: options.messages,
      showDiagnostics: options.showDiagnostics,
      openExternally: options.openExternally,
    });
    this.controller.mount({ file, sourcePath, target });
    if (file !== null) {
      if (typeof IntersectionObserver === "undefined") {
        this.controller.setVisible(true);
      } else {
        this.observer = new IntersectionObserver((entries) => {
          this.controller?.setVisible(entries.some((entry) => entry.isIntersecting));
        }, { rootMargin: "600px 0px" });
        this.observer.observe(host);
      }
    }
    const sourceLink = host.querySelector<HTMLAnchorElement>("a.internal-link");
    if (sourceLink !== null && options.openSource !== undefined) {
      sourceLink.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void options.openSource!(sourceLink.dataset.href ?? sourcePath, notePath);
      });
    }
    host.addEventListener("click", (event) => {
      const el = event.target;
      if (!(el instanceof Element)) return;
      if (el.closest("a.internal-link, [data-action='open-externally']")) return;
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({ selection: EditorSelection.cursor(from + 1) });
    });
    return host;
  }

  override destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.controller?.dispose();
    this.controller = null;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

function selectionTouches(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

function isLivePreviewEditorSurface(view: EditorView, livePreview: boolean): boolean {
  if (!livePreview) return false;
  const sourceView = view.dom.closest(".markdown-source-view");
  if (!(sourceView instanceof HTMLElement)) return true;
  return sourceView.classList.contains("is-live-preview")
    && getComputedStyle(sourceView).display !== "none";
}

function buildDecorations<TFile extends SlideEmbedSourceFile>(
  state: EditorState,
  options: LivePreviewSlideEmbedOptions<TFile>,
  surfaceActive: boolean,
): DecorationSet {
  if (!surfaceActive || !state.field(options.livePreviewField)) return Decoration.none;
  const notePath = options.getSourcePath(state);
  const builder = new RangeSetBuilder<Decoration>();
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const match = matchStandaloneSlideEmbedLine(line.text);
    if (match === null) continue;
    const from = line.from + match.fromOffset;
    const blockFrom = line.from;
    const blockTo = lineNumber < state.doc.lines ? line.to + 1 : line.from + match.toOffset;
    if (selectionTouches(state, blockFrom, blockTo)) continue;
    builder.add(
      blockFrom,
      blockTo,
      Decoration.replace({
        widget: new LivePreviewSlideEmbedWidget(
          from,
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

export function createLivePreviewSlideEmbedExtension<
  TFile extends SlideEmbedSourceFile = SlideEmbedSourceFile,
>(
  options: LivePreviewSlideEmbedOptions<TFile>,
): Extension {
  const setSurfaceActive = StateEffect.define<boolean>();
  const surfaceActiveField = StateField.define<boolean>({
    create: () => true,
    update: (value, tr) => {
      for (const effect of tr.effects) {
        if (effect.is(setSurfaceActive)) return effect.value;
      }
      return value;
    },
  });

  const decorationsField = StateField.define<DecorationSet>({
    create: (state) =>
      buildDecorations(state, options, state.field(surfaceActiveField)),
    update: (decorations, tr) => {
      if (
        tr.docChanged
        || tr.selection
        || tr.startState.field(options.livePreviewField)
          !== tr.state.field(options.livePreviewField)
        || tr.startState.field(surfaceActiveField)
          !== tr.state.field(surfaceActiveField)
      ) {
        return buildDecorations(
          tr.state,
          options,
          tr.state.field(surfaceActiveField),
        );
      }
      return decorations.map(tr.changes);
    },
    provide: (value) => Prec.highest(EditorView.decorations.from(value)),
  });

  const surfaceMonitor = ViewPlugin.fromClass(class {
    private readonly observer: MutationObserver;
    constructor(private readonly view: EditorView) {
      this.observer = new MutationObserver(() => this.sync());
      const leaf = view.dom.closest(".workspace-leaf-content");
      if (leaf instanceof HTMLElement) {
        this.observer.observe(leaf, {
          attributes: true,
          attributeFilter: ["data-mode", "class"],
        });
      }
      const source = view.dom.closest(".markdown-source-view");
      if (source instanceof HTMLElement) {
        this.observer.observe(source, {
          attributes: true,
          attributeFilter: ["class", "style"],
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
      if (active !== this.view.state.field(surfaceActiveField)) {
        this.view.dispatch({ effects: setSurfaceActive.of(active) });
      }
    }
  });

  return [surfaceActiveField, decorationsField, surfaceMonitor];
}
