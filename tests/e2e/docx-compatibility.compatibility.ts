import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  assertNoNetworkRequests,
  installNetworkGuard,
} from "../compatibility/browser-environment";

const CORPUS = [
  { path: "docx-exploration/body-led-reference.docx", marker: "Market outlook" },
  { path: "docx-exploration/read-search-only.docx", marker: "generated paragraph" },
  { path: "docx-exploration/final-revisions.docx", marker: "Approved new language" },
  { path: "docx-exploration/unavailable-content.docx", marker: "Visible after unavailable content" },
  { path: "docx-exploration/layout-pages.docx", marker: "unique layout marker" },
] as const;

describe("installed DOCX body-led compatibility corpus", () => {
  it("opens at least ninety percent with readable mapped main-body content", async () => {
    await installNetworkGuard();
    const outcomes: Array<{ path: string; readable: boolean; layoutReadable?: boolean }> = [];

    for (const fixture of CORPUS) {
      await obsidianPage.openFile(fixture.path);
      const root = await browser.$(
        ".workspace-leaf.mod-active .office-viewer-docx-shell",
      );
      await root.waitForExist({ timeout: 30_000 });
      const readable =
        (await root.getAttribute("data-state")) === "ready" &&
        (await root.getText()).includes(fixture.marker);
      let layoutReadable: boolean | undefined;
      if (readable) {
        await expect(root.$("[data-docx-paragraph-ordinal]")).toExist();
        const layoutButton = root.$('[data-action="docx-view-mode-layout"]');
        if (await layoutButton.isExisting() && !(await layoutButton.getAttribute("disabled"))) {
          await layoutButton.click();
          await browser.waitUntil(
            async () => (await root.getAttribute("data-view-mode")) === "layout",
            { timeout: 15_000 },
          );
          layoutReadable =
            (await root.getAttribute("data-state")) === "ready" &&
            (await root.getText()).includes(fixture.marker) &&
            (await root.$("[data-docx-paragraph-ordinal]").isExisting());
        }
      }
      outcomes.push({ path: fixture.path, readable, layoutReadable });
    }

    const readable = outcomes.filter((outcome) => outcome.readable).length;
    expect(readable / CORPUS.length).toBeGreaterThanOrEqual(0.9);
    const layoutAttempts = outcomes.filter(
      (outcome) => outcome.layoutReadable !== undefined,
    );
    if (layoutAttempts.length > 0) {
      const layoutReadable = layoutAttempts.filter(
        (outcome) => outcome.layoutReadable,
      ).length;
      expect(layoutReadable / layoutAttempts.length).toBeGreaterThanOrEqual(0.9);
    }
    process.stdout.write(`${JSON.stringify({
      environment: { obsidian: "1.12.7", installer: "1.12.7" },
      readable,
      total: CORPUS.length,
      rate: readable / CORPUS.length,
      outcomes,
    })}\n`);
    await assertNoNetworkRequests();
  });
});
