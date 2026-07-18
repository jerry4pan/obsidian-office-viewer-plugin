import { FileView, type App, type TFile, type WorkspaceLeaf } from "obsidian";
import {
  ENGLISH_MESSAGE_TRANSLATOR,
  type MessageTranslator,
} from "./i18n";
import { PptxViewSession } from "./pptx-view-session";
import type { PptxViewSessionDiagnostics } from "./pptx-view-session";
import type { DiagnosticEnvironment } from "./diagnostic-summary";
import { createPptxRendererAdapter } from "./renderer/create-pptx-renderer-adapter";
import {
  formatSlideReferenceMarkup,
  parseSlideReferenceFragment,
  type SlideReferenceTarget,
} from "./slide-reference";
import { createExternalOpenAction } from "./external-open";

export const PPTX_VIEW_TYPE = "pptx-viewer";

export interface PptxFileViewState {
  initialSlideFor(file: TFile, slideCount: number): number;
  record(file: TFile, slideIndex: number): void;
  initialThumbnailRailWidth(): number;
  recordThumbnailRailWidth(width: number): void;
  subscribeThumbnailRailWidth(listener: (width: number) => void): () => void;
  rememberReadingPosition(): boolean;
  diagnosticSummary(): boolean;
}

export class PptxFileView extends FileView {
  private readonly session: PptxViewSession<TFile>;
  private disposed = false;
  private currentFile: TFile | null = null;
  private pendingReferenceTarget: SlideReferenceTarget | undefined;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly onDisposed: () => void = () => {},
    state?: PptxFileViewState,
    private readonly messages: MessageTranslator = ENGLISH_MESSAGE_TRANSLATOR,
    diagnosticEnvironment?: DiagnosticEnvironment,
  ) {
    super(leaf);
    this.contentEl.replaceChildren();
    const root = this.contentEl.createDiv();
    this.session = new PptxViewSession(
      root,
      { readBinary: (file) => this.app.vault.readBinary(file) },
      createPptxRendererAdapter(),
      {
        messages: this.messages,
        openExternally: createExternalOpenAction(this.app),
        positions: state,
        thumbnailRail: state === undefined
          ? undefined
          : {
              initialWidth: () => state.initialThumbnailRailWidth(),
              recordWidth: (width) => state.recordThumbnailRailWidth(width),
              subscribeWidth: (listener) =>
                state.subscribeThumbnailRailWidth(listener),
            },
        diagnostics: diagnosticEnvironment === undefined
          ? undefined
          : {
              environment: diagnosticEnvironment,
              rememberReadingPosition: () =>
                state?.rememberReadingPosition() ?? false,
              enabled: () => state?.diagnosticSummary() ?? false,
              copy: async (summary) => navigator.clipboard.writeText(summary),
            },
        slideReferences: {
          copy: async (file, target, embed) => {
            const alias = this.messages.text("reference.alias", {
              name: file.basename,
              slide: target.createdSlideNumber,
            });
            await navigator.clipboard.writeText(formatSlideReferenceMarkup({
              sourcePath: file.path,
              alias,
              slideId: target.slideId,
              createdSlideNumber: target.createdSlideNumber,
              embed,
            }));
          },
        },
      },
    );
  }

  override getViewType(): string {
    return PPTX_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return this.file?.basename ?? this.messages.text("viewer.fallbackTitle");
  }

  getPerformanceDiagnostics(): PptxViewSessionDiagnostics {
    return this.session.getPerformanceDiagnostics();
  }

  override async onLoadFile(file: TFile): Promise<void> {
    this.currentFile = file;
    if (file.extension.toLowerCase() === "ppt") {
      this.pendingReferenceTarget = undefined;
      this.session.openUnsupportedLegacy(file, file.stat.size);
      return;
    }
    const referenceTarget = this.pendingReferenceTarget;
    this.pendingReferenceTarget = undefined;
    await this.session.open(file, referenceTarget);
    if (this.currentFile !== file || this.pendingReferenceTarget === undefined) {
      return;
    }
    const lateReferenceTarget = this.pendingReferenceTarget;
    if (this.session.navigateToReference(lateReferenceTarget)) {
      this.pendingReferenceTarget = undefined;
    }
  }

  override setEphemeralState(state: unknown): void {
    super.setEphemeralState(state);
    const subpath = typeof state === "object" && state !== null &&
        "subpath" in state && typeof state.subpath === "string"
      ? state.subpath
      : undefined;
    const target = subpath === undefined
      ? undefined
      : parseSlideReferenceFragment(subpath) ?? undefined;
    this.pendingReferenceTarget = target;
    if (
      target !== undefined &&
      this.currentFile !== null &&
      this.currentFile.extension.toLowerCase() === "pptx"
    ) {
      if (this.session.navigateToReference(target)) {
        this.pendingReferenceTarget = undefined;
      }
    }
  }

  override async onClose(): Promise<void> {
    this.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.currentFile = null;
    this.pendingReferenceTarget = undefined;
    this.session.dispose();
    this.contentEl.replaceChildren();
    this.onDisposed();
  }
}
