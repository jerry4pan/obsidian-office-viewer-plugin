import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  assertNoNetworkRequests,
  installNetworkGuard,
} from "../compatibility/browser-environment";

async function vaultSha256(vaultPath: string): Promise<string> {
  return browser.executeObsidian(
    async ({ app, obsidian, require }, path) => {
      const file = app.vault.getAbstractFileByPath(path);
      if (!(file instanceof obsidian.TFile)) throw new Error(`Missing ${path}`);
      const buffer = await app.vault.readBinary(file);
      const { createHash } = require("node:crypto") as typeof import("node:crypto");
      return createHash("sha256")
        .update(new Uint8Array(buffer))
        .digest("hex");
    },
    vaultPath,
  );
}

describe("installed DOCX reading and search", () => {
  it("reads, searches, navigates, and keeps the source local and unchanged", async () => {
    await installNetworkGuard();
    const path = "docx-exploration/body-led-reference.docx";
    const before = await vaultSha256(path);

    await obsidianPage.openFile(path);
    const root = await browser.$(
      '.workspace-leaf.mod-active .office-viewer-docx-shell[data-state="ready"]',
    );
    await expect(root).toExist();
    await expect(root).toHaveAttribute("data-view-mode", "reading");
    await expect(root).toHaveText(expect.stringContaining("Market outlook"));
    await expect(root.$('[data-action="docx-view-mode-reading"]')).toExist();
    await expect(root.$('[data-action="docx-view-mode-layout"]')).toExist();
    await expect(root.$('[data-action="open-docx-search"]')).toExist();
    await expect(
      root.$('[data-action="open-externally"]'),
    ).toHaveText("Open in default application");
    await expect(root.$("[data-office-viewer-brand]")).toExist();
    await expect(root.$(".office-viewer-brand__product")).toHaveText(
      "Office Viewer",
    );
    await expect(root.$(".office-viewer-brand__format")).toHaveText("DOCX");
    await expect(root.$(".office-viewer-brand__creator")).not.toExist();
    await expect(
      root.$('a[data-docx-external-link="true"]'),
    ).toHaveAttribute("href", "https://example.com/evidence");

    await root.$('[data-action="open-docx-search"]').click();
    await expect(root).toHaveAttribute("data-search-open", "true");
    const search = root.$('[data-action="docx-search-input"]');
    await search.setValue("confidential reports");
    const result = root.$(".office-viewer-docx-search-result");
    await expect(result).toHaveText(expect.stringContaining("Paragraph 3"));
    await result.click();
    await expect(
      root.$('[data-docx-paragraph-ordinal="3"]'),
    ).toHaveElementClass("is-active-docx-paragraph");

    expect(await vaultSha256(path)).toBe(before);
    await assertNoNetworkRequests();
  });

  it("switches to layout view with page geometry and keeps the source unchanged", async () => {
    await installNetworkGuard();
    const path = "docx-exploration/layout-pages.docx";
    const before = await vaultSha256(path);

    await obsidianPage.openFile(path);
    const root = await browser.$(
      '.workspace-leaf.mod-active .office-viewer-docx-shell[data-state="ready"]',
    );
    await expect(root).toHaveAttribute("data-view-mode", "reading");

    await root.$('[data-action="docx-view-mode-layout"]').click();
    await browser.waitUntil(
      async () => (await root.getAttribute("data-view-mode")) === "layout",
      { timeout: 15_000 },
    );
    const pageCount = await browser.execute(() =>
      document.querySelectorAll(
        ".workspace-leaf.mod-active .office-viewer-docx-reading-body section.docx",
      ).length);
    expect(pageCount).toBeGreaterThan(1);

    const geometry = await browser.execute(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          ".workspace-leaf.mod-active .office-viewer-docx-reading-body section.docx",
        ),
      ).map((page) => ({
        width: page.style.width || page.style.minWidth,
        minHeight: page.style.minHeight || page.style.height,
        clientWidth: page.clientWidth,
      })));
    expect(
      geometry.some((page) => page.width.length > 0 || page.minHeight.length > 0),
    ).toBe(true);
    const clientWidths = new Set(
      geometry.map((page) => page.clientWidth).filter((width) => width > 0),
    );
    expect(clientWidths.size).toBeGreaterThan(0);

    await root.$('[data-action="open-docx-search"]').click();
    await root
      .$('[data-action="docx-search-input"]')
      .setValue("unique layout marker");
    await root.$(".office-viewer-docx-search-result").click();
    const activeCount = await browser.execute(() =>
      document.querySelectorAll(
        ".workspace-leaf.mod-active .is-active-docx-paragraph",
      ).length);
    expect(activeCount).toBeGreaterThan(0);

    await root.$('[data-action="docx-view-mode-reading"]').click();
    await browser.waitUntil(
      async () => (await root.getAttribute("data-view-mode")) === "reading",
      { timeout: 15_000 },
    );
    expect(await vaultSha256(path)).toBe(before);
    await assertNoNetworkRequests();
  });

  it("shows detected omissions and rejects active content locally", async () => {
    await installNetworkGuard();
    const degradedPath = "docx-exploration/unavailable-content.docx";
    const degradedBefore = await vaultSha256(degradedPath);

    await obsidianPage.openFile(degradedPath);
    const degraded = await browser.$(
      '.workspace-leaf.mod-active .office-viewer-docx-shell[data-state="ready"]',
    );
    await expect(degraded).toHaveText(
      expect.stringContaining("Some main-body content cannot be represented"),
    );
    expect(
      await degraded.$$(".office-viewer-docx-unavailable-content"),
    ).not.toHaveLength(0);
    expect(await vaultSha256(degradedPath)).toBe(degradedBefore);

    const activePath = "docx-exploration/active-content.docx";
    const activeBefore = await vaultSha256(activePath);
    await obsidianPage.openFile(activePath);
    const rejected = await browser.$(
      '.workspace-leaf.mod-active .office-viewer-docx-shell[data-state="error"]',
    );
    await expect(rejected).toHaveAttribute("data-error-category", "incompatible");
    await expect(rejected.$(".office-viewer-error")).toExist();
    await expect(rejected.$('[data-action="retry"]')).toExist();
    await expect(rejected).toHaveText(
      expect.stringContaining("original DOCX file was not modified"),
    );
    expect(await vaultSha256(activePath)).toBe(activeBefore);
    await assertNoNetworkRequests();
  });

  it("reveals a distant search result without materializing the stress body", async () => {
    await installNetworkGuard();
    const path = "docx-exploration/performance-stress-5000-paragraphs.docx";
    const before = await vaultSha256(path);

    await obsidianPage.openFile(path);
    const root = await browser.$(
      '.workspace-leaf.mod-active .office-viewer-docx-shell[data-state="ready"]',
    );
    await expect(root).toHaveAttribute("data-renderer", "bounded-semantic");
    await expect(
      root.$('[data-action="docx-view-mode-layout"]'),
    ).toBeDisabled();
    expect(
      await browser.execute(() =>
        document.querySelectorAll(
          ".workspace-leaf.mod-active .office-viewer-docx-reading-body *",
        ).length),
    ).toBeLessThanOrEqual(1_200);

    await root.$('[data-action="open-docx-search"]').click();
    await root
      .$('[data-action="docx-search-input"]')
      .setValue("Stress paragraph 4999:");
    await root.$(".office-viewer-docx-search-result").click();
    await expect(
      root.$('[data-docx-paragraph-ordinal="4999"]'),
    ).toHaveElementClass("is-active-docx-paragraph");
    expect(
      await browser.execute(() =>
        document.querySelectorAll(
          ".workspace-leaf.mod-active .office-viewer-docx-reading-body *",
        ).length),
    ).toBeLessThanOrEqual(1_200);
    expect(await vaultSha256(path)).toBe(before);
    await assertNoNetworkRequests();
  });
});
