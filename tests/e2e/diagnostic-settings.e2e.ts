import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  assertNoNetworkRequests,
  installNetworkGuard,
} from "../compatibility/browser-environment";
import {
  closeSettings,
  readDiagnosticSummaryEnabled,
  setDiagnosticSummaryEnabled,
} from "./office-viewer-settings";

const COMPATIBILITY_FIXTURE = "compatibility/images-transparency-standard.pptx";

async function closePptxLeaves(): Promise<void> {
  await browser.executeObsidian(({ app }) => {
    for (const leaf of app.workspace.getLeavesOfType("pptx-viewer")) leaf.detach();
  });
  await browser.waitUntil(
    async () => browser.execute(() => document.querySelectorAll(".pptx-viewer").length === 0),
    { timeout: 10_000, timeoutMsg: "PPTX leaves did not close" },
  );
}

describe("diagnostic summary settings", () => {
  it("keeps non-blocking warnings hidden by default and shows them after enabling via settings UI", async () => {
    await installNetworkGuard();
    await closePptxLeaves();

    expect(await readDiagnosticSummaryEnabled("Diagnostic summary")).toBe(false);
    await closeSettings();

    await obsidianPage.openFile(COMPATIBILITY_FIXTURE);
    const root = await browser.$('.pptx-viewer[data-state="ready"]');
    await expect(root).toExist();
    await expect(root.$('[data-action="copy-diagnostics"]')).not.toExist();
    await expect(root.$('[data-warning-category="unsupported-content"]')).not.toExist();

    await setDiagnosticSummaryEnabled(true, "Diagnostic summary");
    await closeSettings();
    await closePptxLeaves();
    await obsidianPage.openFile(COMPATIBILITY_FIXTURE);
    const enabledRoot = await browser.$('.pptx-viewer[data-state="ready"]');
    await expect(enabledRoot.$('[data-action="copy-diagnostics"]')).toExist();
    await expect(enabledRoot.$('[data-warning-category="unsupported-content"]')).toExist();

    await assertNoNetworkRequests();
  });
});
