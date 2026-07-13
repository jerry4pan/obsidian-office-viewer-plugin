import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OfficeViewerPlugin from "../src/main";

async function fixtureBuffer(): Promise<ArrayBuffer> {
  const bytes = await readFile(path.resolve("tests/fixtures/minimal.pptx"));
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
});
