import { PluginSettingTab, Setting, type App, type Plugin, type SettingDefinitionItem } from "obsidian";
import {
  BUY_ME_A_COFFEE_BUTTON_SRC,
  BUY_ME_A_COFFEE_URL,
  GITHUB_SPONSORS_BUTTON_SRC,
  GITHUB_SPONSORS_URL,
} from "./donate-button-assets";
import {
  ENGLISH_MESSAGE_TRANSLATOR,
  type MessageTranslator,
} from "./i18n";
import type { OfficeViewerDataStore } from "./office-viewer-data-store";
import { reportNonFatalError } from "./report-error";

function labelToggle(toggle: import("obsidian").ToggleComponent, label: string): void {
  const input = toggle.toggleEl.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  (input ?? toggle.toggleEl).setAttribute("aria-label", label);
}

function createDonateImageLink(
  document: Document,
  label: string,
  href: string,
  imageSrc: string,
): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = "office-viewer-donate__button";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", label);
  link.title = label;
  const image = document.createElement("img");
  image.className = "office-viewer-donate__image";
  image.src = imageSrc;
  image.alt = label;
  image.height = 40;
  link.append(image);
  return link;
}

export class OfficeViewerSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly store: OfficeViewerDataStore,
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
        {
          labelToggle(toggle, this.messages.text("settings.rememberPosition"));
          toggle.setValue(this.store.settings.rememberReadingPosition).onChange((value) => {
            void this.store.setRememberReadingPosition(value).catch((error: unknown) => {
              reportNonFatalError(
                "Failed to save PPTX reading-position setting",
                error,
              );
            });
          });
        },
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
        {
          labelToggle(toggle, this.messages.text("settings.diagnostics"));
          toggle.setValue(this.store.settings.diagnosticSummary).onChange((value) => {
            void this.store.setDiagnosticSummary(value).catch((error: unknown) => {
              reportNonFatalError(
                "Failed to save PPTX diagnostic-summary setting",
                error,
              );
            });
          });
        },
      );

    const donateCard = this.containerEl.createDiv({
      cls: "office-viewer-donate",
    });
    donateCard.createEl("p", {
      cls: "office-viewer-donate__description",
      text: this.messages.text("settings.supportDevelopment"),
    });
    const donateActions = donateCard.createDiv({
      cls: "office-viewer-donate__actions",
    });
    donateActions.append(
      createDonateImageLink(
        donateActions.ownerDocument,
        this.messages.text("settings.supportDevelopmentGitHub"),
        GITHUB_SPONSORS_URL,
        GITHUB_SPONSORS_BUTTON_SRC,
      ),
      createDonateImageLink(
        donateActions.ownerDocument,
        this.messages.text("settings.supportDevelopmentCoffee"),
        BUY_ME_A_COFFEE_URL,
        BUY_ME_A_COFFEE_BUTTON_SRC,
      ),
    );
  }
}
