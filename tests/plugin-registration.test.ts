import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OfficeViewerPlugin from "../src/main";

async function fixtureBuffer(): Promise<ArrayBuffer> {
  const bytes = await readFile(path.resolve("tests/fixtures/minimal.pptx"));
  return Uint8Array.from(bytes).buffer;
}

async function protectedFixtureBuffer(): Promise<ArrayBuffer> {
  const bytes = await readFile(
    path.resolve("tests/fixtures/failure/protected-encrypted.pptx"),
  );
  return Uint8Array.from(bytes).buffer;
}

async function representativeFixtureBuffer(): Promise<ArrayBuffer> {
  const bytes = await readFile(
    path.resolve("tests/fixtures/performance/representative-12-slides.pptx"),
  );
  return Uint8Array.from(bytes).buffer;
}

describe("OfficeViewerPlugin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers pptx files with the dedicated view", async () => {
    const app = { vault: { readBinary: vi.fn() } };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);

    await plugin.onload();

    expect(plugin.registerView).toHaveBeenCalledOnce();
    expect(plugin.registerView).toHaveBeenCalledWith(
      "pptx-viewer",
      expect.any(Function),
    );
    expect(plugin.registerExtensions).toHaveBeenCalledWith(
      ["pptx"],
      "pptx-viewer",
    );
  });

  it("reads through the Vault and reaches ready after opening a file", async () => {
    const source = await fixtureBuffer();
    const readBinary = vi.fn(async () => source);
    const app = { vault: { readBinary } };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);
    await plugin.onload();
    const factory = vi.mocked(plugin.registerView).mock.calls[0]?.[1];
    expect(factory).toBeTypeOf("function");
    const view = factory?.({ app } as never) as unknown as {
      contentEl: HTMLElement;
      onLoadFile(file: unknown): Promise<void>;
      onClose(): Promise<void>;
    };
    const file = {
      basename: "minimal",
      extension: "pptx",
      name: "minimal.pptx",
      path: "minimal.pptx",
    };

    await view.onLoadFile(file);

    expect(readBinary).toHaveBeenCalledWith(file);
    const root = view.contentEl.querySelector<HTMLElement>(".pptx-viewer");
    expect(root?.dataset.state).toBe("ready");
    expect(root?.textContent).toContain("Obsidian PPTX smoke test");
    expect(root?.textContent).toContain("1 / 1");

    await view.onClose();
    expect(view.contentEl.childElementCount).toBe(0);
  });

  it("keeps a protected source untouched and exposes the desktop fallback", async () => {
    const source = await protectedFixtureBuffer();
    const readBinary = vi.fn(async () => source);
    const writeBinary = vi.fn();
    const app = {
      vault: {
        adapter: { getFullPath: vi.fn(() => "/vault/protected-encrypted.pptx") },
        readBinary,
        writeBinary,
      },
    };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);
    await plugin.onload();
    const factory = vi.mocked(plugin.registerView).mock.calls[0]?.[1];
    const view = factory?.({ app } as never) as unknown as {
      contentEl: HTMLElement;
      onLoadFile(file: unknown): Promise<void>;
    };
    const file = {
      basename: "protected-encrypted",
      extension: "pptx",
      name: "protected-encrypted.pptx",
      path: "failure/protected-encrypted.pptx",
    };

    await view.onLoadFile(file);

    const root = view.contentEl.querySelector<HTMLElement>(".pptx-viewer");
    expect(root?.dataset.errorCategory).toBe("protected");
    expect(
      root?.querySelector('[data-action="open-externally"]'),
    ).not.toBeNull();
    expect(readBinary).toHaveBeenCalledWith(file);
    expect(writeBinary).not.toHaveBeenCalled();
  });

  it("jumps through a multi-slide deck without adding a Vault write path", async () => {
    const source = await representativeFixtureBuffer();
    const readBinary = vi.fn(async () => source);
    const writeBinary = vi.fn();
    const app = {
      vault: {
        adapter: { getFullPath: vi.fn(() => "/vault/representative.pptx") },
        readBinary,
        writeBinary,
      },
    };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);
    await plugin.onload();
    const factory = vi.mocked(plugin.registerView).mock.calls[0]?.[1];
    const view = factory?.({ app } as never) as unknown as {
      contentEl: HTMLElement;
      onLoadFile(file: unknown): Promise<void>;
      onClose(): Promise<void>;
    };
    const file = {
      basename: "representative-12-slides",
      extension: "pptx",
      name: "representative-12-slides.pptx",
      path: "performance/representative-12-slides.pptx",
    };

    await view.onLoadFile(file);
    const root = view.contentEl.querySelector<HTMLElement>(".pptx-viewer")!;
    const input = root.querySelector<HTMLInputElement>(
      '[data-action="page-number"]',
    )!;
    input.value = "12";
    root
      .querySelector<HTMLButtonElement>('[data-action="jump-to-slide"]')!
      .click();

    await vi.waitFor(() => expect(root.textContent).toContain("12 / 12"), {
      timeout: 5_000,
    });
    expect(readBinary).toHaveBeenCalledOnce();
    expect(readBinary).toHaveBeenCalledWith(file);
    expect(writeBinary).not.toHaveBeenCalled();
    expect(root.querySelector('[data-action="open-externally"]')).not.toBeNull();

    await view.onClose();
    expect(view.contentEl.childElementCount).toBe(0);
  });

  it("disposes every tracked view when the plugin unloads", async () => {
    const source = await fixtureBuffer();
    const app = { vault: { readBinary: vi.fn(async () => source) } };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);
    await plugin.onload();
    const factory = vi.mocked(plugin.registerView).mock.calls[0]?.[1];
    const view = factory?.({ app } as never) as unknown as {
      contentEl: HTMLElement;
      onLoadFile(file: unknown): Promise<void>;
    };
    await view.onLoadFile({
      basename: "minimal",
      extension: "pptx",
      name: "minimal.pptx",
      path: "minimal.pptx",
    });
    expect(view.contentEl.querySelector('[data-state="ready"]')).not.toBeNull();

    plugin.onunload();

    expect(view.contentEl.childElementCount).toBe(0);
  });
});
