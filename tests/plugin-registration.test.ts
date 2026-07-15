import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLanguage, TFile, type ToggleComponent } from "obsidian";

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLanguage).mockReturnValue("en");
  });

  it("selects the message locale from Obsidian when the plugin loads", async () => {
    vi.mocked(getLanguage).mockReturnValue("zh-TW");
    const app = {
      vault: { readBinary: vi.fn(), on: vi.fn(() => ({ off: vi.fn() })) },
    };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);

    await plugin.onload();
    const factory = vi.mocked(plugin.registerView).mock.calls[0]?.[1];
    const view = factory?.({ app } as never) as unknown as {
      contentEl: HTMLElement;
    };

    expect(getLanguage).toHaveBeenCalledOnce();
    expect(view.contentEl.textContent).toContain(
      "從倉庫開啟 PPTX 檔案即可開始閱讀。",
    );
  });

  it("registers pptx files with the dedicated view", async () => {
    let releaseLoad!: () => void;
    const loadPending = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const vault = { readBinary: vi.fn(), on: vi.fn(() => ({ off: vi.fn() })) };
    const app = { vault };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);
    vi.mocked(plugin.loadData).mockImplementation(async () => loadPending);

    const loading = plugin.onload();

    expect(plugin.registerView).not.toHaveBeenCalled();
    releaseLoad();
    await loading;

    expect(plugin.registerView).toHaveBeenCalledOnce();
    expect(plugin.registerView).toHaveBeenCalledWith(
      "pptx-viewer",
      expect.any(Function),
    );
    expect(plugin.registerExtensions).toHaveBeenCalledWith(
      ["pptx"],
      "pptx-viewer",
    );
    expect(plugin.addSettingTab).toHaveBeenCalledOnce();
    expect(vault.on).toHaveBeenCalledWith("rename", expect.any(Function));
    expect(vault.on).toHaveBeenCalledWith("delete", expect.any(Function));
    expect(plugin.registerEvent).toHaveBeenCalledTimes(2);
  });

  it("passes a Vault-relative fingerprint to position restore and recording", async () => {
    const source = await representativeFixtureBuffer();
    const vault = {
      readBinary: vi.fn(async () => source),
      on: vi.fn(() => ({ off: vi.fn() })),
    };
    const app = { vault };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);
    vi.mocked(plugin.loadData).mockResolvedValue({
      schemaVersion: 1,
      settings: { rememberReadingPosition: true },
      positions: {
        "folder/deck.pptx": {
          path: "folder/deck.pptx",
          size: 42,
          mtime: 10,
          slideIndex: 5,
          updatedAt: 1,
        },
      },
    });
    await plugin.onload();
    const factory = vi.mocked(plugin.registerView).mock.calls[0]?.[1];
    const view = factory?.({ app } as never) as unknown as {
      contentEl: HTMLElement;
      onLoadFile(file: unknown): Promise<void>;
    };
    const file = Object.assign(new TFile(), {
      path: "folder/deck.pptx",
      stat: { size: 42, mtime: 10 },
      basename: "deck",
      extension: "pptx",
    });

    await view.onLoadFile(file);
    const root = view.contentEl.querySelector<HTMLElement>(".pptx-viewer")!;
    expect(root.textContent).toContain("6 / 12");
    expect(plugin.saveData).not.toHaveBeenCalled();
    root.querySelector<HTMLButtonElement>('[data-action="next-slide"]')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain("7 / 12"));

    await vi.waitFor(() => {
      expect(plugin.saveData).toHaveBeenCalledWith(
        expect.objectContaining({
          positions: {
            "folder/deck.pptx": expect.objectContaining({
              path: "folder/deck.pptx",
              size: 42,
              mtime: 10,
              slideIndex: 6,
            }),
          },
        }),
      );
    });
  });

  it("migrates and deletes positions from Vault file lifecycle events", async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const vault = {
      readBinary: vi.fn(),
      on: vi.fn((name: string, callback: (...args: unknown[]) => void) => {
        handlers.set(name, callback);
        return { off: vi.fn() };
      }),
    };
    const app = { vault };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);
    vi.mocked(plugin.loadData).mockResolvedValue({
      schemaVersion: 1,
      settings: { rememberReadingPosition: true },
      positions: {
        "old.pptx": {
          path: "old.pptx",
          size: 10,
          mtime: 20,
          slideIndex: 3,
          updatedAt: 1,
        },
      },
    });
    await plugin.onload();

    const renamed = Object.assign(new TFile(), {
      path: "new.pptx",
      stat: { size: 11, mtime: 21 },
      basename: "new",
      extension: "pptx",
    });
    handlers.get("rename")?.(renamed, "old.pptx");
    await vi.waitFor(() =>
      expect(plugin.saveData).toHaveBeenCalledWith(
        expect.objectContaining({
          positions: {
            "new.pptx": expect.objectContaining({
              path: "new.pptx",
              size: 10,
              mtime: 20,
            }),
          },
        }),
      ),
    );

    handlers.get("delete")?.(renamed);
    await vi.waitFor(() =>
      expect(plugin.saveData).toHaveBeenLastCalledWith(
        expect.objectContaining({ positions: {} }),
      ),
    );
  });

  it("disabling position memory clears persisted positions immediately", async () => {
    const app = {
      vault: { readBinary: vi.fn(), on: vi.fn(() => ({ off: vi.fn() })) },
    };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);
    vi.mocked(plugin.loadData).mockResolvedValue({
      schemaVersion: 1,
      settings: { rememberReadingPosition: true },
      positions: {
        "deck.pptx": {
          path: "deck.pptx",
          size: 1,
          mtime: 2,
          slideIndex: 3,
          updatedAt: 4,
        },
      },
    });
    await plugin.onload();
    const settingTab = vi.mocked(plugin.addSettingTab).mock.calls[0]?.[0] as {
      containerEl: HTMLElement;
      display(): void;
    };

    settingTab.display();
    expect(settingTab.containerEl.textContent).toContain(
      "Remember reading position",
    );
    expect(settingTab.containerEl.textContent).toContain(
      "Store only the last slide number and a local file-change fingerprint.",
    );
    const toggle = (settingTab.containerEl.firstElementChild as HTMLElement & {
      testToggle: ToggleComponent & { trigger(value: boolean): Promise<void> };
    }).testToggle;
    await toggle.trigger(false);

    expect(plugin.saveData).toHaveBeenLastCalledWith({
      schemaVersion: 1,
      settings: {
        rememberReadingPosition: false,
        thumbnailRailWidth: 168,
      },
      positions: {},
    });
  });

  it("contains a settings save rejection and keeps later toggles usable", async () => {
    const app = {
      vault: { readBinary: vi.fn(), on: vi.fn(() => ({ off: vi.fn() })) },
    };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);
    await plugin.onload();
    const settingTab = vi.mocked(plugin.addSettingTab).mock.calls[0]?.[0] as {
      containerEl: HTMLElement;
      display(): void;
    };
    const error = new Error("settings disk full");
    vi.mocked(plugin.saveData).mockRejectedValueOnce(error);
    const reportingError = new Error("patched console failed");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => { throw reportingError; });
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);

    try {
      settingTab.display();
      const failedToggle = (settingTab.containerEl.firstElementChild as HTMLElement & {
        testToggle: ToggleComponent & {
          getValue(): boolean;
          triggerWithoutAwait(value: boolean): void;
        };
      }).testToggle;
      failedToggle.triggerWithoutAwait(false);

      await vi.waitFor(() =>
        expect(consoleError).toHaveBeenCalledWith(
          "Failed to save PPTX reading-position setting",
          error,
        ),
      );
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
      settingTab.display();
      const retryToggle = (settingTab.containerEl.firstElementChild as HTMLElement & {
        testToggle: ToggleComponent & {
          getValue(): boolean;
          triggerWithoutAwait(value: boolean): void;
        };
      }).testToggle;
      expect(retryToggle.getValue()).toBe(false);

      retryToggle.triggerWithoutAwait(true);
      await vi.waitFor(() =>
        expect(plugin.saveData).toHaveBeenLastCalledWith({
          schemaVersion: 1,
          settings: {
            rememberReadingPosition: true,
            thumbnailRailWidth: 168,
          },
          positions: {},
        }),
      );
      settingTab.display();
      const restoredToggle = (settingTab.containerEl.firstElementChild as HTMLElement & {
        testToggle: ToggleComponent & { getValue(): boolean };
      }).testToggle;
      expect(restoredToggle.getValue()).toBe(true);
    } finally {
      process.off("unhandledRejection", onUnhandled);
      consoleError.mockRestore();
    }
  });

  it("does not register product hooks when position initialization fails", async () => {
    const app = {
      vault: { readBinary: vi.fn(), on: vi.fn(() => ({ off: vi.fn() })) },
    };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);
    vi.mocked(plugin.loadData).mockRejectedValue(new Error("load failed"));

    await expect(plugin.onload()).rejects.toThrow("load failed");

    expect(plugin.registerView).not.toHaveBeenCalled();
    expect(plugin.registerExtensions).not.toHaveBeenCalled();
    expect(plugin.registerEvent).not.toHaveBeenCalled();
    expect(plugin.addSettingTab).not.toHaveBeenCalled();
  });

  it("does not register product hooks if unload wins an initialization race", async () => {
    let releaseLoad!: () => void;
    const app = {
      vault: { readBinary: vi.fn(), on: vi.fn(() => ({ off: vi.fn() })) },
    };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);
    vi.mocked(plugin.loadData).mockImplementation(
      () => new Promise<void>((resolve) => { releaseLoad = resolve; }),
    );

    const loading = plugin.onload();
    plugin.onunload();
    releaseLoad();
    await loading;

    expect(plugin.registerView).not.toHaveBeenCalled();
    expect(plugin.registerExtensions).not.toHaveBeenCalled();
    expect(plugin.registerEvent).not.toHaveBeenCalled();
    expect(plugin.addSettingTab).not.toHaveBeenCalled();
  });

  it("disposes views before flushing and handles an unload save failure", async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const app = {
      vault: {
        readBinary: vi.fn(),
        on: vi.fn((name: string, callback: (...args: unknown[]) => void) => {
          handlers.set(name, callback);
          return { off: vi.fn() };
        }),
      },
    };
    const plugin = new OfficeViewerPlugin(app as never, {} as never);
    vi.mocked(plugin.loadData).mockResolvedValue({
      schemaVersion: 1,
      settings: { rememberReadingPosition: true },
      positions: {
        "old.pptx": {
          path: "old.pptx",
          size: 10,
          mtime: 20,
          slideIndex: 3,
          updatedAt: 1,
        },
      },
    });
    await plugin.onload();
    const factory = vi.mocked(plugin.registerView).mock.calls[0]?.[1];
    const view = factory?.({ app } as never) as unknown as {
      contentEl: HTMLElement;
    };
    const renamed = Object.assign(new TFile(), {
      path: "new.pptx",
      stat: { size: 11, mtime: 21 },
    });
    handlers.get("rename")?.(renamed, "old.pptx");
    const error = new Error("disk full");
    vi.mocked(plugin.saveData).mockImplementation(async () => {
      expect(view.contentEl.childElementCount).toBe(0);
      throw error;
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => { throw new Error("patched console failed"); });
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);

    try {
      plugin.onunload();

      await vi.waitFor(() =>
        expect(consoleError).toHaveBeenCalledWith(
          "Failed to save PPTX reading positions during unload",
          error,
        ),
      );
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(view.contentEl.childElementCount).toBe(0);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
      consoleError.mockRestore();
    }
  });

  it("reads through the Vault and reaches ready after opening a file", async () => {
    const source = await fixtureBuffer();
    const readBinary = vi.fn(async () => source);
    const app = {
      vault: { readBinary, on: vi.fn(() => ({ off: vi.fn() })) },
    };
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
        on: vi.fn(() => ({ off: vi.fn() })),
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
        on: vi.fn(() => ({ off: vi.fn() })),
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
    const app = {
      vault: {
        readBinary: vi.fn(async () => source),
        on: vi.fn(() => ({ off: vi.fn() })),
      },
    };
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
