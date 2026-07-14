import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
import type { ReadingPositionStore } from "./reading-position-store";

export class OfficeViewerSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly store: ReadingPositionStore,
  ) {
    super(app, plugin);
  }

  override display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Remember reading position")
      .setDesc(
        "Store only the last slide number and a local file-change fingerprint.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.store.settings.rememberReadingPosition)
          .onChange((value) => {
            void this.store.setRememberReadingPosition(value).catch((error: unknown) => {
              console.error(
                "Failed to save PPTX reading-position setting",
                error,
              );
            });
          }),
      );
  }
}
