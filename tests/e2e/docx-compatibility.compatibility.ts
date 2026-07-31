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
] as const;

describe("installed DOCX body-led compatibility corpus", () => {
  it("opens at least ninety percent with readable mapped main-body content", async () => {
    await installNetworkGuard();
    const outcomes: Array<{ path: string; readable: boolean }> = [];

    for (const fixture of CORPUS) {
      await obsidianPage.openFile(fixture.path);
      const root = await browser.$(
        ".workspace-leaf.mod-active .office-viewer-docx-shell",
      );
      await root.waitForExist({ timeout: 30_000 });
      const readable =
        (await root.getAttribute("data-state")) === "ready" &&
        (await root.getText()).includes(fixture.marker);
      outcomes.push({ path: fixture.path, readable });
      if (readable) {
        await expect(root.$("[data-docx-paragraph-ordinal]")).toExist();
      }
    }

    const readable = outcomes.filter((outcome) => outcome.readable).length;
    expect(readable / CORPUS.length).toBeGreaterThanOrEqual(0.9);
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
