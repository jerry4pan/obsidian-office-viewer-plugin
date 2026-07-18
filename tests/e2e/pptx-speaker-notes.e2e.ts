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

async function installClipboardProbe(key: "__pptxCopiedMarkup" | "__pptxNotesCopies") {
  await browser.execute((probeKey) => {
    const probe = window as unknown as Record<string, string[] | undefined>;
    probe[probeKey] = [];
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async (value: string) => {
        probe[probeKey]!.push(value);
      },
    });
  }, key);
}

describe("PPTX speaker notes workflow", () => {
  it("views, searches, scopes, highlights, and copies author notes without mutation", async () => {
    await installNetworkGuard();
    const before = await vaultSha256(FIXTURE);

    await obsidianPage.openFile(FIXTURE);
    const root = await activeReadyRoot();

    await expect(root).toHaveAttribute("data-notes-collapsed", "true");
    const toggle = root.$('[data-action="toggle-notes"]');
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await browser.waitUntil(
      async () => (await root.getAttribute("data-notes-collapsed")) === "false",
      { timeout: 5_000, timeoutMsg: "Speaker notes panel did not expand" },
    );

    const notesText = await root.$(".pptx-viewer__notes-content").getText();
    expect(notesText).toContain("AUTHOR_NOTE_P1 First author paragraph");
    expect(notesText).toContain("AUTHOR_NOTE_P2 Second author paragraph");
    expect(notesText).toContain("讲者备注标记 NOTE_ZH_HANS");
    expect(notesText).toContain("講者備註標記 NOTE_ZH_HANT");
    expect(notesText).not.toContain("DECOY_NOTES_MASTER_HEADER");
    expect(notesText).not.toContain("DECOY_NOTES_MASTER_FOOTER");
    expect(notesText).not.toContain("DECOY_NOTES_MASTER_DATE");
    expect(notesText).not.toContain("DECOY_SLIDE_NUMBER");

    await installClipboardProbe("__pptxNotesCopies");
    await root.$('[data-action="copy-speaker-notes"]').click();
    await browser.waitUntil(async () => browser.execute(() =>
      ((window as unknown as { __pptxNotesCopies?: string[] })
        .__pptxNotesCopies?.length ?? 0) >= 1), {
      timeout: 5_000,
      timeoutMsg: "Speaker notes copy did not settle",
    });
    const copiedNotes = await browser.execute(() =>
      (window as unknown as { __pptxNotesCopies?: string[] })
        .__pptxNotesCopies ?? []);
    expect(copiedNotes[0]).toContain("AUTHOR_NOTE_P1 First author paragraph");
    expect(copiedNotes[0]).toContain("AUTHOR_NOTE_P2 Second author paragraph");
    expect(copiedNotes[0]).toContain(
      "speaker-notes.pptx#slide-id=256&slide=1",
    );
    expect(copiedNotes[0]).not.toContain("DECOY_SLIDE_NUMBER");

    await root.$('[data-action="open-slide-search"]').click();
    const input = root.$('[data-action="slide-search-input"]');
    await expect(input).toBeFocused();
    await expect(root.$('[data-search-scope="all"]')).toExist();
    await input.setValue("NOTE_ZH_HANS");

    const notesMatch = root.$('[data-action="slide-search-notes-match"]');
    await expect(notesMatch).toExist();
    await expect(notesMatch).toHaveText(expect.stringContaining("Speaker notes"));
    await expect(notesMatch).toHaveText(expect.stringContaining("NOTE_ZH_HANS"));
    await notesMatch.click();
    await browser.waitUntil(
      async () => (await root.getAttribute("data-notes-collapsed")) === "false",
      { timeout: 5_000, timeoutMsg: "Notes match did not expand the panel" },
    );
    await expect(root.$(".pptx-viewer__notes-highlight")).toHaveText(
      "NOTE_ZH_HANS",
    );

    await root.$('[data-search-scope="slides"]').click();
    await expect(root.$(".pptx-viewer__slide-search-summary")).toHaveText(
      expect.stringContaining("outside this scope"),
    );
    await root.$('[data-search-scope="notes"]').click();
    await expect(root.$('[data-action="slide-search-notes-match"]')).toExist();
    await root.$('[data-search-scope="all"]').click();
    await expect(root.$('[data-action="slide-search-notes-match"]')).toExist();

    await root.$('[data-action="next-slide"]').click();
    await browser.waitUntil(
      async () => (await root.getText()).includes("2 / 3"),
      { timeout: 10_000, timeoutMsg: "Did not reach slide 2" },
    );
    await expect(root).toHaveAttribute("data-notes-collapsed", "false");
    await expect(root.$('[data-notes-state="empty"]')).toHaveText(
      "This slide has no speaker notes.",
    );
    await expect(root.$('[data-action="copy-speaker-notes"]')).toBeDisabled();

    const persisted = await browser.executeObsidian(async ({ app }) => {
      const plugin = (app as unknown as {
        plugins: { plugins: Record<string, unknown> };
      }).plugins.plugins["office-viewer"] as { loadData(): Promise<unknown> };
      return JSON.stringify(await plugin.loadData());
    });
    expect(persisted).not.toContain("NOTE_ZH_HANS");
    expect(persisted).not.toContain("AUTHOR_NOTE_P1");

    expect(await vaultSha256(FIXTURE)).toBe(before);
    await browser.executeObsidian(({ app }) => app.workspace.activeLeaf?.detach());
    expect(await vaultSha256(FIXTURE)).toBe(before);
    await assertNoNetworkRequests();
  });

  it("keeps notes search state independent across two leaves", async () => {
    await installNetworkGuard();
    await obsidianPage.openFile(FIXTURE);
    const first = await activeReadyRoot();
    await browser.execute(() => {
      document.querySelector(".workspace-leaf.mod-active .pptx-viewer")
        ?.setAttribute("data-e2e-leaf", "first");
    });

    await browser.executeObsidian(async ({ app, obsidian }, path) => {
      const file = app.vault.getAbstractFileByPath(path);
      if (!(file instanceof obsidian.TFile)) throw new Error(`Missing ${path}`);
      const leaf = app.workspace.getLeaf("tab");
      await leaf.openFile(file);
    }, FIXTURE);
    const second = await activeReadyRoot();
    await browser.execute(() => {
      document.querySelector(".workspace-leaf.mod-active .pptx-viewer")
        ?.setAttribute("data-e2e-leaf", "second");
    });

    await second.$('[data-action="open-slide-search"]').click();
    await second.$('[data-action="slide-search-input"]').setValue("NOTE_ZH_HANT");
    await expect(second.$('[data-action="slide-search-notes-match"]')).toExist();
    await second.$('[data-search-scope="notes"]').click();

    const firstRoot = await browser.$('.pptx-viewer[data-e2e-leaf="first"]');
    await expect(firstRoot).toHaveAttribute("data-notes-collapsed", "true");
    expect(await firstRoot.$(".pptx-viewer__thumbnail-rail").getAttribute(
      "data-search-open",
    )).toBeNull();

    await assertNoNetworkRequests();
  });
});
