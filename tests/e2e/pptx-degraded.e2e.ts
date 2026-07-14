import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  assertNoNetworkRequests,
  installNetworkGuard,
} from "../compatibility/browser-environment";

async function vaultSha256(path: string): Promise<string> {
  return browser.executeObsidian(
    async ({ app, obsidian, require }, vaultPath) => {
      const file = app.vault.getAbstractFileByPath(vaultPath);
      if (!(file instanceof obsidian.TFile)) throw new Error(`Missing ${vaultPath}`);
      const buffer = await app.vault.readBinary(file);
      const { createHash } = require("node:crypto") as typeof import("node:crypto");
      return createHash("sha256").update(new Uint8Array(buffer)).digest("hex");
    },
    path,
  );
}

describe("installed PPTX degraded navigation", () => {
  it("preserves the readable slide and recovers after a later render rejects", async () => {
    await installNetworkGuard();
    const path = "m1/degraded-navigation.pptx";
    const before = await vaultSha256(path);

    await obsidianPage.openFile(path);
    const root = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await expect(root).toHaveText(expect.stringContaining("Readable slide 1"));
    await expect(root).toHaveText(expect.stringContaining("1 / 3"));

    await root.$('[data-action="next-slide"]').click();
    await browser.waitUntil(
      async () => (await root.getAttribute("data-state")) === "degraded",
      { timeout: 10_000, timeoutMsg: "Slide 2 did not degrade safely" },
    );
    await expect(root).toHaveText(expect.stringContaining("Readable slide 1"));
    await expect(root).toHaveText(expect.stringContaining("1 / 3"));
    await expect(root).toHaveText(
      expect.stringContaining("The previous slide is still shown."),
    );
    await expect(root.$('[data-action="previous-slide"]')).toBeDisabled();
    await expect(root.$('[data-action="next-slide"]')).toBeEnabled();
    await expect(root.$('[data-action="page-number"]')).toBeEnabled();

    await root.$('[data-action="page-number"]').setValue("3");
    await root.$('[data-action="jump-to-slide"]').click();
    await browser.waitUntil(
      async () => (await root.getAttribute("data-state")) === "ready",
      { timeout: 10_000, timeoutMsg: "Slide 3 did not recover navigation" },
    );
    await expect(root).toHaveText(expect.stringContaining("Readable slide 3"));
    await expect(root).toHaveText(expect.stringContaining("3 / 3"));
    expect(await vaultSha256(path)).toBe(before);
    await assertNoNetworkRequests();
  });
});
