import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  assertNoNetworkRequests,
  installNetworkGuard,
} from "../compatibility/browser-environment";

const DECK = "performance/representative-12-slides.pptx";

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

function toggleReadingView(): Promise<unknown> {
  return browser.executeObsidian(({ app }) => {
    (app as unknown as {
      commands: { executeCommandById(id: string): boolean };
    }).commands.executeCommandById("markdown:toggle-preview");
  });
}

const DUPLICATE_DECK = "duplicate-reference-probe/representative-12-slides.pptx";
const RENAME_FOLDER = "slide-reference-rename-probe";
const RENAMED_DECK = `${RENAME_FOLDER}/renamed.pptx`;
const RENAME_NOTE = `${RENAME_FOLDER}/note.md`;

async function createDuplicateBasenameProbe(): Promise<void> {
  await browser.executeObsidian(async ({ app, obsidian }, targetPath) => {
    if (app.vault.getAbstractFileByPath(targetPath) !== null) {
      throw new Error(`Unexpected existing ${targetPath}`);
    }
    const folderPath = targetPath.slice(0, targetPath.lastIndexOf("/"));
    if (app.vault.getAbstractFileByPath(folderPath) === null) {
      await app.vault.createFolder(folderPath);
    }
    const source = app.vault.getAbstractFileByPath("minimal.pptx");
    if (!(source instanceof obsidian.TFile)) throw new Error("Missing minimal.pptx");
    await app.vault.createBinary(targetPath, await app.vault.readBinary(source));
  }, DUPLICATE_DECK);
}

async function removeDuplicateBasenameProbe(): Promise<void> {
  await browser.executeObsidian(async ({ app }, targetPath) => {
    const file = app.vault.getAbstractFileByPath(targetPath);
    if (file !== null) await app.vault.delete(file, true);
    const folderPath = targetPath.slice(0, targetPath.lastIndexOf("/"));
    const folder = app.vault.getAbstractFileByPath(folderPath) as
      | { children?: unknown[] }
      | null;
    if (folder !== null && folder.children?.length === 0) {
      await app.vault.delete(folder as never, true);
    }
  }, DUPLICATE_DECK);
}

async function removeRenameProbe(): Promise<void> {
  await browser.executeObsidian(async ({ app }, folderPath) => {
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (folder !== null) await app.vault.delete(folder, true);
  }, RENAME_FOLDER);
}

describe("PPTX slide references", () => {
  it("passes a standard wikilink subpath to the PPTX file view", async () => {
    await obsidianPage.openFile("reference-note.md");
    await toggleReadingView();
    const link = await browser.$(
      '.workspace-leaf.mod-active .markdown-preview-view a.internal-link[data-href="performance/representative-12-slides.pptx#slide-id=261&slide=4"]',
    );
    await expect(link).toExist();
    await link.click();

    const root = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await expect(root).toExist();
    await expect(root).toHaveAttribute("data-reference-slide-id", "261");
    await expect(root).toHaveAttribute("data-reference-created-slide", "4");
    await expect(root).toHaveAttribute("data-reference-current-slide", "6");
    await expect(root).toHaveText(expect.stringContaining("6 / 12"));
    await expect(root).toHaveText(
      expect.stringContaining(
        "This reference was created for slide 4; the same slide is now slide 6.",
      ),
    );
    await browser.execute(() => {
      const probe = window as unknown as {
        __pptxCopiedMarkup?: string[];
      };
      probe.__pptxCopiedMarkup = [];
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable: true,
        value: async (value: string) => {
          probe.__pptxCopiedMarkup!.push(value);
        },
      });
    });
    const copyReference = root.$('[data-action="copy-slide-reference"]');
    const copyEmbed = root.$('[data-action="copy-slide-embed"]');
    await expect(copyReference).toBeEnabled();
    await expect(copyEmbed).toBeEnabled();
    await copyReference.click();
    await copyEmbed.click();
    await browser.waitUntil(async () => browser.execute(() =>
      ((window as unknown as { __pptxCopiedMarkup?: string[] })
        .__pptxCopiedMarkup?.length ?? 0) === 2), {
      timeout: 5_000,
      timeoutMsg: "Reference copy actions did not reach the installed clipboard seam",
    });
    expect(await browser.execute(() =>
      (window as unknown as { __pptxCopiedMarkup?: string[] })
        .__pptxCopiedMarkup ?? [])).toEqual([
      "[[performance/representative-12-slides.pptx#slide-id=261&slide=6|representative-12-slides — Slide 6]]",
      "![[performance/representative-12-slides.pptx#slide-id=261&slide=6|representative-12-slides — Slide 6]]",
    ]);
  });

  it("shows an honest stale state instead of falling back to the ordinal", async () => {
    await browser.executeObsidian(async ({ app }, deck) => {
      await app.workspace.openLinkText(
        `${deck}#slide-id=4294967295&slide=6`,
        "reference-note.md",
      );
    }, DECK);

    const root = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="stale-reference"]',
    );
    await expect(root).toExist();
    await expect(root).toHaveText(
      expect.stringContaining(
        "The referenced slide is no longer available in this presentation.",
      ),
    );
    await expect(root.$('[data-action="open-presentation"]')).toExist();
    await expect(root).not.toHaveText(expect.stringContaining("6 / 12"));
  });

  it("uses the full Vault path even when a duplicate basename exists", async () => {
    await createDuplicateBasenameProbe();
    try {
      await obsidianPage.openFile("reference-note.md");
      await toggleReadingView();
      const link = await browser.$(
        `.workspace-leaf.mod-active a.internal-link[data-href="${DECK}#slide-id=261&slide=4"]`,
      );
      await link.click();
      const viewer = await browser.$(
        '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
      );
      await expect(viewer).toHaveText(expect.stringContaining("6 / 12"));
      const activePath = await browser.executeObsidian(({ app }) =>
        app.workspace.activeLeaf?.getViewState().state?.file
      );
      expect(activePath).toBe(DECK);
    } finally {
      await removeDuplicateBasenameProbe();
    }
  });

  it("keeps exact reference navigation after restart and in a split leaf", async () => {
    await browser.reloadObsidian({ plugins: ["office-viewer"] });
    await obsidianPage.openFile("reference-note.md");
    await toggleReadingView();
    await browser.executeObsidian(async ({ app }, deck) => {
      await app.workspace.openLinkText(
        `${deck}#slide-id=261&slide=4`,
        "reference-note.md",
        "split",
      );
    }, DECK);
    const viewer = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await expect(viewer).toHaveAttribute("data-reference-slide-id", "261");
    await expect(viewer).toHaveText(expect.stringContaining("6 / 12"));
    const openFiles = await browser.executeObsidian(({ app }) => {
      const files: unknown[] = [];
      app.workspace.iterateAllLeaves((leaf) => {
        files.push(leaf.getViewState().state?.file);
      });
      return files;
    });
    expect(openFiles).toContain("reference-note.md");
    expect(openFiles).toContain(DECK);
  });

  it("keeps the canonical fragment when Obsidian updates a renamed source link", async () => {
    try {
      const updatedMarkdown = await browser.executeObsidian(async (
        { app, obsidian },
        folderPath,
      ) => {
        if (app.vault.getAbstractFileByPath(folderPath) !== null) {
          throw new Error(`Unexpected existing ${folderPath}`);
        }
        await app.vault.createFolder(folderPath);
        const source = app.vault.getAbstractFileByPath(
          "performance/representative-12-slides.pptx",
        );
        if (!(source instanceof obsidian.TFile)) throw new Error("Missing source deck");
        const originalPath = `${folderPath}/original.pptx`;
        const notePath = `${folderPath}/note.md`;
        const copied = await app.vault.createBinary(
          originalPath,
          await app.vault.readBinary(source),
        );
        const note = await app.vault.create(
          notePath,
          `[[${originalPath}#slide-id=261&slide=6|Rename probe]]`,
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        const vaultConfig = app.vault as unknown as {
          getConfig(key: string): unknown;
          setConfig(key: string, value: unknown): void;
        };
        const previous = vaultConfig.getConfig("alwaysUpdateLinks");
        vaultConfig.setConfig("alwaysUpdateLinks", true);
        try {
          await app.fileManager.renameFile(copied, `${folderPath}/renamed.pptx`);
        } finally {
          vaultConfig.setConfig("alwaysUpdateLinks", previous);
        }
        return app.vault.read(note);
      }, RENAME_FOLDER);
      expect(updatedMarkdown).toBe(
        "[[renamed.pptx#slide-id=261&slide=6|Rename probe]]",
      );
      await obsidianPage.openFile(RENAME_NOTE);
      await toggleReadingView();
      const link = await browser.$(
        '.workspace-leaf.mod-active a.internal-link[data-href="renamed.pptx#slide-id=261&slide=6"]',
      );
      await link.click();
      const viewer = await browser.$(
        '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
      );
      await expect(viewer).toHaveAttribute("data-reference-slide-id", "261");
      await expect(viewer).toHaveText(expect.stringContaining("6 / 12"));
      expect(await browser.executeObsidian(({ app }) =>
        app.workspace.activeLeaf?.getViewState().state?.file
      )).toBe(RENAMED_DECK);
    } finally {
      await removeRenameProbe();
    }
  });

  it("renders a source-backed single slide in Reading View", async () => {
    await obsidianPage.openFile("embed-note.md");
    await toggleReadingView();

    const embed = await browser.$(
      '.workspace-leaf.mod-active .pptx-slide-embed[data-state="ready"]',
    );
    await embed.waitForExist({ timeout: 10_000 });
    await expect(embed).toHaveAttribute("data-slide-id", "261");
    await expect(embed).toHaveAttribute("data-current-slide", "6");
    await expect(embed).toHaveText(expect.stringContaining("Representative benchmark slide 6"));
    await expect(embed).toHaveText(
      expect.stringContaining("representative-12-slides — Slide 6"),
    );
    await expect(embed).toHaveAttribute(
      "aria-label",
      "representative-12-slides — Slide 6",
    );
    const themeEvidence = await browser.execute(() => {
      const target = document.querySelector<HTMLElement>(
        ".workspace-leaf.mod-active .pptx-slide-embed",
      )!;
      const hadLight = document.body.classList.contains("theme-light");
      const hadDark = document.body.classList.contains("theme-dark");
      const evidence: Record<string, { background: string; color: string }> = {};
      for (const theme of ["theme-light", "theme-dark"] as const) {
        document.body.classList.remove("theme-light", "theme-dark");
        document.body.classList.add(theme);
        const styles = getComputedStyle(target);
        evidence[theme] = {
          background: styles.backgroundColor,
          color: styles.color,
        };
      }
      document.body.classList.remove("theme-light", "theme-dark");
      if (hadLight) document.body.classList.add("theme-light");
      if (hadDark) document.body.classList.add("theme-dark");
      return evidence;
    });
    expect(themeEvidence["theme-light"]?.background).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    expect(themeEvidence["theme-dark"]?.background).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    expect(themeEvidence["theme-light"]).not.toEqual(themeEvidence["theme-dark"]);
    expect(Number(await embed.getAttribute("data-first-readable-ms"))).toBeLessThanOrEqual(3_000);
    const source = embed.$(
      'a.internal-link[data-href="performance/representative-12-slides.pptx#slide-id=261&slide=4"]',
    );
    await expect(source).toExist();
    await source.click();
    const viewer = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await expect(viewer).toHaveAttribute("data-reference-slide-id", "261");
    await expect(viewer).toHaveText(expect.stringContaining("6 / 12"));
  });

  it("bounds ten viewport-aware embeds across three source presentations", async () => {
    await installNetworkGuard();
    const sources = [
      DECK,
      "minimal.pptx",
      "compatibility/text-theme-wide.pptx",
    ];
    const before = await Promise.all(sources.map(vaultSha256));
    await browser.execute(() => {
      const probe = window as unknown as {
        __pptxEmbedMaxLoading?: number;
        __pptxEmbedObserver?: MutationObserver;
        __pptxEmbedReady?: Record<string, number>;
        __pptxEmbedScrollStep?: number;
      };
      probe.__pptxEmbedMaxLoading = 0;
      probe.__pptxEmbedReady = {};
      probe.__pptxEmbedScrollStep = 0;
      probe.__pptxEmbedObserver?.disconnect();
      probe.__pptxEmbedObserver = new MutationObserver(() => {
        const activeLeaf = document.querySelector(".workspace-leaf.mod-active");
        probe.__pptxEmbedMaxLoading = Math.max(
          probe.__pptxEmbedMaxLoading ?? 0,
          activeLeaf?.querySelectorAll(
            '.pptx-slide-embed[data-state="loading"]',
          ).length ?? 0,
        );
        for (const element of activeLeaf?.querySelectorAll<HTMLElement>(
          '.pptx-slide-embed[data-state="ready"]',
        ) ?? []) {
          const key = [
            element.dataset.sourcePath,
            element.dataset.slideId,
            element.dataset.createdSlide,
          ].join("|");
          probe.__pptxEmbedReady![key] = Number(
            element.dataset.firstReadableMs,
          );
        }
      });
      probe.__pptxEmbedObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-state"],
        childList: true,
        subtree: true,
      });
    });

    await obsidianPage.openFile("ten-embed-note.md");
    await toggleReadingView();
    const canonicalEmbedCount = await browser.executeObsidian(async ({ app, obsidian }) => {
      const file = app.vault.getAbstractFileByPath("ten-embed-note.md");
      if (!(file instanceof obsidian.TFile)) throw new Error("Missing ten-embed-note.md");
      return (await app.vault.read(file)).split("![[").length - 1;
    });
    expect(canonicalEmbedCount).toBe(10);
    await browser.waitUntil(async () => browser.execute(() => {
      const probe = window as unknown as {
        __pptxEmbedReady?: Record<string, number>;
        __pptxEmbedScrollStep?: number;
      };
      const preview = document.querySelector<HTMLElement>(
        ".workspace-leaf.mod-active .markdown-preview-view",
      );
      if (preview !== null) {
        const step = probe.__pptxEmbedScrollStep ?? 0;
        const maximum = Math.max(0, preview.scrollHeight - preview.clientHeight);
        preview.scrollTop = maximum * ((step % 12) / 11);
        probe.__pptxEmbedScrollStep = step + 1;
      }
      return Object.keys(probe.__pptxEmbedReady ?? {}).length === 10;
    }), {
      timeout: 30_000,
      interval: 500,
      timeoutMsg: "All ten canonical slide embeds did not become readable",
    });

    const embedEvidence = await browser.execute(() => {
      const probe = window as unknown as {
        __pptxEmbedMaxLoading?: number;
        __pptxEmbedObserver?: MutationObserver;
        __pptxEmbedReady?: Record<string, number>;
      };
      probe.__pptxEmbedObserver?.disconnect();
      return {
        maxLoading: probe.__pptxEmbedMaxLoading ?? 0,
        timings: Object.values(probe.__pptxEmbedReady ?? {}),
      };
    });
    expect(embedEvidence.timings).toHaveLength(10);
    expect(embedEvidence.timings.every((timing) => timing <= 3_000)).toBe(true);
    expect(embedEvidence.maxLoading).toBeGreaterThan(0);
    expect(embedEvidence.maxLoading).toBeLessThanOrEqual(2);
    expect(await Promise.all(sources.map(vaultSha256))).toEqual(before);
    await assertNoNetworkRequests();
  });

  it("bounds missing, stale, protected, and resource-limited embeds", async () => {
    await installNetworkGuard();
    const protectedPath = "failure/protected-encrypted.pptx";
    const limitedPath = "failure/renderer-resource-limit.pptx";
    const before = await Promise.all([
      vaultSha256(protectedPath),
      vaultSha256(limitedPath),
    ]);
    await obsidianPage.openFile("embed-failures-note.md");
    await toggleReadingView();

    const missing = await browser.$(
      '.workspace-leaf.mod-active .pptx-slide-embed[data-source-path="missing/source.pptx"]',
    );
    await expect(missing).toHaveAttribute("data-state", "missing-source");
    await expect(missing).toHaveText(
      expect.stringContaining("The source presentation is no longer available."),
    );
    await expect(missing.$("a.internal-link")).toExist();

    const stale = await browser.$(
      `.workspace-leaf.mod-active .pptx-slide-embed[data-source-path="${DECK}"]`,
    );
    await browser.waitUntil(
      async () => (await stale.getAttribute("data-state")) === "stale-reference",
      { timeout: 10_000, timeoutMsg: "Stale embed did not settle" },
    );
    await expect(stale).toHaveText(
      expect.stringContaining("The referenced slide is no longer available"),
    );
    await expect(stale).not.toHaveAttribute("data-current-slide");

    for (const [source, message] of [
      [protectedPath, "This PPTX is encrypted or password-protected."],
      [limitedPath, "This PPTX is too large or complex"],
    ] as const) {
      const embed = await browser.$(
        `.workspace-leaf.mod-active .pptx-slide-embed[data-source-path="${source}"]`,
      );
      await browser.execute((sourcePath) => {
        document.querySelector<HTMLElement>(
          `.workspace-leaf.mod-active .pptx-slide-embed[data-source-path="${sourcePath}"]`,
        )?.scrollIntoView({ block: "center" });
      }, source);
      await browser.waitUntil(
        async () => (await embed.getAttribute("data-state")) === "error",
        { timeout: 10_000, timeoutMsg: `${source} embed did not fail safely` },
      );
      await expect(embed).toHaveText(expect.stringContaining(message));
      await expect(embed.$("a.internal-link")).toExist();
      await expect(embed.$('[data-action="open-externally"]')).toExist();
    }

    expect(await Promise.all([
      vaultSha256(protectedPath),
      vaultSha256(limitedPath),
    ])).toEqual(before);
    await assertNoNetworkRequests();
  });

  it("removes ready embed DOM and restores the native fallback on plugin unload", async () => {
    await obsidianPage.openFile("embed-note.md");
    await toggleReadingView();
    const embed = await browser.$(
      '.workspace-leaf.mod-active .pptx-slide-embed[data-state="ready"]',
    );
    await embed.waitForExist({ timeout: 10_000 });

    await obsidianPage.disablePlugin("office-viewer");
    try {
      await expect(browser.$(
        ".workspace-leaf.mod-active .pptx-slide-embed",
      )).not.toExist();
      const nativeFallback = await browser.$(
        '.workspace-leaf.mod-active .internal-embed[src="performance/representative-12-slides.pptx#slide-id=261&slide=4"]',
      );
      await expect(nativeFallback).toExist();
      await expect(nativeFallback).not.toHaveAttribute("hidden");
    } finally {
      await obsidianPage.enablePlugin("office-viewer");
    }
  });
});
