import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

describe("PPTX file view", () => {
  it("opens a local PPTX and renders slide 1", async () => {
    await obsidianPage.openFile("minimal.pptx");

    const root = await browser.$('.pptx-viewer[data-state="ready"]');
    await expect(root).toExist();
    await expect(root).toHaveText(expect.stringContaining("Obsidian PPTX smoke test"));
    await expect(root).toHaveText(expect.stringContaining("1 / 1"));
  });
});
