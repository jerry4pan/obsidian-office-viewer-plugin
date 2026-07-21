import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  assertNoNetworkRequests,
  installNetworkGuard,
} from "../compatibility/browser-environment";

const PROBE_FOLDER = "companion-note-probe";

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

async function closePptxLeaves(): Promise<void> {
  await browser.executeObsidian(({ app }) => {
    for (const leaf of app.workspace.getLeavesOfType("pptx-viewer")) leaf.detach();
  });
  await browser.waitUntil(
    async () =>
      browser.execute(() => document.querySelectorAll(".pptx-viewer").length === 0),
    { timeout: 10_000, timeoutMsg: "PPTX leaves did not close" },
  );
}

async function removeProbeFolder(): Promise<void> {
  await browser.executeObsidian(async ({ app }, folderPath) => {
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (folder !== null) await app.vault.delete(folder, true);
  }, PROBE_FOLDER);
}

async function ensureProbeDeck(name: string): Promise<string> {
  const path = `${PROBE_FOLDER}/${name}`;
  await browser.executeObsidian(
    async ({ app, obsidian }, targetPath, folderPath) => {
      if (app.vault.getAbstractFileByPath(folderPath) === null) {
        await app.vault.createFolder(folderPath);
      }
      const existing = app.vault.getAbstractFileByPath(targetPath);
      if (existing !== null) await app.vault.delete(existing, true);
      const source = app.vault.getAbstractFileByPath("minimal.pptx");
      if (!(source instanceof obsidian.TFile)) throw new Error("Missing minimal.pptx");
      await app.vault.createBinary(targetPath, await app.vault.readBinary(source));
    },
    path,
    PROBE_FOLDER,
  );
  return path;
}

async function openReadyDeck(path: string) {
  await obsidianPage.openFile(path);
  const root = await browser.$(
    '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
  );
  await root.waitForExist({ timeout: 30_000 });
  return root;
}

async function clickCompanionAction(selector = ".pptx-viewer"): Promise<void> {
  await browser.execute((rootSelector) => {
    const root = document.querySelector(rootSelector);
    const button = root?.querySelector<HTMLButtonElement>(
      '[data-action="open-companion-note"]',
    );
    if (button === null || button === undefined) {
      throw new Error("Companion action missing");
    }
    button.click();
  }, selector);
}

describe("Presentation companion notes", () => {
  beforeEach(async () => {
    await closePptxLeaves();
    await removeProbeFolder();
  });

  after(async () => {
    await closePptxLeaves();
    await removeProbeFolder();
  });

  it("creates, reuses, and adopts companion notes without mutating the PPTX", async () => {
    await installNetworkGuard();
    const deckPath = await ensureProbeDeck("create-deck.pptx");
    const before = await vaultSha256(deckPath);
    const root = await openReadyDeck(deckPath);

    const action = root.$('[data-action="open-companion-note"]');
    await expect(action).toExist();
    await expect(action).toHaveAttribute(
      "aria-label",
      "Open presentation companion note",
    );
    await clickCompanionAction(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );

    await browser.waitUntil(
      async () =>
        browser.executeObsidian(({ app }) =>
          app.vault.getAbstractFileByPath("companion-note-probe/create-deck.md") !==
            null),
      { timeout: 10_000, timeoutMsg: "Companion note was not created" },
    );

    const created = await browser.executeObsidian(async ({ app, obsidian }) => {
      const file = app.vault.getAbstractFileByPath(
        "companion-note-probe/create-deck.md",
      );
      if (!(file instanceof obsidian.TFile)) throw new Error("missing note");
      return app.vault.read(file);
    });
    expect(created).toBe(
      "# create-deck\n\n[[companion-note-probe/create-deck.pptx]]\n",
    );

    const openFiles = await browser.executeObsidian(({ app }) =>
      app.workspace.getLeavesOfType("markdown").map((leaf) => {
        const file = (leaf.view as { file?: { path?: string } }).file;
        return file?.path ?? null;
      }),
    );
    expect(openFiles).toContain("companion-note-probe/create-deck.md");

    await clickCompanionAction(
      '.workspace-leaf .pptx-viewer[data-state="ready"]',
    );
    const markdownLeafCount = await browser.executeObsidian(({ app }) =>
      app.workspace.getLeavesOfType("markdown").filter((leaf) => {
        const file = (leaf.view as { file?: { path?: string } }).file;
        return file?.path === "companion-note-probe/create-deck.md";
      }).length,
    );
    expect(markdownLeafCount).toBe(1);

    await closePptxLeaves();
    await browser.executeObsidian(async ({ app, obsidian }) => {
      const note = app.vault.getAbstractFileByPath(
        "companion-note-probe/create-deck.md",
      );
      if (note !== null) await app.vault.delete(note, true);
      await app.vault.create(
        "companion-note-probe/create-deck.md",
        "# keep existing bytes\n",
      );
    });

    await openReadyDeck(deckPath);
    await clickCompanionAction(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await browser.waitUntil(
      async () =>
        browser.executeObsidian(async ({ app, obsidian }) => {
          const file = app.vault.getAbstractFileByPath(
            "companion-note-probe/create-deck.md",
          );
          if (!(file instanceof obsidian.TFile)) return false;
          return (await app.vault.read(file)) === "# keep existing bytes\n";
        }),
      { timeout: 10_000, timeoutMsg: "Adopted note bytes changed" },
    );

    expect(await vaultSha256(deckPath)).toBe(before);
    await assertNoNetworkRequests();
  });

  it("migrates the companion note after a PPTX rename and repairs conflicts on open", async () => {
    await installNetworkGuard();
    const deckPath = await ensureProbeDeck("lifecycle.pptx");
    const before = await vaultSha256(deckPath);
    await openReadyDeck(deckPath);
    await clickCompanionAction(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await browser.waitUntil(
      async () =>
        browser.executeObsidian(({ app }) =>
          app.vault.getAbstractFileByPath("companion-note-probe/lifecycle.md") !==
            null),
      { timeout: 10_000, timeoutMsg: "Companion note missing before rename" },
    );

    await browser.executeObsidian(({ app }) => {
      for (const leaf of app.workspace.getLeavesOfType("markdown")) leaf.detach();
      for (const leaf of app.workspace.getLeavesOfType("pptx-viewer")) leaf.detach();
    });
    await browser.waitUntil(
      async () =>
        browser.execute(() => document.querySelectorAll(".pptx-viewer").length === 0),
      { timeout: 10_000, timeoutMsg: "PPTX leaves did not close before rename" },
    );

    await browser.executeObsidian(async ({ app, obsidian }) => {
      const file = app.vault.getAbstractFileByPath(
        "companion-note-probe/lifecycle.pptx",
      );
      if (!(file instanceof obsidian.TFile)) throw new Error("missing deck");
      await app.vault.rename(file, "companion-note-probe/lifecycle-renamed.pptx");
    });

    await browser.waitUntil(
      async () =>
        browser.executeObsidian(({ app }) =>
          app.vault.getAbstractFileByPath(
            "companion-note-probe/lifecycle-renamed.md",
          ) !== null),
      { timeout: 15_000, timeoutMsg: "Companion note did not migrate" },
    );

    await browser.executeObsidian(async ({ app, obsidian }) => {
      const blockedNote = app.vault.getAbstractFileByPath(
        "companion-note-probe/blocked.md",
      );
      if (blockedNote !== null) await app.vault.delete(blockedNote, true);
      await app.vault.create("companion-note-probe/blocked.md", "# occupant\n");
      const file = app.vault.getAbstractFileByPath(
        "companion-note-probe/lifecycle-renamed.pptx",
      );
      if (!(file instanceof obsidian.TFile)) throw new Error("missing renamed deck");
      await app.vault.rename(file, "companion-note-probe/blocked.pptx");
    });

    await openReadyDeck("companion-note-probe/blocked.pptx");
    await clickCompanionAction(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await browser.waitUntil(
      async () =>
        browser.execute(() =>
          (document.querySelector(
            ".pptx-viewer .pptx-viewer__action-status",
          )?.textContent ?? "").includes("occupied")),
      { timeout: 10_000, timeoutMsg: "Conflict status was not announced" },
    );

    const occupant = await browser.executeObsidian(async ({ app, obsidian }) => {
      const file = app.vault.getAbstractFileByPath(
        "companion-note-probe/blocked.md",
      );
      if (!(file instanceof obsidian.TFile)) throw new Error("missing occupant");
      return app.vault.read(file);
    });
    expect(occupant).toBe("# occupant\n");
    const authoritative = await browser.executeObsidian(
      async ({ app, obsidian }) => {
        const file = app.vault.getAbstractFileByPath(
          "companion-note-probe/lifecycle-renamed.md",
        );
        if (!(file instanceof obsidian.TFile)) return null;
        return app.vault.read(file);
      },
    );
    expect(authoritative).toContain("# lifecycle");

    await browser.executeObsidian(async ({ app }) => {
      const note = app.vault.getAbstractFileByPath(
        "companion-note-probe/blocked.md",
      );
      if (note !== null) await app.vault.delete(note, true);
      for (const leaf of app.workspace.getLeavesOfType("markdown")) leaf.detach();
      const pptxLeaf = app.workspace.getLeavesOfType("pptx-viewer")[0];
      if (pptxLeaf !== undefined) {
        app.workspace.setActiveLeaf(pptxLeaf, { focus: true });
      }
    });
    await browser.waitUntil(
      async () =>
        browser.execute(() =>
          document.querySelector(
            '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"] [data-action="open-companion-note"]',
          ) !== null),
      { timeout: 10_000, timeoutMsg: "PPTX companion action not active for repair" },
    );
    await clickCompanionAction(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await browser.waitUntil(
      async () =>
        browser.executeObsidian(({ app }) =>
          app.vault.getAbstractFileByPath("companion-note-probe/blocked.md") !==
            null),
      { timeout: 10_000, timeoutMsg: "Conflict was not repaired on open" },
    );

    expect(await vaultSha256("companion-note-probe/blocked.pptx")).toBe(before);
    await assertNoNetworkRequests();
  });

  it("keeps the companion action on blocking errors and leaves the note open after source close", async () => {
    await installNetworkGuard();
    const protectedPath = "failure/protected-encrypted.pptx";
    const before = await vaultSha256(protectedPath);
    await obsidianPage.openFile(protectedPath);
    const root = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="error"]',
    );
    await root.waitForExist({ timeout: 30_000 });
    await expect(root.$('[data-action="open-companion-note"]')).toExist();
    await clickCompanionAction(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="error"]',
    );

    await browser.waitUntil(
      async () =>
        browser.executeObsidian(({ app }) =>
          app.vault.getAbstractFileByPath("failure/protected-encrypted.md") !==
            null),
      { timeout: 10_000, timeoutMsg: "Error-state companion note missing" },
    );

    await closePptxLeaves();
    const stillOpen = await browser.executeObsidian(({ app }) =>
      app.workspace.getLeavesOfType("markdown").some((leaf) => {
        const file = (leaf.view as { file?: { path?: string } }).file;
        return file?.path === "failure/protected-encrypted.md";
      }),
    );
    expect(stillOpen).toBe(true);

    expect(await vaultSha256(protectedPath)).toBe(before);
    await assertNoNetworkRequests();

    await browser.executeObsidian(async ({ app }) => {
      const note = app.vault.getAbstractFileByPath(
        "failure/protected-encrypted.md",
      );
      if (note !== null) await app.vault.delete(note, true);
      for (const leaf of app.workspace.getLeavesOfType("markdown")) {
        const file = (leaf.view as { file?: { path?: string } }).file;
        if (file?.path === "failure/protected-encrypted.md") leaf.detach();
      }
    });
  });
});
