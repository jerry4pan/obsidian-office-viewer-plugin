import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  assertNoNetworkRequests,
  installNetworkGuard,
} from "../compatibility/browser-environment";
import {
  expectedFailureFixtures,
  safeRenderFixtures,
  vaultPath,
} from "../failure/failure-fixtures";

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

describe("PPTX file view", () => {
  it("opens a local PPTX and renders slide 1", async () => {
    await installNetworkGuard();
    await obsidianPage.openFile("minimal.pptx");

    const root = await browser.$('.pptx-viewer[data-state="ready"]');
    await expect(root).toExist();
    await expect(root).toHaveText(expect.stringContaining("Obsidian PPTX smoke test"));
    await expect(root).toHaveText(expect.stringContaining("1 / 1"));
    await assertNoNetworkRequests();
  });

  it("navigates a multi-page deck without mutating the source", async () => {
    await installNetworkGuard();
    const path = "performance/representative-12-slides.pptx";
    const before = await vaultSha256(path);

    await obsidianPage.openFile(path);
    const root = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await expect(root).toExist();
    await expect(root).toHaveText(expect.stringContaining("1 / 12"));
    await expect(root.$('[data-action="open-externally"]')).toExist();
    const readyLayout = await browser.execute(() => {
      const activeRoot = document.querySelector<HTMLElement>(
        ".workspace-leaf.mod-active .pptx-viewer",
      );
      const controls = activeRoot?.querySelector<HTMLElement>(
        ".pptx-viewer__controls",
      );
      const actionStatus = activeRoot?.querySelector<HTMLElement>(
        ".pptx-viewer__action-status",
      );
      const controlRows = new Set(
        Array.from(controls?.children ?? [], (element) =>
          Math.round(
            element.getBoundingClientRect().top +
              element.getBoundingClientRect().height / 2,
          ),
        ),
      ).size;
      return {
        actionStatusHeight: actionStatus?.getBoundingClientRect().height ?? -1,
        controlRows,
      };
    });
    expect(readyLayout).toEqual({ actionStatusHeight: 0, controlRows: 1 });

    await root.$('[data-action="next-slide"]').click();
    await browser.waitUntil(
      async () => (await root.getText()).includes("2 / 12"),
      { timeout: 10_000, timeoutMsg: "Next did not render slide 2" },
    );

    const pageInput = root.$('[data-action="page-number"]');
    await pageInput.setValue("12");
    await root.$('[data-action="jump-to-slide"]').click();
    await browser.waitUntil(
      async () => (await root.getText()).includes("12 / 12"),
      { timeout: 10_000, timeoutMsg: "Page jump did not render slide 12" },
    );

    for (const invalidPage of ["0", "13", "1.5"]) {
      await pageInput.setValue(invalidPage);
      await root.$('[data-action="jump-to-slide"]').click();
      await expect(root).toHaveText(
        expect.stringContaining("Enter a slide number from 1 to 12."),
      );
      await expect(root).toHaveText(expect.stringContaining("12 / 12"));
      await expect(root).toHaveAttribute("data-state", "ready");
    }

    expect(await vaultSha256(path)).toBe(before);
    await browser.executeObsidian(({ app }) => app.workspace.activeLeaf?.detach());
    expect(await vaultSha256(path)).toBe(before);
    await assertNoNetworkRequests();
  });

  it("classifies every abnormal fixture without mutation or network access", async () => {
    await installNetworkGuard();

    for (const fixture of expectedFailureFixtures) {
      const path = vaultPath(fixture).replace("tests/vault/", "");
      const before = await vaultSha256(path);

      await obsidianPage.openFile(path);
      const root = await browser.$(
        ".workspace-leaf.mod-active .pptx-viewer",
      );
      await root.waitForExist({ timeout: 30_000 });
      await browser.waitUntil(
        async () =>
          (await root.getAttribute("data-state")) === "error" &&
          (await root.getAttribute("data-error-category")) === fixture.category,
        {
          timeout: 30_000,
          timeoutMsg: `${fixture.id} did not reach ${fixture.category}`,
        },
      );
      await expect(root).toHaveText(
        expect.stringContaining("The original PPTX file was not modified."),
      );
      await expect(root.$('[data-action="retry"]')).toExist();
      await expect(root.$('[data-action="open-externally"]')).toExist();

      expect(await vaultSha256(path)).toBe(before);
    }

    await obsidianPage.openFile("minimal.pptx");
    const recovered = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await expect(recovered).toExist();
    await expect(recovered).toHaveText(
      expect.stringContaining("Obsidian PPTX smoke test"),
    );
    await assertNoNetworkRequests();
  });

  it("keeps a healthy view usable while an abnormal view retries and closes", async () => {
    await installNetworkGuard();
    await obsidianPage.openFile("minimal.pptx");
    const activeHealthy = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await expect(activeHealthy).toHaveText(
      expect.stringContaining("Obsidian PPTX smoke test"),
    );
    await browser.execute(() => {
      document
        .querySelector('.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]')
        ?.setAttribute("data-e2e-view", "healthy");
    });
    const healthy = await browser.$('[data-e2e-view="healthy"]');

    const abnormal = expectedFailureFixtures.find(
      ({ id }) => id === "renderer-resource-limit",
    )!;
    const abnormalPath = vaultPath(abnormal).replace("tests/vault/", "");
    await browser.executeObsidian(
      async ({ app, obsidian }, path) => {
        const file = app.vault.getAbstractFileByPath(path);
        if (!(file instanceof obsidian.TFile)) throw new Error(`Missing ${path}`);
        const leaf = app.workspace.getLeaf("split");
        await leaf.openFile(file);
        app.workspace.setActiveLeaf(leaf, { focus: true });
      },
      abnormalPath,
    );

    const failed = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="error"]',
    );
    await failed.waitForExist({ timeout: 30_000 });
    await expect(healthy).toHaveText(
      expect.stringContaining("Obsidian PPTX smoke test"),
    );

    await failed.$('[data-action="retry"]').click();
    await browser.waitUntil(
      async () => (await failed.getAttribute("data-state")) === "error",
      { timeout: 30_000, timeoutMsg: "abnormal retry did not settle" },
    );
    await browser.executeObsidian(({ app }) => app.workspace.activeLeaf?.detach());

    await expect(healthy).toExist();
    await expect(healthy).toHaveAttribute("data-state", "ready");
    await expect(healthy).toHaveText(
      expect.stringContaining("Obsidian PPTX smoke test"),
    );
    await assertNoNetworkRequests();
  });

  it("renders a safe external hyperlink without network access", async () => {
    await installNetworkGuard();
    const fixture = safeRenderFixtures.find(
      ({ id }) => id === "external-relationship-safe",
    )!;
    await obsidianPage.openFile(vaultPath(fixture).replace("tests/vault/", ""));

    const root = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await expect(root).toExist();
    await expect(root).toHaveText(expect.stringContaining("Failure fixture"));
    await assertNoNetworkRequests();
  });

  it("cleans an abnormal open state when the plugin unloads", async () => {
    await installNetworkGuard();
    const fixture = expectedFailureFixtures.find(
      ({ id }) => id === "renderer-resource-limit",
    )!;
    await obsidianPage.openFile(vaultPath(fixture).replace("tests/vault/", ""));
    const root = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="error"]',
    );
    await expect(root).toExist();

    await obsidianPage.disablePlugin("office-viewer");
    try {
      const remaining = await browser.execute(() =>
        Array.from(document.querySelectorAll<HTMLElement>(".pptx-viewer")).map(
          (element) => ({
            state: element.dataset.state ?? null,
            category: element.dataset.errorCategory ?? null,
            childCount: element.childElementCount,
          }),
        ),
      );
      expect(remaining).toEqual([]);
      await assertNoNetworkRequests();
    } finally {
      await obsidianPage.enablePlugin("office-viewer");
    }
  });
});
