import { vi } from "vitest";

export const getLanguage = vi.fn(() => "en");
export const apiVersion = "1.13.1";

export class Plugin {
  app: unknown;
  registerView = vi.fn();
  registerExtensions = vi.fn();
  registerEvent = vi.fn();
  addSettingTab = vi.fn();
  loadData = vi.fn(async (): Promise<unknown> => undefined);
  saveData = vi.fn(async (_data: unknown): Promise<void> => undefined);

  constructor(app: unknown) {
    this.app = app;
  }
}

export class PluginSettingTab {
  containerEl = document.createElement("div") as HTMLElement & {
    empty(): void;
  };

  constructor(
    public app: unknown,
    public plugin: Plugin,
  ) {
    this.containerEl.empty = () => this.containerEl.replaceChildren();
  }
}

export class ToggleComponent {
  private value = false;
  private change: ((value: boolean) => unknown) | undefined;

  setValue(value: boolean): this {
    this.value = value;
    return this;
  }

  onChange(change: (value: boolean) => unknown): this {
    this.change = change;
    return this;
  }

  async trigger(value: boolean): Promise<void> {
    this.value = value;
    await this.change?.(value);
  }

  triggerWithoutAwait(value: boolean): void {
    this.value = value;
    this.change?.(value);
  }

  getValue(): boolean {
    return this.value;
  }
}

export class Setting {
  readonly toggle = new ToggleComponent();
  readonly settingEl = document.createElement("div");
  readonly nameEl = document.createElement("div");
  readonly descEl = document.createElement("div");

  constructor(readonly containerEl: HTMLElement) {
    this.settingEl.className = "setting-item";
    this.settingEl.append(this.nameEl, this.descEl);
    containerEl.append(this.settingEl);
  }

  setName(name: string): this {
    this.nameEl.textContent = name;
    return this;
  }

  setDesc(description: string): this {
    this.descEl.textContent = description;
    return this;
  }

  addToggle(configure: (toggle: ToggleComponent) => unknown): this {
    configure(this.toggle);
    Object.defineProperty(this.settingEl, "testToggle", {
      value: this.toggle,
    });
    return this;
  }
}

export class TFile {
  constructor(
    public path = "",
    public stat: { size: number; mtime: number } = { size: 0, mtime: 0 },
    public basename = path.replace(/^.*\//, "").replace(/\.pptx$/i, ""),
    public extension = "pptx",
  ) {}
}

export class FileView {
  app: unknown;
  contentEl = document.createElement("div");
  file: { basename?: string } | null = null;

  constructor(leaf: { app: unknown }) {
    this.app = leaf.app;
  }
}
