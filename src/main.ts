import { Plugin, TFile } from "obsidian";
import { OfficeViewerSettingTab } from "./office-viewer-setting-tab";
import { PptxFileView, PPTX_VIEW_TYPE } from "./pptx-file-view";
import {
  ReadingPositionStore,
  type FileFingerprint,
} from "./reading-position-store";
import { reportNonFatalError } from "./report-error";

function fingerprint(file: TFile): FileFingerprint {
  return {
    path: file.path,
    size: file.stat.size,
    mtime: file.stat.mtime,
  };
}

export default class OfficeViewerPlugin extends Plugin {
  private readonly views = new Set<PptxFileView>();
  private store: ReadingPositionStore | undefined;
  private unloading = false;

  override async onload(): Promise<void> {
    this.unloading = false;
    const store = new ReadingPositionStore({
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

    this.addSettingTab(new OfficeViewerSettingTab(this.app, this, store));
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile) store.rename(oldPath, fingerprint(file));
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) store.delete(file.path);
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
        },
      );
      this.views.add(view);
      return view;
    });
    this.registerExtensions(["pptx"], PPTX_VIEW_TYPE);
  }

  override onunload(): void {
    this.unloading = true;
    for (const view of [...this.views]) view.dispose();
    this.views.clear();
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
