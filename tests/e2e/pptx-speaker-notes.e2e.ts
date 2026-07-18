import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  assertNoNetworkRequests,
  installNetworkGuard,
} from "../compatibility/browser-environment";

const FIXTURE = "speaker-notes.pptx";

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

async function activeReadyRoot() {
  const root = await browser.$(
    '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
  );
  await root.waitForExist({ timeout: 30_000 });
  return root;
}

describe("PPTX speaker notes panel", () => {
  it("shows only author notes from the real fixture without mutating the source", async () => {
    await installNetworkGuard();
    const before = await vaultSha256(FIXTURE);

    await obsidianPage.openFile(FIXTURE);
    const root = await activeReadyRoot();

    await expect(root).toHaveAttribute("data-notes-collapsed", "true");
    const toggle = root.$('[data-action="toggle-notes"]');
    await expect(toggle).toExist();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await browser.waitUntil(
      async () => (await root.getAttribute("data-notes-collapsed")) === "false",
      { timeout: 5_000, timeoutMsg: "Speaker notes panel did not expand" },
    );
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    const notesText = await root.$(".pptx-viewer__notes-content").getText();
    expect(notesText).toContain("AUTHOR_NOTE_P1 First author paragraph");
    expect(notesText).toContain("AUTHOR_NOTE_P2 Second author paragraph");
    expect(notesText).toContain("讲者备注标记 NOTE_ZH_HANS");
    expect(notesText).toContain("講者備註標記 NOTE_ZH_HANT");
    expect(notesText).not.toContain("DECOY_NOTES_MASTER_HEADER");
    expect(notesText).not.toContain("DECOY_NOTES_MASTER_FOOTER");
    expect(notesText).not.toContain("DECOY_NOTES_MASTER_DATE");
    expect(notesText).not.toContain("DECOY_SLIDE_NUMBER");

    await root.$('[data-action="next-slide"]').click();
    await browser.waitUntil(
      async () => (await root.getText()).includes("2 / 3"),
      { timeout: 10_000, timeoutMsg: "Did not reach slide 2" },
    );
    await expect(root).toHaveAttribute("data-notes-collapsed", "false");
    await expect(root.$('[data-notes-state="empty"]')).toHaveText(
      "This slide has no speaker notes.",
    );

    await root.$('[data-action="next-slide"]').click();
    await browser.waitUntil(
      async () => (await root.getText()).includes("3 / 3"),
      { timeout: 10_000, timeoutMsg: "Did not reach slide 3" },
    );
    await expect(root.$('[data-notes-state="empty"]')).toHaveText(
      "This slide has no speaker notes.",
    );

    expect(await vaultSha256(FIXTURE)).toBe(before);
    await browser.executeObsidian(({ app }) => app.workspace.activeLeaf?.detach());
    expect(await vaultSha256(FIXTURE)).toBe(before);
    await assertNoNetworkRequests();
  });
});
