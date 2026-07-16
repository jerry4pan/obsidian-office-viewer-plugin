import { PluginSettingTab, Setting, type App, type Plugin, type SettingDefinitionItem } from "obsidian";
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

  override getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: this.messages.text("settings.rememberPosition"),
        desc: this.messages.text("settings.rememberPositionDescription"),
        control: {
          type: "toggle",
          key: "rememberReadingPosition",
          defaultValue: true,
        },
      },
      {
        name: this.messages.text("settings.localProcessing"),
        desc: this.messages.text("settings.localProcessingDescription"),
      },
      {
        name: this.messages.text("settings.compatibility"),
        desc: this.messages.text("settings.compatibilityDescription"),
      },
      {
        name: this.messages.text("settings.diagnostics"),
        desc: this.messages.text("settings.diagnosticsDescription"),
        control: {
          type: "toggle",
          key: "diagnosticSummary",
          defaultValue: false,
        },
      },
    ];
  }

  override getControlValue(key: string): unknown {
    if (key === "rememberReadingPosition") {
      return this.store.settings.rememberReadingPosition;
    }
    if (key === "diagnosticSummary") {
      return this.store.settings.diagnosticSummary;
    }
    return undefined;
  }

  override setControlValue(key: string, value: unknown): void {
    if (key === "rememberReadingPosition") {
      void this.store.setRememberReadingPosition(Boolean(value)).catch((error: unknown) => {
        reportNonFatalError(
          "Failed to save PPTX reading-position setting",
          error,
        );
      });
      return;
    }
    if (key === "diagnosticSummary") {
      void this.store.setDiagnosticSummary(Boolean(value)).catch((error: unknown) => {
        reportNonFatalError(
          "Failed to save PPTX diagnostic-summary setting",
          error,
        );
      });
    }
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
      .setDesc(this.messages.text("settings.diagnosticsDescription"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.store.settings.diagnosticSummary)
          .onChange((value) => {
            void this.store.setDiagnosticSummary(value).catch((error: unknown) => {
              reportNonFatalError(
                "Failed to save PPTX diagnostic-summary setting",
                error,
              );
            });
          }),
      );
  }
}
