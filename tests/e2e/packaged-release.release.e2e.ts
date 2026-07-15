import path from "node:path";
import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  assertNoNetworkRequests,
  installNetworkGuard,
} from "../compatibility/browser-environment";

async function sourceHash(): Promise<string> {
  return browser.executeObsidian(async ({ app, obsidian, require }) => {
    const file = app.vault.getAbstractFileByPath("minimal.pptx");
    if (!(file instanceof obsidian.TFile)) throw new Error("Missing minimal.pptx");
    const bytes = await app.vault.readBinary(file);
    return require("node:crypto").createHash("sha256")
      .update(new Uint8Array(bytes)).digest("hex");
  });
}

describe("packaged release lifecycle", () => {
  it("installs in a clean Vault, rehearses an upgrade, and uninstalls cleanly", async () => {
    await installNetworkGuard();
    const before = await sourceHash();

    await obsidianPage.openFile("minimal.pptx");
    const installed = await browser.$('.pptx-viewer[data-state="ready"]');
    await expect(installed).toHaveText(expect.stringContaining("Obsidian PPTX smoke test"));
    await expect(installed.$('[data-action="copy-diagnostics"]')).toExist();
    expect(await sourceHash()).toBe(before);

    await browser.executeObsidian(
      async ({ app, require }, stagedPlugin) => {
        const fs = require("node:fs/promises") as typeof import("node:fs/promises");
        const nodePath = require("node:path") as typeof import("node:path");
        const plugins = (app as unknown as {
          plugins: {
            disablePlugin(id: string): Promise<void>;
            enablePlugin(id: string): Promise<void>;
          };
        }).plugins;
        app.workspace.detachLeavesOfType("pptx-viewer");
        await plugins.disablePlugin("office-viewer");
        const vaultRoot = (app.vault.adapter as unknown as {
          getBasePath(): string;
        }).getBasePath();
        const target = nodePath.join(vaultRoot, app.vault.configDir, "plugins", "office-viewer");
        for (const name of await fs.readdir(stagedPlugin)) {
          await fs.copyFile(nodePath.join(stagedPlugin, name), nodePath.join(target, name));
        }
        await plugins.enablePlugin("office-viewer");
      },
      path.resolve("artifacts/release/plugin"),
    );

    await obsidianPage.openFile("minimal.pptx");
    await expect(browser.$('.pptx-viewer[data-state="ready"]')).toHaveText(
      expect.stringContaining("Obsidian PPTX smoke test"),
    );
    expect(await sourceHash()).toBe(before);

    await obsidianPage.disablePlugin("office-viewer");
    const removed = await browser.executeObsidian(async ({ app, require }) => {
      const fs = require("node:fs/promises") as typeof import("node:fs/promises");
      const nodePath = require("node:path") as typeof import("node:path");
      const vaultRoot = (app.vault.adapter as unknown as {
        getBasePath(): string;
      }).getBasePath();
      const target = nodePath.join(vaultRoot, app.vault.configDir, "plugins", "office-viewer");
      await fs.rm(target, { recursive: true, force: true });
      return fs.access(target).then(() => false, () => true);
    });
    expect(removed).toBe(true);
    expect(await browser.$$(".pptx-viewer")).toHaveLength(0);
    expect(await sourceHash()).toBe(before);
    await assertNoNetworkRequests();
  });
});
