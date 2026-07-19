import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

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
