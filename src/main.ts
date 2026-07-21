import {
  apiVersion,
  editorInfoField,
  editorLivePreviewField,
  getLanguage,
  Plugin,
  TFile,
  type MarkdownRenderChild,
} from "obsidian";
import manifest from "../manifest.json" with { type: "json" };
import releaseContract from "../release-contract.json" with { type: "json" };
import { createMessageTranslator } from "./i18n";
import { createLivePreviewSlideEmbedExtension } from "./live-preview-slide-embed";
import { OfficeViewerSettingTab } from "./office-viewer-setting-tab";
import { PptxFileView, PPTX_VIEW_TYPE } from "./pptx-file-view";
import {
  OfficeViewerDataStore,
  type FileFingerprint,
} from "./office-viewer-data-store";
import { reportNonFatalError } from "./report-error";
import { processPptxSlideEmbeds } from "./pptx-slide-embed";
import { createPptxRendererAdapter } from "./renderer/create-pptx-renderer-adapter";
import { SlideEmbedScheduler } from "./slide-embed-scheduler";
import { createExternalOpenAction } from "./external-open";
import { resolveSlideEmbedFile } from "./resolve-slide-embed-file";
import { createCompanionNoteVault } from "./companion-note-vault";
import { PresentationCompanionNoteService } from "./presentation-companion-note-service";

function fingerprint(file: TFile): FileFingerprint {
  return {
    path: file.path,
    size: file.stat.size,
    mtime: file.stat.mtime,
  };
}

export default class OfficeViewerPlugin extends Plugin {
  private readonly views = new Set<PptxFileView>();
  private store: OfficeViewerDataStore | undefined;
  private companionNotes: PresentationCompanionNoteService | undefined;
  private embedScheduler: SlideEmbedScheduler | undefined;
  private readonly embedChildren = new Set<MarkdownRenderChild>();
  private unloading = false;

  override async onload(): Promise<void> {
    this.unloading = false;
    const messages = createMessageTranslator(getLanguage());
    const diagnosticEnvironment = {
      pluginVersion: manifest.version,
      obsidianVersion: apiVersion,
      rendererVersion: process.env.PPTX_RENDERER_VERSION ?? "unknown",
      operatingSystem: `${process.platform}-${process.arch}`,
    };
    const store = new OfficeViewerDataStore({
      loadData: () => this.loadData(),
      saveData: (data) => this.saveData(data),
    });
    this.store = store;

    try {
      await store.initialize();
    } catch (error) {
      if (this.store === store) this.store = undefined;
      await store.dispose().catch(() => undefined);
      throw error;
    }

    if (this.unloading || this.store !== store) {
      await store.dispose().catch(() => undefined);
      return;
    }

    const companionNotes = new PresentationCompanionNoteService(
      store,
      createCompanionNoteVault(this.app),
    );
    this.companionNotes = companionNotes;
    companionNotes.reconcile();

    const embedScheduler = new SlideEmbedScheduler(2);
    this.embedScheduler = embedScheduler;

    this.addSettingTab(
      new OfficeViewerSettingTab(this.app, this, store, messages),
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (!(file instanceof TFile)) return;
        store.rename(oldPath, fingerprint(file));
        const extension = file.extension.toLowerCase();
        if (extension === "pptx") {
          void companionNotes.handleSourceRename(oldPath, file.path).catch(
            (error: unknown) => {
              reportNonFatalError(
                "Failed to migrate presentation companion note",
                error,
              );
            },
          );
        } else if (extension === "md") {
          void companionNotes.handleNoteRename(oldPath, file.path).catch(
            (error: unknown) => {
              reportNonFatalError(
                "Failed to handle companion note rename",
                error,
              );
            },
          );
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (!(file instanceof TFile)) return;
        store.delete(file.path);
        void companionNotes.handleDelete(file.path);
      }),
    );
    this.registerView(PPTX_VIEW_TYPE, (leaf) => {
      let view: PptxFileView;
      view = new PptxFileView(
        leaf,
        () => this.views.delete(view),
        {
          initialSlideFor: (file, slideCount) =>
            store.resolve(fingerprint(file), slideCount),
          record: (file, slideIndex) =>
            store.record(fingerprint(file), slideIndex),
          initialThumbnailRailWidth: () => store.settings.thumbnailRailWidth,
          recordThumbnailRailWidth: (width) =>
            store.setThumbnailRailWidth(width),
          subscribeThumbnailRailWidth: (listener) =>
            store.subscribeThumbnailRailWidth(listener),
          rememberReadingPosition: () =>
            store.settings.rememberReadingPosition,
          diagnosticSummary: () => store.settings.diagnosticSummary,
          ensureCompanionNote: (sourcePath) =>
            companionNotes.ensureCompanionNote(sourcePath),
        },
        messages,
        diagnosticEnvironment,
      );
      this.views.add(view);
      return view;
    });
    const embedRenderer = createPptxRendererAdapter();
    const openExternally = createExternalOpenAction(this.app);
    this.registerMarkdownPostProcessor((element, context) => {
      processPptxSlideEmbeds(element, context, {
        app: this.app,
        renderer: embedRenderer,
        scheduler: embedScheduler,
        messages,
        showDiagnostics: () => store.settings.diagnosticSummary,
        openExternally,
        lifecycle: {
          register: (child) => this.embedChildren.add(child),
          unregister: (child) => this.embedChildren.delete(child),
        },
      });
    }, 100);
    this.registerEditorExtension(
      createLivePreviewSlideEmbedExtension({
        livePreviewField: editorLivePreviewField,
        getSourcePath: (state) =>
          state.field(editorInfoField, false)?.file?.path ?? "",
        resolveFile: (sourcePath, notePath) =>
          resolveSlideEmbedFile(this.app, sourcePath, notePath),
        readBinary: (file) => this.app.vault.readBinary(file),
        renderer: embedRenderer,
        scheduler: embedScheduler,
        messages,
        showDiagnostics: () => store.settings.diagnosticSummary,
        openExternally,
        openSource: (linkTarget, notePath) => {
          void this.app.workspace.openLinkText(linkTarget, notePath);
        },
      }),
    );
    this.registerExtensions([...releaseContract.supportedExtensions], PPTX_VIEW_TYPE);
  }

  override onunload(): void {
    this.unloading = true;
    for (const view of [...this.views]) view.dispose();
    this.views.clear();
    for (const child of [...this.embedChildren]) child.unload();
    this.embedChildren.clear();
    this.embedScheduler?.dispose();
    this.embedScheduler = undefined;
    this.companionNotes = undefined;
    const store = this.store;
    this.store = undefined;
    if (store !== undefined) {
      void store.dispose().catch((error: unknown) => {
        reportNonFatalError(
          "Failed to save PPTX reading positions during unload",
          error,
        );
      });
    }
  }
}
