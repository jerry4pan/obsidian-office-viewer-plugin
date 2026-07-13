import { vi } from "vitest";

export class Plugin {
  app: unknown;
  registerView = vi.fn();
  registerExtensions = vi.fn();

  constructor(app: unknown) {
    this.app = app;
  }
}

export class FileView {
  app: unknown;
  contentEl = document.createElement("div");
  file: { basename?: string } | null = null;

  constructor(leaf: { app: unknown }) {
    this.app = leaf.app;
  }
}
