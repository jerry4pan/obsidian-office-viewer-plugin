import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
  assertNoNetworkRequests,
  installNetworkGuard,
} from "../compatibility/browser-environment";

const EXPECTED_UI = {
  en: {
    previous: "Previous",
    next: "Next",
    slideNumber: "Slide number",
    go: "Go",
    thumbnails: "Thumbnails",
    thumbnailRail: "Slide thumbnails",
    firstThumbnail: "Slide 1",
    fullscreen: "Full screen",
    external: "Open in default application",
    diagnostics: "Copy diagnostic summary",
    pageTotal: "of 12",
    invalidPage: "Enter a slide number from 1 to 12.",
  },
  zh: {
    previous: "上一页",
    next: "下一页",
    slideNumber: "幻灯片编号",
    go: "跳转",
    thumbnails: "缩略图",
    thumbnailRail: "幻灯片缩略图",
    firstThumbnail: "第 1 张幻灯片",
    fullscreen: "全屏",
    external: "在默认应用中打开",
    diagnostics: "复制诊断摘要",
    pageTotal: "共 12 页",
    invalidPage: "请输入 1 到 12 之间的幻灯片编号。",
  },
  "zh-TW": {
    previous: "上一頁",
    next: "下一頁",
    slideNumber: "投影片編號",
    go: "跳至",
    thumbnails: "縮圖",
    thumbnailRail: "投影片縮圖",
    firstThumbnail: "第 1 張投影片",
    fullscreen: "全螢幕",
    external: "在預設應用程式中開啟",
    diagnostics: "複製診斷摘要",
    pageTotal: "共 12 頁",
    invalidPage: "請輸入 1 到 12 之間的投影片編號。",
  },
  fr: {
    previous: "Previous",
    next: "Next",
    slideNumber: "Slide number",
    go: "Go",
    thumbnails: "Thumbnails",
    thumbnailRail: "Slide thumbnails",
    firstThumbnail: "Slide 1",
    fullscreen: "Full screen",
    external: "Open in default application",
    diagnostics: "Copy diagnostic summary",
    pageTotal: "of 12",
    invalidPage: "Enter a slide number from 1 to 12.",
  },
} as const;

type HostLanguage = keyof typeof EXPECTED_UI;

const EXPECTED_HOST_LANGUAGE = {
  "en-US": "en",
  "zh-CN": "zh",
  "zh-TW": "zh-TW",
  fr: "fr",
} as const satisfies Readonly<Record<string, HostLanguage>>;

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

describe("multilingual installed smoke", () => {
  it("follows the Obsidian host language and preserves local-only read-only behavior", async () => {
    await installNetworkGuard();
    const requestedCapabilities = browser.requestedCapabilities as {
      "goog:chromeOptions"?: { args?: string[] };
    };
    const languageArgument = requestedCapabilities["goog:chromeOptions"]?.args
      ?.find((argument) => argument.startsWith("--lang="));
    const requestedLanguage = languageArgument?.slice("--lang=".length);
    if (!requestedLanguage || !(requestedLanguage in EXPECTED_HOST_LANGUAGE)) {
      throw new Error(`Missing expected host-language capability: ${languageArgument}`);
    }
    const expectedHostLanguage = EXPECTED_HOST_LANGUAGE[
      requestedLanguage as keyof typeof EXPECTED_HOST_LANGUAGE
    ];
    const hostLanguage = await browser.executeObsidian(({ obsidian }) =>
      obsidian.getLanguage()
    );
    expect(hostLanguage).toBe(expectedHostLanguage);
    const expected = EXPECTED_UI[expectedHostLanguage];
    const path = "performance/representative-12-slides.pptx";
    const before = await vaultSha256(path);

    await browser.executeObsidian(async ({ app }) => {
      const plugin = (app as unknown as {
        plugins: { plugins: Record<string, unknown> };
      }).plugins.plugins["office-viewer"] as {
        store?: {
          setDiagnosticSummary(enabled: boolean): Promise<void>;
          flush(): Promise<void>;
        };
      };
      if (!plugin?.store) throw new Error("Installed office-viewer store unavailable");
      await plugin.store.setDiagnosticSummary(true);
      await plugin.store.flush();
    });

    await obsidianPage.openFile(path);
    const root = await browser.$(
      '.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]',
    );
    await expect(root).toExist();
    await expect(root.$('[data-action="previous-slide"]')).toHaveText(expected.previous);
    await expect(root.$('[data-action="next-slide"]')).toHaveText(expected.next);
    await expect(root.$('[data-action="page-number"]')).toHaveAttribute(
      "aria-label",
      expected.slideNumber,
    );
    await expect(root.$('[data-action="jump-to-slide"]')).toHaveText(expected.go);
    await expect(root.$('[data-action="toggle-thumbnails"]')).toHaveText(
      expected.thumbnails,
    );
    await expect(root.$('.pptx-viewer__thumbnail-rail')).toHaveAttribute(
      "aria-label",
      expected.thumbnailRail,
    );
    await expect(root.$('[data-action="thumbnail-slide"]')).toHaveAttribute(
      "aria-label",
      expected.firstThumbnail,
    );
    await expect(root.$('[data-action="toggle-fullscreen"]')).toHaveText(
      expected.fullscreen,
    );
    await expect(root.$('[data-action="open-externally"]')).toHaveText(
      expected.external,
    );
    await expect(root.$('[data-action="copy-diagnostics"]')).toHaveAttribute(
      "aria-label",
      expected.diagnostics,
    );
    await expect(root.$('.pptx-viewer__page-total')).toHaveText(expected.pageTotal);

    await root.$('[data-action="next-slide"]').click();
    await expect(root.$('.pptx-viewer__page-counter')).toHaveText("2 / 12");
    const pageInput = root.$('[data-action="page-number"]');
    await pageInput.setValue("13");
    await root.$('[data-action="jump-to-slide"]').click();
    await expect(root).toHaveText(expect.stringContaining(expected.invalidPage));

    expect(await vaultSha256(path)).toBe(before);
    await assertNoNetworkRequests();
  });
});
