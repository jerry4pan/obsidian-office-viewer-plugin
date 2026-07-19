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

async function ensureLivePreview(): Promise<void> {
  await browser.executeObsidian(async ({ app, obsidian }) => {
    const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (view === null) throw new Error("Expected an active Markdown view");
    // editing + Live Preview (source:false), not Reading View and not Source mode
    await view.setState({ mode: "source", source: false }, { history: false });
    // Keep the cursor on the title so it does not suppress the embed widget.
    view.editor.setCursor({ line: 0, ch: 0 });
  });
}

describe("Live Preview slide embeds", () => {
  it("renders a standalone canonical embed and reveals syntax on selection", async () => {
    await obsidianPage.openFile("embed-note.md");
    await ensureLivePreview();

    const embed = await browser.$(
      '.workspace-leaf.mod-active .cm-editor .pptx-slide-embed',
    );
    await browser.waitUntil(
      async () => (await embed.getAttribute("data-state")) === "ready",
      {
        timeout: 10_000,
        timeoutMsg: "Live Preview embed did not become ready",
      },
    );
    await expect(embed).toHaveAttribute("data-slide-id", "261");
    await expect(embed).toHaveAttribute("data-current-slide", "6");
    await expect(embed).toHaveText(
      expect.stringContaining("representative-12-slides — Slide 6"),
    );
    await expect(embed).toHaveText(
      expect.stringContaining(
        "This reference was created for slide 4; the same slide is now slide 6.",
      ),
    );

    await browser.executeObsidian(({ app, obsidian }) => {
      const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
      const editor = view?.editor;
      if (editor === undefined) throw new Error("Missing Markdown editor");
      // Place the cursor inside the canonical embed syntax.
      editor.setCursor({ line: 2, ch: 4 });
    });

    await browser.waitUntil(
      async () =>
        (await browser.$(
          '.workspace-leaf.mod-active .cm-editor .pptx-slide-embed',
        ).isExisting()) === false,
      {
        timeout: 5_000,
        timeoutMsg: "Live Preview widget did not reveal canonical syntax",
      },
    );

    const sourceText = await browser.executeObsidian(({ app, obsidian }) => {
      const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
      return view?.editor.getValue() ?? "";
    });
    expect(sourceText).toContain(
      "![[performance/representative-12-slides.pptx#slide-id=261&slide=4|Representative — Slide 4]]",
    );
  });

  it("applies the syntax matrix and preserves Markdown through edit and mode round-trips", async () => {
    await obsidianPage.openFile("live-preview-syntax-matrix.md");
    await ensureLivePreview();

    await browser.waitUntil(async () => {
      const count = await browser.execute(() =>
        document.querySelectorAll(
          ".workspace-leaf.mod-active .cm-editor .pptx-slide-embed",
        ).length);
      return count === 2;
    }, {
      timeout: 10_000,
      timeoutMsg: "Expected exactly two standalone Live Preview widgets",
    });

    const before = await browser.executeObsidian(({ app, obsidian }) => {
      const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
      return view?.editor.getValue() ?? "";
    });

    await browser.executeObsidian(({ app, obsidian }) => {
      const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
      if (view === null) throw new Error("Missing Markdown view");
      // Edit surrounding prose only.
      view.editor.replaceRange("Intro", { line: 2, ch: 0 }, { line: 2, ch: 5 });
      view.editor.setCursor({ line: 0, ch: 0 });
    });

    await browser.waitUntil(async () => {
      const count = await browser.execute(() =>
        document.querySelectorAll(
          ".workspace-leaf.mod-active .cm-editor .pptx-slide-embed",
        ).length);
      return count === 2;
    }, { timeout: 5_000, timeoutMsg: "Widgets lost after prose edit" });

    await browser.executeObsidian(({ app, obsidian }, original) => {
      const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
      if (view === null) throw new Error("Missing Markdown view");
      view.editor.focus();
      const undone = (app as unknown as {
        commands: { executeCommandById(id: string): boolean };
      }).commands.executeCommandById("editor:undo");
      if (!undone || view.editor.getValue() !== original) {
        view.editor.setValue(original);
      }
      view.editor.setCursor({ line: 0, ch: 0 });
    }, before);

    const afterUndo = await browser.executeObsidian(({ app, obsidian }) => {
      const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
      return view?.editor.getValue() ?? "";
    });
    expect(afterUndo).toBe(before);

    // Source mode should show syntax only.
    await browser.executeObsidian(async ({ app, obsidian }) => {
      const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
      await view?.setState({ mode: "source", source: true }, { history: false });
    });
    await browser.waitUntil(async () =>
      (await browser.$(
        ".workspace-leaf.mod-active .cm-editor .pptx-slide-embed",
      ).isExisting()) === false, {
      timeout: 5_000,
      timeoutMsg: "Widget leaked into Source mode",
    });

    // Reading View should keep the shared postprocessor embeds.
    await browser.executeObsidian(({ app }) => {
      (app as unknown as {
        commands: { executeCommandById(id: string): boolean };
      }).commands.executeCommandById("markdown:toggle-preview");
    });
    const reading = await browser.$(
      '.workspace-leaf.mod-active .markdown-reading-view .pptx-slide-embed, .workspace-leaf.mod-active .markdown-preview-view .pptx-slide-embed',
    );
    await browser.waitUntil(
      async () => (await reading.getAttribute("data-state")) === "ready",
      { timeout: 10_000, timeoutMsg: "Reading View embed missing after mode trip" },
    );

    const finalMarkdown = await browser.executeObsidian(async ({ app, obsidian }) => {
      const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
      await view?.setState({ mode: "source", source: false }, { history: false });
      return view?.editor.getValue() ?? "";
    });
    expect(finalMarkdown).toBe(before);
  });

  it("bounds ten Live Preview embeds with a shared concurrency ceiling", async () => {
    await installNetworkGuard();
    const sources = [
      "performance/representative-12-slides.pptx",
      "minimal.pptx",
      "compatibility/text-theme-wide.pptx",
    ];
    const before = await Promise.all(sources.map(vaultSha256));
    await browser.execute(() => {
      const probe = window as unknown as {
        __pptxLpEmbedMaxLoading?: number;
        __pptxLpEmbedObserver?: MutationObserver;
        __pptxLpEmbedReady?: Record<string, number>;
        __pptxLpEmbedScrollStep?: number;
      };
      probe.__pptxLpEmbedMaxLoading = 0;
      probe.__pptxLpEmbedReady = {};
      probe.__pptxLpEmbedScrollStep = 0;
      probe.__pptxLpEmbedObserver?.disconnect();
      probe.__pptxLpEmbedObserver = new MutationObserver(() => {
        const activeLeaf = document.querySelector(".workspace-leaf.mod-active");
        probe.__pptxLpEmbedMaxLoading = Math.max(
          probe.__pptxLpEmbedMaxLoading ?? 0,
          activeLeaf?.querySelectorAll(
            '.cm-editor .pptx-slide-embed[data-state="loading"]',
          ).length ?? 0,
        );
        for (const element of activeLeaf?.querySelectorAll<HTMLElement>(
          '.cm-editor .pptx-slide-embed[data-state="ready"]',
        ) ?? []) {
          const key = [
            element.dataset.sourcePath,
            element.dataset.slideId,
            element.dataset.createdSlide,
          ].join("|");
          probe.__pptxLpEmbedReady![key] = Number(
            element.dataset.firstReadableMs,
          );
        }
      });
      probe.__pptxLpEmbedObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-state"],
        childList: true,
        subtree: true,
      });
    });

    await obsidianPage.openFile("ten-embed-note.md");
    await ensureLivePreview();

    await browser.waitUntil(async () => browser.execute(() => {
      const probe = window as unknown as {
        __pptxLpEmbedReady?: Record<string, number>;
        __pptxLpEmbedScrollStep?: number;
      };
      const scroller = document.querySelector<HTMLElement>(
        ".workspace-leaf.mod-active .cm-scroller",
      );
      if (scroller !== null) {
        const step = probe.__pptxLpEmbedScrollStep ?? 0;
        const maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        scroller.scrollTop = maximum * ((step % 12) / 11);
        probe.__pptxLpEmbedScrollStep = step + 1;
      }
      return Object.keys(probe.__pptxLpEmbedReady ?? {}).length === 10;
    }), {
      timeout: 30_000,
      interval: 500,
      timeoutMsg: "All ten Live Preview slide embeds did not become readable",
    });

    // Mode switch must release Live Preview widgets while Reading View remains bounded.
    await browser.executeObsidian(({ app }) => {
      (app as unknown as {
        commands: { executeCommandById(id: string): boolean };
      }).commands.executeCommandById("markdown:toggle-preview");
    });
    await browser.waitUntil(async () =>
      (await browser.execute(() =>
        document.querySelectorAll(
          ".workspace-leaf.mod-active .cm-editor .pptx-slide-embed",
        ).length)) === 0, {
      timeout: 5_000,
      timeoutMsg: "Live Preview widgets remained after switching to Reading View",
    });

    const embedEvidence = await browser.execute(() => {
      const probe = window as unknown as {
        __pptxLpEmbedMaxLoading?: number;
        __pptxLpEmbedObserver?: MutationObserver;
        __pptxLpEmbedReady?: Record<string, number>;
      };
      probe.__pptxLpEmbedObserver?.disconnect();
      return {
        maxLoading: probe.__pptxLpEmbedMaxLoading ?? 0,
        timings: Object.values(probe.__pptxLpEmbedReady ?? {}),
      };
    });
    expect(embedEvidence.timings).toHaveLength(10);
    expect(embedEvidence.timings.every((timing) => timing <= 3_000)).toBe(true);
    expect(embedEvidence.maxLoading).toBeGreaterThan(0);
    expect(embedEvidence.maxLoading).toBeLessThanOrEqual(2);
    expect(await Promise.all(sources.map(vaultSha256))).toEqual(before);
    await assertNoNetworkRequests();
  });

  it("surfaces trusted Live Preview failure and recovery states", async () => {
    await obsidianPage.openFile("embed-failures-note.md");
    await ensureLivePreview();

    const missing = await browser.$(
      '.workspace-leaf.mod-active .cm-editor .pptx-slide-embed[data-source-path="missing/source.pptx"]',
    );
    await expect(missing).toHaveAttribute("data-state", "missing-source");
    await expect(missing).toHaveAttribute("role", "group");
    await expect(missing.$("a.internal-link")).toExist();

    const stale = await browser.$(
      '.workspace-leaf.mod-active .cm-editor .pptx-slide-embed[data-source-path="performance/representative-12-slides.pptx"]',
    );
    await browser.waitUntil(
      async () => (await stale.getAttribute("data-state")) === "stale-reference",
      { timeout: 10_000, timeoutMsg: "stale Live Preview embed did not settle" },
    );
    await expect(stale).toHaveText(
      expect.stringContaining("The referenced slide is no longer available"),
    );
    await expect(stale).not.toHaveAttribute("data-current-slide");

    for (const [source, message] of [
      ["failure/protected-encrypted.pptx", "This PPTX is encrypted or password-protected."],
      ["failure/renderer-resource-limit.pptx", "This PPTX is too large or complex"],
    ] as const) {
      const embed = await browser.$(
        `.workspace-leaf.mod-active .cm-editor .pptx-slide-embed[data-source-path="${source}"]`,
      );
      await browser.execute((sourcePath) => {
        document.querySelector<HTMLElement>(
          `.workspace-leaf.mod-active .cm-editor .pptx-slide-embed[data-source-path="${sourcePath}"]`,
        )?.scrollIntoView({ block: "center" });
      }, source);
      await browser.waitUntil(
        async () => (await embed.getAttribute("data-state")) === "error",
        { timeout: 10_000, timeoutMsg: `${source} Live Preview embed did not fail safely` },
      );
      await expect(embed).toHaveText(expect.stringContaining(message));
      await expect(embed.$("a.internal-link")).toExist();
      await expect(embed.$('[data-action="open-externally"]')).toExist();
    }
  });

  it("opens the exact PPTX slide from the explicit source action", async () => {
    await obsidianPage.openFile("embed-note.md");
    await ensureLivePreview();

    const embed = await browser.$(
      '.workspace-leaf.mod-active .cm-editor .pptx-slide-embed',
    );
    await browser.waitUntil(
      async () => (await embed.getAttribute("data-state")) === "ready",
      {
        timeout: 10_000,
        timeoutMsg: "Live Preview embed did not become ready",
      },
    );

    const source = embed.$(
      'a.internal-link[data-href="performance/representative-12-slides.pptx#slide-id=261&slide=4"]',
    );
    await expect(source).toExist();
    await source.click();

    const viewer = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await expect(viewer).toExist();
    await expect(viewer).toHaveAttribute("data-reference-slide-id", "261");
    await expect(viewer).toHaveText(expect.stringContaining("6 / 12"));
  });
});
