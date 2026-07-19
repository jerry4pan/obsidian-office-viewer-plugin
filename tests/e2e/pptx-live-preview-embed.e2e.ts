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
