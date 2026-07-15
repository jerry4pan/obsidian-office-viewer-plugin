import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
import {
  ENGLISH_MESSAGE_TRANSLATOR,
  type MessageTranslator,
} from "./i18n";
import type { ReadingPositionStore } from "./reading-position-store";
import { reportNonFatalError } from "./report-error";

export class OfficeViewerSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly store: ReadingPositionStore,
    private readonly messages: MessageTranslator = ENGLISH_MESSAGE_TRANSLATOR,
  ) {
    super(app, plugin);
  }

  override display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName(this.messages.text("settings.rememberPosition"))
      .setDesc(
        this.messages.text("settings.rememberPositionDescription"),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.store.settings.rememberReadingPosition)
          .onChange((value) => {
            void this.store.setRememberReadingPosition(value).catch((error: unknown) => {
              reportNonFatalError(
                "Failed to save PPTX reading-position setting",
                error,
              );
            });
          }),
      );
    new Setting(this.containerEl)
      .setName(this.messages.text("settings.localProcessing"))
      .setDesc(this.messages.text("settings.localProcessingDescription"));
    new Setting(this.containerEl)
      .setName(this.messages.text("settings.compatibility"))
      .setDesc(this.messages.text("settings.compatibilityDescription"));
    new Setting(this.containerEl)
      .setName(this.messages.text("settings.diagnostics"))
      .setDesc(this.messages.text("settings.diagnosticsDescription"));
  }
}
