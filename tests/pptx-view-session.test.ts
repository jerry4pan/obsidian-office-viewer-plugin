import { describe, expect, it, vi } from "vitest";
import { createMessageTranslator } from "../src/i18n";
import { PptxViewSession } from "../src/pptx-view-session";
import { PptxOpenError } from "../src/pptx-open-error";
import type {
  PptxRendererAdapter,
  PptxRendererSession,
} from "../src/renderer/pptx-renderer-adapter";

function makeRenderer(slideCount = 1) {
  const rendererSession: PptxRendererSession = {
    slideCount,
    slideWidth: 960,
    slideHeight: 540,
    capabilities: { thumbnails: false, prefetch: false },
    renderSlide: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
  const adapter: PptxRendererAdapter = {
    open: vi.fn(async (_buffer, container) => {
      container.textContent = "Obsidian PPTX smoke test";
      return rendererSession;
    }),
  };
  return { adapter, rendererSession };
}

function makeM2Renderer(slideCount = 10) {
  const rendererSession: PptxRendererSession = {
    slideCount,
    slideWidth: 960,
    slideHeight: 540,
    capabilities: { thumbnails: true, prefetch: true },
    renderSlide: vi.fn(async () => {}),
    renderThumbnail: vi.fn((index, container) => {
      container.textContent = `Preview ${index + 1}`;
      return { ready: Promise.resolve(), dispose: vi.fn() };
    }),
    prefetchSlide: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
  const adapter: PptxRendererAdapter = {
    open: vi.fn(async (_buffer, container) => {
      container.textContent = "Obsidian PPTX smoke test";
      return rendererSession;
    }),
  };
  return { adapter, rendererSession };
}

function makeFullscreen() {
  let activeRoot: HTMLElement | null = null;
  const listeners = new Set<() => void>();
  return {
    api: {
      isActive: vi.fn((root: HTMLElement) => root === activeRoot),
      enter: vi.fn(async (root: HTMLElement) => {
        activeRoot = root;
        listeners.forEach((listener) => listener());
      }),
      exit: vi.fn(async () => {
        activeRoot = null;
        listeners.forEach((listener) => listener());
      }),
      subscribe: vi.fn((listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }),
    },
    listeners,
  };
}

describe("PptxViewSession", () => {
  it("renders the core reading loop in Simplified Chinese", async () => {
    const root = document.createElement("div");
    let finishRead!: (bytes: ArrayBuffer) => void;
    const reader = {
      readBinary: vi.fn(
        () => new Promise<ArrayBuffer>((resolve) => {
          finishRead = resolve;
        }),
      ),
    };
    const { adapter } = makeRenderer(3);
    const session = new PptxViewSession(root, reader, adapter, {
      messages: createMessageTranslator("zh-CN"),
      openExternally: vi.fn(async () => {}),
    });

    expect(root.textContent).toContain("从仓库中打开 PPTX 文件即可开始阅读。");

    const opening = session.open("deck.pptx");
    expect(root.textContent).toContain("正在加载演示文稿…");
    expect(root.querySelector('[data-action="previous-slide"]')?.textContent)
      .toBe("上一页");
    expect(root.querySelector('[data-action="next-slide"]')?.textContent)
      .toBe("下一页");
    expect(
      root.querySelector('[data-action="page-number"]')?.getAttribute(
        "aria-label",
      ),
    ).toBe("幻灯片编号");
    expect(root.querySelector('[data-action="jump-to-slide"]')?.textContent)
      .toBe("跳转");
    expect(root.querySelector('[data-action="toggle-thumbnails"]')?.textContent)
      .toBe("缩略图");
    expect(
      root.querySelector('[data-action="toggle-thumbnails"]')?.getAttribute(
        "aria-label",
      ),
    ).toBe("切换幻灯片缩略图");
    expect(root.querySelector('[data-action="toggle-fullscreen"]')?.textContent)
      .toBe("全屏");
    expect(
      root.querySelector('[data-action="toggle-fullscreen"]')?.getAttribute(
        "aria-label",
      ),
    ).toBe("进入全屏");
    expect(root.querySelector('[data-action="open-externally"]')?.textContent)
      .toBe("在默认应用中打开");

    finishRead(new ArrayBuffer(1));
    await opening;

    expect(root.textContent).toContain("1 / 3");
    expect(root.querySelector(".pptx-viewer__page-total")?.textContent).toBe(
      "共 3 页",
    );
  });

  it("renders the core reading loop in Traditional Chinese", async () => {
    const root = document.createElement("div");
    let finishRead!: (bytes: ArrayBuffer) => void;
    const { adapter } = makeRenderer(3);
    const session = new PptxViewSession(
      root,
      {
        readBinary: vi.fn(
          () => new Promise<ArrayBuffer>((resolve) => {
            finishRead = resolve;
          }),
        ),
      },
      adapter,
      {
        messages: createMessageTranslator("zh-TW"),
        openExternally: vi.fn(async () => {}),
      },
    );

    expect(root.textContent).toContain("從儲存庫開啟 PPTX 檔案即可開始閱讀。");

    const opening = session.open("deck.pptx");
    expect(root.textContent).toContain("正在載入簡報…");

    expect(root.querySelector('[data-action="previous-slide"]')?.textContent)
      .toBe("上一頁");
    expect(root.querySelector('[data-action="next-slide"]')?.textContent)
      .toBe("下一頁");
    expect(root.querySelector('[data-action="jump-to-slide"]')?.textContent)
      .toBe("跳至");
    expect(root.querySelector('[data-action="toggle-thumbnails"]')?.textContent)
      .toBe("縮圖");
    expect(
      root.querySelector('[data-action="toggle-thumbnails"]')?.getAttribute(
        "aria-label",
      ),
    ).toBe("切換投影片縮圖");
    expect(root.querySelector('[data-action="toggle-fullscreen"]')?.textContent)
      .toBe("全螢幕");
    expect(
      root.querySelector('[data-action="toggle-fullscreen"]')?.getAttribute(
        "aria-label",
      ),
    ).toBe("進入全螢幕");
    expect(
      root.querySelector('[data-action="page-number"]')?.getAttribute(
        "aria-label",
      ),
    ).toBe("投影片編號");
    expect(root.querySelector('[data-action="open-externally"]')?.textContent)
      .toBe("在預設應用程式中開啟");

    finishRead(new ArrayBuffer(1));
    await opening;

    expect(root.querySelector(".pptx-viewer__page-total")?.textContent).toBe(
      "共 3 頁",
    );
    expect(
      root.querySelector('.pptx-viewer__thumbnail-rail')?.getAttribute(
        "aria-label",
      ),
    ).toBe("投影片縮圖");
    expect(
      root.querySelector('[data-action="resize-thumbnails"]')?.getAttribute(
        "aria-label",
      ),
    ).toBe("調整投影片縮圖大小");
  });

  it.each([
    [
      "en",
      "Enter a slide number from 1 to 3.",
      "Unable to change full-screen mode.",
      "Unable to open the default application.",
      "Slide 2 could not be rendered. The previous slide is still shown. Try another slide or open it in the default application.",
    ],
    [
      "zh-CN",
      "请输入 1 到 3 之间的幻灯片编号。",
      "无法切换全屏模式。",
      "无法打开默认应用。",
      "无法渲染第 2 张幻灯片。仍显示上一张幻灯片。请尝试其他幻灯片，或使用默认应用打开。",
    ],
    [
      "zh-TW",
      "請輸入 1 到 3 之間的投影片編號。",
      "無法切換全螢幕模式。",
      "無法開啟預設應用程式。",
      "無法呈現第 2 張投影片。仍顯示上一張投影片。請嘗試其他投影片，或使用預設應用程式開啟。",
    ],
  ] as const)(
    "renders validation and recoverable failures for %s",
    async (
      language,
      invalidPage,
      fullscreenFailure,
      externalFailure,
      renderFailure,
    ) => {
      const root = document.createElement("div");
      const rendererSession: PptxRendererSession = {
        slideCount: 3,
        slideWidth: 960,
        slideHeight: 540,
        capabilities: { thumbnails: false, prefetch: false },
        renderSlide: vi.fn(async (index) => {
          if (index === 1) throw new Error("candidate detail");
        }),
        dispose: vi.fn(),
      };
      const adapter: PptxRendererAdapter = {
        open: vi.fn(async () => rendererSession),
      };
      const fullscreen = {
        isActive: vi.fn(() => false),
        enter: vi.fn(async () => {
          throw new Error("platform detail");
        }),
        exit: vi.fn(async () => {}),
        subscribe: vi.fn(() => () => {}),
      };
      const session = new PptxViewSession(
        root,
        { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
        adapter,
        {
          messages: createMessageTranslator(language),
          fullscreen,
          openExternally: vi.fn(async () => {
            throw new Error("filesystem detail");
          }),
        },
      );
      await session.open("deck.pptx");

      const input = root.querySelector<HTMLInputElement>(
        '[data-action="page-number"]',
      )!;
      input.value = "0";
      root.querySelector<HTMLButtonElement>('[data-action="jump-to-slide"]')!
        .click();
      expect(root.textContent).toContain(invalidPage);

      root.querySelector<HTMLButtonElement>(
        '[data-action="toggle-fullscreen"]',
      )!.click();
      await vi.waitFor(() => expect(root.textContent).toContain(fullscreenFailure));

      root.querySelector<HTMLButtonElement>(
        '[data-action="open-externally"]',
      )!.click();
      await vi.waitFor(() => expect(root.textContent).toContain(externalFailure));

      root.querySelector<HTMLButtonElement>('[data-action="next-slide"]')!
        .click();
      await vi.waitFor(() => expect(root.textContent).toContain(renderFailure));
      expect(root.textContent).not.toContain("candidate detail");
      expect(root.textContent).not.toContain("platform detail");
      expect(root.textContent).not.toContain("filesystem detail");
    },
  );

  it.each([
    ["en", "Exit full screen", "Full screen", "Enter full screen"],
    ["zh-CN", "退出全屏", "全屏", "进入全屏"],
    ["zh-TW", "結束全螢幕", "全螢幕", "進入全螢幕"],
  ] as const)(
    "updates full-screen visible and accessible text for %s",
    async (language, exit, enterButton, enterLabel) => {
      const root = document.createElement("div");
      const { adapter } = makeRenderer(2);
      const fullscreen = makeFullscreen();
      const session = new PptxViewSession(
        root,
        { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
        adapter,
        {
          messages: createMessageTranslator(language),
          fullscreen: fullscreen.api,
        },
      );
      await session.open("deck.pptx");
      const button = root.querySelector<HTMLButtonElement>(
        '[data-action="toggle-fullscreen"]',
      )!;

      button.click();
      await vi.waitFor(() => expect(root.dataset.fullscreen).toBe("true"));
      expect(button.textContent).toBe(exit);
      expect(button.getAttribute("aria-label")).toBe(exit);

      button.click();
      await vi.waitFor(() => expect(root.dataset.fullscreen).toBe("false"));
      expect(button.textContent).toBe(enterButton);
      expect(button.getAttribute("aria-label")).toBe(enterLabel);
    },
  );

  it.each([
    ["en", "unsupported-legacy", "Legacy PPT files are not supported. Open this file in the default application.", "The original file was not modified.", "Retry"],
    ["en", "malformed", "This PPTX is damaged or incomplete.", "The original PPTX file was not modified.", "Retry"],
    ["en", "protected", "This PPTX is encrypted or password-protected.", "The original PPTX file was not modified.", "Retry"],
    ["en", "incompatible", "This PPTX uses content this viewer cannot safely display.", "The original PPTX file was not modified.", "Retry"],
    ["en", "resource-exhausted", "This PPTX is too large or complex to open within the viewer's safety limits.", "The original PPTX file was not modified.", "Retry"],
    ["en", "cancelled", "Loading this PPTX was cancelled.", "The original PPTX file was not modified.", "Retry"],
    ["en", "unknown", "An unexpected error prevented this PPTX from opening.", "The original PPTX file was not modified.", "Retry"],
    ["zh-CN", "malformed", "此 PPTX 已损坏或不完整。", "原始 PPTX 文件未被修改。", "重试"],
    ["zh-CN", "unsupported-legacy", "不支持旧版 PPT 文件。请在默认应用中打开此文件。", "原始文件未被修改。", "重试"],
    ["zh-CN", "protected", "此 PPTX 已加密或受密码保护。", "原始 PPTX 文件未被修改。", "重试"],
    ["zh-CN", "incompatible", "此 PPTX 包含此查看器无法安全显示的内容。", "原始 PPTX 文件未被修改。", "重试"],
    ["zh-CN", "resource-exhausted", "此 PPTX 过大或过于复杂，超出了查看器的安全限制。", "原始 PPTX 文件未被修改。", "重试"],
    ["zh-CN", "cancelled", "已取消加载此 PPTX。", "原始 PPTX 文件未被修改。", "重试"],
    ["zh-CN", "unknown", "发生意外错误，无法打开此 PPTX。", "原始 PPTX 文件未被修改。", "重试"],
    ["zh-TW", "malformed", "此 PPTX 已損毀或不完整。", "原始 PPTX 檔案未經修改。", "重試"],
    ["zh-TW", "unsupported-legacy", "不支援舊版 PPT 檔案。請在預設應用程式中開啟此檔案。", "原始檔案未經修改。", "重試"],
    ["zh-TW", "protected", "此 PPTX 已加密或受密碼保護。", "原始 PPTX 檔案未經修改。", "重試"],
    ["zh-TW", "incompatible", "此 PPTX 包含此檢視器無法安全顯示的內容。", "原始 PPTX 檔案未經修改。", "重試"],
    ["zh-TW", "resource-exhausted", "此 PPTX 過大或過於複雜，超出檢視器的安全限制。", "原始 PPTX 檔案未經修改。", "重試"],
    ["zh-TW", "cancelled", "已取消載入此 PPTX。", "原始 PPTX 檔案未經修改。", "重試"],
    ["zh-TW", "unknown", "發生未預期的錯誤，無法開啟此 PPTX。", "原始 PPTX 檔案未經修改。", "重試"],
  ] as const)(
    "renders the %s %s blocking error surface",
    async (language, category, title, safety, retry) => {
      const root = document.createElement("div");
      const adapter: PptxRendererAdapter = {
        open: vi.fn(async () => {
          throw new PptxOpenError(category, "private candidate detail");
        }),
      };
      const session = new PptxViewSession(
        root,
        { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
        adapter,
        { messages: createMessageTranslator(language) },
      );

      await session.open("deck.pptx");

      expect(root.textContent).toContain(title);
      expect(root.textContent).toContain(safety);
      expect(root.querySelector('[data-action="retry"]')?.textContent).toBe(
        retry,
      );
      expect(root.textContent).not.toContain("private candidate detail");
    },
  );

  it.each([
    ["en", "Some presentation content may not render correctly", "One or more presentation fonts are unavailable"],
    ["zh-CN", "部分演示文稿内容可能无法正确显示", "一个或多个演示文稿字体不可用"],
    ["zh-TW", "部分簡報內容可能無法正確顯示", "一個或多個簡報字型無法使用"],
  ] as const)(
    "keeps known compatibility limitations visible in %s",
    async (language, unsupported, fontSubstitution) => {
      const root = document.createElement("div");
      const { adapter, rendererSession } = makeRenderer(2);
      Object.defineProperty(rendererSession, "compatibilityWarnings", {
        value: ["unsupported-content", "font-substitution"],
      });
      const session = new PptxViewSession(
        root,
        { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
        adapter,
        {
          messages: createMessageTranslator(language),
          openExternally: vi.fn(async () => {}),
        },
      );

      await session.open("deck.pptx");

      expect(root.dataset.state).toBe("ready");
      expect(root.querySelector('[data-warning-category="unsupported-content"]')
        ?.textContent).toContain(unsupported);
      expect(root.querySelector('[data-warning-category="font-substitution"]')
        ?.textContent).toContain(fontSubstitution);
      expect(root.querySelector('[data-action="open-externally"]')).not.toBeNull();
    },
  );

  it.each([
    ["en", "Copy diagnostic summary", "Diagnostic summary copied."],
    ["zh-CN", "复制诊断摘要", "已复制诊断摘要。"],
    ["zh-TW", "複製診斷摘要", "已複製診斷摘要。"],
  ] as const)("copies a content-free diagnostic summary in %s", async (
    language,
    copyLabel,
    copiedStatus,
  ) => {
    const root = document.createElement("div");
    const copy = vi.fn(async (_summary: string) => {});
    const { adapter } = makeRenderer(2);
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(42)) },
      adapter,
      {
        messages: createMessageTranslator(language),
        diagnostics: {
          environment: {
            pluginVersion: "0.0.1",
            obsidianVersion: "1.13.1",
            rendererVersion: "1.2.4",
            operatingSystem: "darwin-arm64",
          },
          rememberReadingPosition: () => true,
          copy,
        },
      },
    );

    await session.open("private/customer-roadmap.pptx");
    const copyButton = root.querySelector<HTMLButtonElement>(
      '[data-action="copy-diagnostics"]',
    )!;
    expect(copyButton.getAttribute("aria-label")).toBe(copyLabel);
    copyButton.click();
    await vi.waitFor(() => expect(copy).toHaveBeenCalledOnce());

    const copied = copy.mock.calls[0]![0];
    expect(JSON.parse(copied)).toMatchObject({
      sourceBytes: 42,
      slideCount: 2,
      lifecyclePhase: "ready",
      errorCategory: null,
    });
    expect(copied).not.toContain("customer-roadmap");
    expect(root.textContent).toContain(copiedStatus);
  });

  it.each([
    ["en", "Unable to copy the diagnostic summary."],
    ["zh-CN", "无法复制诊断摘要。"],
    ["zh-TW", "無法複製診斷摘要。"],
  ] as const)("reports a diagnostic copy failure in %s", async (
    language,
    failureStatus,
  ) => {
    const root = document.createElement("div");
    const { adapter } = makeRenderer();
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      {
        messages: createMessageTranslator(language),
        diagnostics: {
          environment: {
            pluginVersion: "0.0.1",
            obsidianVersion: "1.13.1",
            rendererVersion: "1.2.4",
            operatingSystem: "darwin-arm64",
          },
          rememberReadingPosition: () => false,
          copy: vi.fn(async () => { throw new Error("clipboard unavailable"); }),
        },
      },
    );

    await session.open("deck.pptx");
    root.querySelector<HTMLButtonElement>('[data-action="copy-diagnostics"]')!
      .click();

    await vi.waitFor(() =>
      expect(root.textContent).toContain(failureStatus)
    );
  });

  it("classifies a current AbortError as a recoverable cancelled load", async () => {
    const root = document.createElement("div");
    const adapter: PptxRendererAdapter = {
      open: vi.fn(async () => {
        throw new DOMException("cancelled", "AbortError");
      }),
    };
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
    );

    await session.open("deck.pptx");

    expect(root.dataset.errorCategory).toBe("cancelled");
    expect(root.textContent).toContain("Loading this PPTX was cancelled.");
  });

  it("keeps fit-to-window automatic and exposes no manual zoom controls", async () => {
    const root = document.createElement("div");
    const { adapter } = makeM2Renderer(3);
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
    );

    await session.open("deck.pptx");

    expect(root.querySelector('[data-action="zoom-out"]')).toBeNull();
    expect(root.querySelector('[data-action="zoom-in"]')).toBeNull();
    expect(root.querySelector('[data-action="fit-slide"]')).toBeNull();
    expect(root.dataset.zoomMode).toBeUndefined();
    expect(root.dataset.zoomPercent).toBeUndefined();
    expect(root.querySelector('[data-action="open-externally"]')).toBeNull();

    session.dispose();
  });

  it("exposes an accessible thumbnail divider with keyboard resize and reset", async () => {
    const root = document.createElement("div");
    const { adapter, rendererSession } = makeM2Renderer(12);
    const recordWidth = vi.fn();
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      {
        thumbnailRail: {
          initialWidth: () => 300,
          recordWidth,
        },
      },
    );

    await session.open("deck.pptx");
    const divider = root.querySelector<HTMLElement>(
      '[role="separator"][aria-orientation="vertical"]',
    );
    const rail = root.querySelector<HTMLElement>(
      ".pptx-viewer__thumbnail-rail",
    );

    expect(divider?.getAttribute("aria-label")).toBe(
      "Resize slide thumbnails",
    );
    expect(divider?.tabIndex).toBe(0);
    expect(divider?.getAttribute("aria-valuenow")).toBe("300");
    expect(rail?.style.width).toBe("300px");

    divider?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "ArrowRight",
      }),
    );
    expect(divider?.getAttribute("aria-valuenow")).toBe("316");
    expect(recordWidth).toHaveBeenLastCalledWith(316);
    await Promise.resolve();
    expect(rendererSession.renderSlide).toHaveBeenCalledTimes(1);
    expect(root.textContent).toContain("1 / 12");

    divider?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "ArrowLeft",
        shiftKey: true,
      }),
    );
    expect(divider?.getAttribute("aria-valuenow")).toBe("268");
    expect(recordWidth).toHaveBeenLastCalledWith(268);

    divider?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(divider?.getAttribute("aria-valuenow")).toBe("168");
    expect(recordWidth).toHaveBeenLastCalledWith(168);

    session.dispose();
  });

  it("updates thumbnail layout while dragging and rerenders only after release", async () => {
    const root = document.createElement("div");
    const { adapter, rendererSession } = makeM2Renderer(12);
    const recordWidth = vi.fn();
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      {
        thumbnailRail: {
          initialWidth: () => 300,
          recordWidth,
        },
      },
    );
    await session.open("deck.pptx");
    const divider = root.querySelector<HTMLElement>(
      '[data-action="resize-thumbnails"]',
    )!;
    const rail = root.querySelector<HTMLElement>(
      ".pptx-viewer__thumbnail-rail",
    )!;
    const pointer = (type: string, clientX: number) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        button: 0,
        cancelable: true,
        clientX,
      });
      Object.defineProperty(event, "pointerId", { value: 7 });
      return event;
    };
    await vi.waitFor(() =>
      expect(rendererSession.renderThumbnail).toHaveBeenCalled(),
    );
    const callsBeforeDrag = vi.mocked(rendererSession.renderThumbnail!).mock
      .calls.length;

    divider.dispatchEvent(pointer("pointerdown", 300));
    window.dispatchEvent(pointer("pointermove", 400));

    expect(rail.style.width).toBe("400px");
    expect(recordWidth).not.toHaveBeenCalled();
    expect(vi.mocked(rendererSession.renderThumbnail!).mock.calls).toHaveLength(
      callsBeforeDrag,
    );

    window.dispatchEvent(pointer("pointerup", 400));

    expect(recordWidth).toHaveBeenLastCalledWith(400);
    await vi.waitFor(() =>
      expect(
        vi.mocked(rendererSession.renderThumbnail!).mock.calls.some(
          (call) => call[3] === 376,
        ),
      ).toBe(true),
    );

    session.dispose();
  });

  it("synchronizes the Vault-wide thumbnail width across open sessions", async () => {
    let width = 168;
    const listeners = new Set<(nextWidth: number) => void>();
    const thumbnailRail = {
      initialWidth: () => width,
      recordWidth: (nextWidth: number) => {
        width = nextWidth;
        listeners.forEach((listener) => listener(nextWidth));
      },
      subscribeWidth: (listener: (nextWidth: number) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const firstRoot = document.createElement("div");
    const secondRoot = document.createElement("div");
    const first = makeM2Renderer(3);
    const second = makeM2Renderer(3);
    const firstSession = new PptxViewSession(
      firstRoot,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      first.adapter,
      { thumbnailRail },
    );
    const secondSession = new PptxViewSession(
      secondRoot,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      second.adapter,
      { thumbnailRail },
    );
    await Promise.all([
      firstSession.open("first.pptx"),
      secondSession.open("second.pptx"),
    ]);

    firstRoot.querySelector<HTMLElement>('[data-action="resize-thumbnails"]')
      ?.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "ArrowRight",
      }));

    expect(width).toBe(184);
    expect(
      secondRoot.querySelector<HTMLElement>('[data-action="resize-thumbnails"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("184");
    firstSession.dispose();
    secondSession.dispose();
    expect(listeners.size).toBe(0);
  });

  it("renders a restored page exactly once and records only later successful navigation", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter, rendererSession } = makeM2Renderer(10);
    const record = vi.fn();
    const session = new PptxViewSession(root, reader, adapter, {
      positions: { initialSlideFor: vi.fn(() => 7), record },
    });

    await session.open("deck.pptx");

    expect(reader.readBinary).toHaveBeenCalledOnce();
    expect(rendererSession.renderSlide).toHaveBeenCalledTimes(1);
    expect(rendererSession.renderSlide).toHaveBeenCalledWith(7);
    expect(record).not.toHaveBeenCalled();
    root.querySelector<HTMLButtonElement>('[data-action="next-slide"]')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain("9 / 10"));
    expect(record).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledWith("deck.pptx", 8);
    session.dispose();
  });

  it("keeps reading when a position callback fails", async () => {
    const root = document.createElement("div");
    const { adapter } = makeM2Renderer(3);
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      {
        positions: {
          initialSlideFor: () => 0,
          record: () => { throw new Error("private persistence detail"); },
        },
      },
    );
    await session.open("deck.pptx");

    root.querySelector<HTMLButtonElement>('[data-action="next-slide"]')!.click();

    await vi.waitFor(() => expect(root.textContent).toContain("2 / 3"));
    expect(root.dataset.state).toBe("ready");
    expect(root.textContent).not.toContain("private persistence detail");
    session.dispose();
  });

  it("keeps page state independent between sessions", async () => {
    const firstRoot = document.createElement("div");
    const secondRoot = document.createElement("div");
    document.body.append(firstRoot, secondRoot);
    const first = makeM2Renderer(4);
    const second = makeM2Renderer(4);
    const adapter: PptxRendererAdapter = {
      open: vi.fn().mockImplementationOnce(first.adapter.open).mockImplementationOnce(second.adapter.open),
    };
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const firstSession = new PptxViewSession(firstRoot, reader, adapter);
    const secondSession = new PptxViewSession(secondRoot, reader, adapter);
    await Promise.all([firstSession.open("a.pptx"), secondSession.open("b.pptx")]);

    firstRoot.querySelector<HTMLButtonElement>('[data-action="next-slide"]')!.click();
    await vi.waitFor(() => expect(firstRoot.textContent).toContain("2 / 4"));

    expect(secondRoot.textContent).toContain("1 / 4");
    expect(second.rendererSession.renderSlide).toHaveBeenCalledTimes(1);
    firstSession.dispose();
    secondSession.dispose();
  });

  it("supports accessible keyboard, thumbnail, collapse, and full-screen actions", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const { adapter, rendererSession } = makeM2Renderer(6);
    const fullscreen = makeFullscreen();
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      { fullscreen: fullscreen.api },
    );
    await session.open("deck.pptx");

    expect(document.activeElement).toBe(root);
    expect(root.tabIndex).toBe(0);
    expect(root.querySelector('[data-action="toggle-fullscreen"]')?.getAttribute("aria-label")).toBe("Enter full screen");
    expect(root.querySelector('[aria-label="Slide thumbnails"]')).not.toBeNull();
    expect(root.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();

    for (const [key, page] of [["ArrowRight", "2 / 6"], ["PageDown", "3 / 6"], ["ArrowLeft", "2 / 6"], ["PageUp", "1 / 6"]] as const) {
      const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
      root.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(root.textContent).toContain(page));
    }
    const boundary = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowLeft" });
    root.dispatchEvent(boundary);
    expect(boundary.defaultPrevented).toBe(false);

    const input = root.querySelector<HTMLInputElement>('[data-action="page-number"]')!;
    const editableEvent = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowRight" });
    input.dispatchEvent(editableEvent);
    expect(editableEvent.defaultPrevented).toBe(false);
    expect(rendererSession.renderSlide).toHaveBeenCalledTimes(5);

    root.querySelector<HTMLButtonElement>('[data-slide-index="2"]')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain("3 / 6"));
    expect(root.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe("Slide 3");

    root.querySelector<HTMLButtonElement>('[data-action="toggle-thumbnails"]')!.click();
    expect(root.dataset.thumbnailsCollapsed).toBe("true");
    expect(root.querySelector('[data-action="toggle-thumbnails"]')?.getAttribute("aria-expanded")).toBe("false");

    root.querySelector<HTMLButtonElement>('[data-action="toggle-fullscreen"]')!.click();
    await vi.waitFor(() => expect(root.dataset.fullscreen).toBe("true"));
    expect(fullscreen.api.enter).toHaveBeenCalledWith(root);
    expect(root.querySelector('[data-action="toggle-fullscreen"]')?.getAttribute("aria-label")).toBe("Exit full screen");
    root.querySelector<HTMLButtonElement>('[data-action="toggle-fullscreen"]')!.click();
    await vi.waitFor(() => expect(root.dataset.fullscreen).toBe("false"));
    expect(fullscreen.api.exit).toHaveBeenCalledOnce();

    const actions = Array.from(root.querySelectorAll<HTMLElement>("button, input"), (item) => item.dataset.action).filter(Boolean);
    expect(actions.indexOf("previous-slide")).toBeLessThan(actions.indexOf("page-number"));
    expect(actions.indexOf("page-number")).toBeLessThan(actions.indexOf("toggle-fullscreen"));
    session.dispose();
  });

  it("keeps full-screen failures local and disposes session-owned work", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const { adapter, rendererSession } = makeM2Renderer(20);
    const fullscreen = makeFullscreen();
    fullscreen.api.enter.mockRejectedValueOnce(new Error("platform detail"));
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      { fullscreen: fullscreen.api },
    );
    await session.open("deck.pptx");

    root.querySelector<HTMLButtonElement>('[data-action="toggle-fullscreen"]')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain("Unable to change full-screen mode."));
    expect(root.dataset.fullscreen).toBe("false");
    expect(root.textContent).not.toContain("platform detail");
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      mountedThumbnails: expect.any(Number),
    });
    expect(Number(root.dataset.mountedThumbnailCount)).toBeGreaterThan(0);

    session.dispose();
    expect(fullscreen.listeners.size).toBe(0);
    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      backgroundPending: 0,
      backgroundRunning: 0,
      mountedThumbnails: 0,
    });
    const afterDispose = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowRight" });
    root.dispatchEvent(afterDispose);
    expect(afterDispose.defaultPrevented).toBe(false);
  });
  it("starts in an explicit empty state before a file is selected", () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter } = makeRenderer();

    new PptxViewSession(root, reader, adapter);

    expect(root.dataset.state).toBe("empty");
    expect(root.dataset.lifecyclePhase).toBe("idle");
    expect(root.textContent).toContain(
      "Open a PPTX file from your Vault to start reading.",
    );
  });

  it("exposes a candidate-independent in-flight phase after Vault reading completes", async () => {
    const root = document.createElement("div");
    let finishRead: ((bytes: ArrayBuffer) => void) | undefined;
    let finishAdapterOpen: ((session: PptxRendererSession) => void) | undefined;
    const rendererSession = makeRenderer().rendererSession;
    const reader = {
      readBinary: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            finishRead = resolve;
          }),
      ),
    };
    const adapter: PptxRendererAdapter = {
      open: vi.fn(
        () =>
          new Promise<PptxRendererSession>((resolve) => {
            finishAdapterOpen = resolve;
          }),
      ),
    };
    const session = new PptxViewSession(root, reader, adapter);

    const opening = session.open("stress.pptx");
    expect(root.dataset.lifecyclePhase).toBe("reading");

    finishRead?.(new ArrayBuffer(1));
    await vi.waitFor(() => expect(adapter.open).toHaveBeenCalledOnce());
    expect(root.dataset.lifecyclePhase).toBe("adapter-opening");
    expect(session.getPerformanceDiagnostics().lifecyclePhase).toBe(
      "adapter-opening",
    );

    finishAdapterOpen?.(rendererSession);
    await opening;
    expect(root.dataset.lifecyclePhase).toBe("ready");

    session.dispose();
    expect(root.dataset.lifecyclePhase).toBeUndefined();
    expect(session.getPerformanceDiagnostics().lifecyclePhase).toBe("disposed");
  });

  it("exposes adapter work diagnostics through open and disposal", async () => {
    const root = document.createElement("div");
    let finishRead: ((value: ArrayBuffer) => void) | undefined;
    const reader = {
      readBinary: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            finishRead = resolve;
          }),
      ),
    };
    const { adapter } = makeRenderer();
    const session = new PptxViewSession(root, reader, adapter);

    const opening = session.open("deck.pptx");
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      openPending: true,
      rendererActive: false,
      disposed: false,
    });
    expect(
      root.querySelector<HTMLInputElement>('[data-action="page-number"]')
        ?.disabled,
    ).toBe(true);
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="jump-to-slide"]')
        ?.disabled,
    ).toBe(true);

    finishRead?.(new ArrayBuffer(1));
    await opening;
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      openPending: false,
      rendererActive: true,
      disposed: false,
    });
    expect(
      root.querySelector<HTMLInputElement>('[data-action="page-number"]')
        ?.disabled,
    ).toBe(false);
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="jump-to-slide"]')
        ?.disabled,
    ).toBe(false);

    session.dispose();
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      openPending: false,
      rendererActive: false,
      disposed: true,
    });
  });

  it("reads once, renders slide 1, and exposes ready state", async () => {
    const root = document.createElement("div");
    const bytes = new ArrayBuffer(8);
    const reader = { readBinary: vi.fn(async () => bytes) };
    const { adapter, rendererSession } = makeRenderer(3);
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("deck.pptx");

    expect(reader.readBinary).toHaveBeenCalledOnce();
    expect(reader.readBinary).toHaveBeenCalledWith("deck.pptx");
    expect(adapter.open).toHaveBeenCalledOnce();
    expect(adapter.open).toHaveBeenCalledWith(
      bytes,
      expect.any(HTMLElement),
      expect.any(AbortSignal),
    );
    expect(rendererSession.renderSlide).toHaveBeenCalledWith(0);
    expect(root.dataset.state).toBe("ready");
    expect(root.textContent).toContain("1 / 3");
    expect(root.textContent).toContain("Obsidian PPTX smoke test");
  });

  it("exposes full-open timings and navigates with product controls", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter, rendererSession } = makeRenderer(3);
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("deck.pptx");

    expect(root.dataset.metadataMs).toMatch(/^\d/);
    expect(root.dataset.firstReadableMs).toMatch(/^\d/);
    const previous = root.querySelector<HTMLButtonElement>(
      '[data-action="previous-slide"]',
    );
    const next = root.querySelector<HTMLButtonElement>(
      '[data-action="next-slide"]',
    );
    expect(previous?.disabled).toBe(true);
    expect(next?.disabled).toBe(false);

    next?.click();

    await vi.waitFor(() =>
      expect(rendererSession.renderSlide).toHaveBeenLastCalledWith(1),
    );
    await vi.waitFor(() => expect(root.textContent).toContain("2 / 3"));
    expect(root.dataset.lastSlideSwitchMs).toMatch(/^\d/);
    expect(previous?.disabled).toBe(false);
    expect(next?.disabled).toBe(false);
  });

  it("jumps to a valid one-based slide number", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter, rendererSession } = makeRenderer(3);
    const session = new PptxViewSession(root, reader, adapter);
    await session.open("deck.pptx");

    const input = root.querySelector<HTMLInputElement>(
      '[data-action="page-number"]',
    );
    const jump = root.querySelector<HTMLButtonElement>(
      '[data-action="jump-to-slide"]',
    );
    expect(input).not.toBeNull();
    expect(jump).not.toBeNull();

    input!.value = "3";
    jump!.click();

    await vi.waitFor(() =>
      expect(rendererSession.renderSlide).toHaveBeenLastCalledWith(2),
    );
    await vi.waitFor(() => expect(root.textContent).toContain("3 / 3"));
    expect(root.dataset.state).toBe("ready");
    expect(input?.value).toBe("3");
  });

  it.each(["", "0", "4", "1.5"])(
    "rejects invalid page input %j without changing the readable slide",
    async (value) => {
      const root = document.createElement("div");
      const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
      const { adapter, rendererSession } = makeRenderer(3);
      const session = new PptxViewSession(root, reader, adapter);
      await session.open("deck.pptx");
      const input = root.querySelector<HTMLInputElement>(
        '[data-action="page-number"]',
      )!;

      input.value = value;
      root
        .querySelector<HTMLButtonElement>('[data-action="jump-to-slide"]')!
        .click();

      expect(rendererSession.renderSlide).toHaveBeenCalledTimes(1);
      expect(root.textContent).toContain("1 / 3");
      expect(root.textContent).toContain(
        "Enter a slide number from 1 to 3.",
      );
      expect(root.dataset.state).toBe("ready");
    },
  );

  it("captures slide-switch timing before updating product UI", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter } = makeRenderer(3);
    const session = new PptxViewSession(root, reader, adapter);
    const textSeenAtTimingBoundaries: string[] = [];
    const now = vi.spyOn(performance, "now").mockImplementation(() => {
      textSeenAtTimingBoundaries.push(root.textContent ?? "");
      return textSeenAtTimingBoundaries.length;
    });

    try {
      await session.open("deck.pptx");
      textSeenAtTimingBoundaries.length = 0;

      root
        .querySelector<HTMLButtonElement>('[data-action="next-slide"]')
        ?.click();

      await vi.waitFor(() =>
        expect(root.dataset.lastSlideSwitchMs).toMatch(/^\d/),
      );
      expect(textSeenAtTimingBoundaries.slice(0, 2)).toEqual([
        expect.stringContaining("1 / 3"),
        expect.stringContaining("1 / 3"),
      ]);
    } finally {
      now.mockRestore();
    }
  });

  it("disposes the renderer and clears the view", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter, rendererSession } = makeRenderer();
    const session = new PptxViewSession(root, reader, adapter);
    await session.open("deck.pptx");

    session.dispose();
    session.dispose();

    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.childElementCount).toBe(0);
    expect(root.dataset.metadataMs).toBeUndefined();
    expect(root.dataset.firstReadableMs).toBeUndefined();
    expect(root.dataset.lastSlideSwitchMs).toBeUndefined();
  });

  it("continues ordered teardown and clears the root when component disposers throw", async () => {
    const root = document.createElement("div");
    const { adapter, rendererSession } = makeM2Renderer(20);
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
    );
    await session.open("deck.pptx");
    const internals = session as unknown as {
      thumbnailRail: { dispose(): void };
      viewerController: { dispose(): void };
      backgroundQueue: { dispose(): void };
    };
    const railDispose = vi.spyOn(internals.thumbnailRail, "dispose").mockImplementation(() => {
      throw new Error("rail cleanup failed");
    });
    const controllerDispose = vi.spyOn(internals.viewerController, "dispose");
    const queueDispose = vi.spyOn(internals.backgroundQueue, "dispose");
    vi.mocked(rendererSession.dispose).mockImplementation(() => {
      throw new Error("renderer cleanup failed");
    });

    expect(() => session.dispose()).not.toThrow();

    expect(railDispose).toHaveBeenCalledOnce();
    expect(controllerDispose).toHaveBeenCalledOnce();
    expect(queueDispose).toHaveBeenCalledOnce();
    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.childElementCount).toBe(0);
    expect(root.dataset.state).toBeUndefined();
    expect(session.getPerformanceDiagnostics()).toMatchObject({
      backgroundPending: 0,
      backgroundRunning: 0,
      mountedThumbnails: 0,
      rendererActive: false,
    });
  });

  it("detaches every owned resource before a cleanup callback re-enters dispose", async () => {
    const root = document.createElement("div");
    const { adapter, rendererSession } = makeM2Renderer(20);
    let session!: PptxViewSession<string>;
    let diagnosticsDuringCleanup: ReturnType<PptxViewSession<string>["getPerformanceDiagnostics"]> | undefined;
    let reentered = false;
    const unsubscribe = vi.fn(() => {
      diagnosticsDuringCleanup = session.getPerformanceDiagnostics();
      if (!reentered) {
        reentered = true;
        session.dispose();
      }
    });
    const fullscreen = makeFullscreen();
    fullscreen.api.subscribe.mockReturnValue(unsubscribe);
    session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      { fullscreen: fullscreen.api },
    );
    await session.open("deck.pptx");
    const internals = session as unknown as {
      thumbnailRail: { dispose(): void };
      viewerController: { dispose(): void };
      backgroundQueue: { dispose(): void };
    };
    const railDispose = vi.spyOn(internals.thumbnailRail, "dispose");
    const controllerDispose = vi.spyOn(internals.viewerController, "dispose");
    const queueDispose = vi.spyOn(internals.backgroundQueue, "dispose");

    expect(() => session.dispose()).not.toThrow();

    expect(diagnosticsDuringCleanup).toMatchObject({
      backgroundPending: 0,
      backgroundRunning: 0,
      mountedThumbnails: 0,
      rendererActive: false,
    });
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(railDispose).toHaveBeenCalledOnce();
    expect(controllerDispose).toHaveBeenCalledOnce();
    expect(queueDispose).toHaveBeenCalledOnce();
    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.childElementCount).toBe(0);
    expect(root.dataset.state).toBeUndefined();
  });

  it("reports a synchronous full-screen action failure locally", async () => {
    const root = document.createElement("div");
    const { adapter } = makeM2Renderer(2);
    const fullscreen = makeFullscreen();
    fullscreen.api.enter.mockImplementation(() => {
      throw new Error("synchronous platform failure");
    });
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      { fullscreen: fullscreen.api },
    );
    await session.open("deck.pptx");

    root.querySelector<HTMLButtonElement>('[data-action="toggle-fullscreen"]')!.click();

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Unable to change full-screen mode."),
    );
    expect(root.dataset.state).toBe("ready");
    expect(root.dataset.fullscreen).toBe("false");
    expect(root.textContent).not.toContain("synchronous platform failure");
    session.dispose();
  });

  it("keeps the viewer ready when the initial full-screen state probe throws", async () => {
    const root = document.createElement("div");
    const { adapter } = makeM2Renderer(2);
    const fullscreen = makeFullscreen();
    fullscreen.api.isActive.mockImplementation(() => {
      throw new Error("initial full-screen probe failed");
    });
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      { fullscreen: fullscreen.api },
    );

    await expect(session.open("deck.pptx")).resolves.toBeUndefined();

    expect(root.dataset.state).toBe("ready");
    expect(root.dataset.fullscreen).toBe("false");
    expect(root.querySelector('[data-action="toggle-fullscreen"]')?.getAttribute("aria-label"))
      .toBe("Enter full screen");
    expect(root.textContent).not.toContain("initial full-screen probe failed");
    session.dispose();
  });

  it("isolates a throwing full-screen probe from the subscribed event", async () => {
    const root = document.createElement("div");
    const { adapter } = makeM2Renderer(2);
    const fullscreen = makeFullscreen();
    fullscreen.api.isActive
      .mockReturnValueOnce(false)
      .mockImplementation(() => {
        throw new Error("event full-screen probe failed");
      });
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      { fullscreen: fullscreen.api },
    );
    await session.open("deck.pptx");

    expect(() => {
      fullscreen.listeners.forEach((listener) => listener());
    }).not.toThrow();

    expect(root.dataset.state).toBe("ready");
    expect(root.dataset.fullscreen).toBe("false");
    expect(root.querySelector('[data-action="toggle-fullscreen"]')?.getAttribute("aria-label"))
      .toBe("Enter full screen");
    session.dispose();
  });

  it("keeps full-screen failure status stable when the recovery probe throws", async () => {
    const root = document.createElement("div");
    const { adapter } = makeM2Renderer(2);
    const fullscreen = makeFullscreen();
    fullscreen.api.isActive
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockImplementation(() => {
        throw new Error("recovery full-screen probe failed");
      });
    fullscreen.api.enter.mockRejectedValueOnce(new Error("enter failed"));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      { fullscreen: fullscreen.api },
    );
    try {
      await session.open("deck.pptx");

      root.querySelector<HTMLButtonElement>('[data-action="toggle-fullscreen"]')!.click();

      await vi.waitFor(() =>
        expect(root.textContent).toContain("Unable to change full-screen mode."),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
      expect(root.dataset.fullscreen).toBe("false");
      expect(root.querySelector('[data-action="toggle-fullscreen"]')?.getAttribute("aria-label"))
        .toBe("Enter full screen");
      expect(root.textContent).not.toContain("recovery full-screen probe failed");
    } finally {
      process.off("unhandledRejection", unhandled);
      session.dispose();
    }
  });

  it("retains the last known state without rejection when a successful toggle recovery probe throws", async () => {
    const root = document.createElement("div");
    const { adapter } = makeM2Renderer(2);
    const fullscreen = makeFullscreen();
    fullscreen.api.isActive
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockImplementation(() => {
        throw new Error("successful recovery probe failed");
      });
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
      { fullscreen: fullscreen.api },
    );
    try {
      await session.open("deck.pptx");

      root.querySelector<HTMLButtonElement>('[data-action="toggle-fullscreen"]')!.click();

      await vi.waitFor(() => expect(fullscreen.api.enter).toHaveBeenCalledOnce());
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
      expect(root.dataset.fullscreen).toBe("false");
      expect(root.querySelector('[data-action="toggle-fullscreen"]')?.getAttribute("aria-label"))
        .toBe("Enter full screen");
      expect(root.textContent).not.toContain("Unable to change full-screen mode.");
      expect(root.textContent).not.toContain("successful recovery probe failed");
    } finally {
      process.off("unhandledRejection", unhandled);
      session.dispose();
    }
  });

  it("survives a throwing previous renderer disposer while reopening", async () => {
    const root = document.createElement("div");
    const first = makeRenderer(2);
    const second = makeRenderer(2);
    vi.mocked(first.rendererSession.dispose).mockImplementation(() => {
      throw new Error("old renderer cleanup failed");
    });
    const adapter: PptxRendererAdapter = {
      open: vi.fn().mockImplementationOnce(first.adapter.open).mockImplementationOnce(second.adapter.open),
    };
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
    );
    await session.open("first.pptx");

    await expect(session.open("second.pptx")).resolves.toBeUndefined();

    expect(first.rendererSession.dispose).toHaveBeenCalledOnce();
    expect(second.rendererSession.dispose).not.toHaveBeenCalled();
    expect(root.dataset.state).toBe("ready");
    expect(root.textContent).toContain("1 / 2");
    session.dispose();
  });

  it("finishes the open-error surface when renderer cleanup throws", async () => {
    const root = document.createElement("div");
    const { adapter, rendererSession } = makeRenderer(1);
    vi.mocked(rendererSession.renderSlide).mockRejectedValueOnce(new Error("render failed"));
    vi.mocked(rendererSession.dispose).mockImplementation(() => {
      throw new Error("renderer cleanup failed");
    });
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
    );

    await expect(session.open("broken.pptx")).resolves.toBeUndefined();

    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.dataset.state).toBe("error");
    expect(root.dataset.errorCategory).toBe("incompatible");
    expect(session.getPerformanceDiagnostics().rendererActive).toBe(false);
  });

  it("keeps the mounted-thumbnail data attribute live and stale-safe", async () => {
    const root = document.createElement("div");
    const { adapter } = makeM2Renderer(200);
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
    );
    await session.open("large.pptx");
    const rail = root.querySelector<HTMLElement>('[aria-label="Slide thumbnails"]')!;
    const initial = Number(root.dataset.mountedThumbnailCount);

    Object.defineProperty(rail, "clientHeight", { configurable: true, value: 100 });
    rail.dispatchEvent(new Event("scroll"));

    expect(Number(root.dataset.mountedThumbnailCount)).toBe(
      rail.querySelectorAll('[data-action="thumbnail-slide"]').length,
    );
    expect(Number(root.dataset.mountedThumbnailCount)).not.toBe(initial);

    session.dispose();
    expect(root.dataset.mountedThumbnailCount).toBeUndefined();
    rail.dispatchEvent(new Event("scroll"));
    expect(root.dataset.mountedThumbnailCount).toBeUndefined();
  });

  it("exposes a thumbnail-ready count only after readiness and clears it on dispose", async () => {
    const root = document.createElement("div");
    const pending = new Promise<void>((resolve) => {
      (root as HTMLElement & { resolveThumbnail?: () => void }).resolveThumbnail = resolve;
    });
    const { adapter, rendererSession } = makeM2Renderer(2);
    rendererSession.renderThumbnail = vi.fn((index, container) => {
      container.textContent = `Allocated preview ${index + 1}`;
      return { ready: pending, dispose: vi.fn() };
    });
    const session = new PptxViewSession(
      root,
      { readBinary: vi.fn(async () => new ArrayBuffer(1)) },
      adapter,
    );

    await session.open("ready-signal.pptx");
    await vi.waitFor(() => expect(rendererSession.renderThumbnail).toHaveBeenCalled());
    expect(root.dataset.readyThumbnailCount).toBe("0");

    (root as HTMLElement & { resolveThumbnail?: () => void }).resolveThumbnail?.();
    await vi.waitFor(() => expect(Number(root.dataset.readyThumbnailCount)).toBeGreaterThan(0));
    expect(session.getPerformanceDiagnostics().readyThumbnails).toBeGreaterThan(0);

    session.dispose();
    expect(root.dataset.readyThumbnailCount).toBeUndefined();
    expect(session.getPerformanceDiagnostics().readyThumbnails).toBe(0);
  });

  it("disposes the previous renderer before reopening", async () => {
    const root = document.createElement("div");
    const bytes = new ArrayBuffer(1);
    let finishSecondRead: (() => void) | undefined;
    const reader = {
      readBinary: vi
        .fn()
        .mockResolvedValueOnce(bytes)
        .mockImplementationOnce(
          () =>
            new Promise<ArrayBuffer>((resolve) => {
              finishSecondRead = () => resolve(bytes);
            }),
        ),
    };
    const first = makeRenderer();
    const second = makeRenderer();
    const adapter: PptxRendererAdapter = {
      open: vi
        .fn()
        .mockImplementationOnce(first.adapter.open)
        .mockImplementationOnce(second.adapter.open),
    };
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("first.pptx");
    root.dataset.lastSlideSwitchMs = "12.345";
    const reopening = session.open("second.pptx");

    expect(first.rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.dataset.metadataMs).toBeUndefined();
    expect(root.dataset.firstReadableMs).toBeUndefined();
    expect(root.dataset.lastSlideSwitchMs).toBeUndefined();

    finishSecondRead?.();
    await reopening;

    expect(second.rendererSession.dispose).not.toHaveBeenCalled();
    expect(root.dataset.metadataMs).toMatch(/^\d/);
    expect(root.dataset.firstReadableMs).toMatch(/^\d/);
    expect(root.dataset.lastSlideSwitchMs).toBeUndefined();
  });

  it("does not apply a completed navigation after reopening", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    let finishNavigation: (() => void) | undefined;
    const first = makeRenderer(3);
    first.rendererSession.renderSlide = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishNavigation = resolve;
          }),
      );
    const second = makeRenderer(2);
    const adapter: PptxRendererAdapter = {
      open: vi
        .fn()
        .mockImplementationOnce(first.adapter.open)
        .mockImplementationOnce(second.adapter.open),
    };
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("first.pptx");
    root
      .querySelector<HTMLButtonElement>('[data-action="next-slide"]')
      ?.click();
    await vi.waitFor(() =>
      expect(first.rendererSession.renderSlide).toHaveBeenLastCalledWith(1),
    );

    await session.open("second.pptx");
    finishNavigation?.();
    await Promise.resolve();

    expect(root.textContent).toContain("1 / 2");
    expect(root.dataset.lastSlideSwitchMs).toBeUndefined();
  });

  it("reports navigation failures and restores the controls", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter, rendererSession } = makeRenderer(3);
    rendererSession.renderSlide = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("render failed"))
      .mockResolvedValueOnce(undefined);
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("deck.pptx");
    const previous = root.querySelector<HTMLButtonElement>(
      '[data-action="previous-slide"]',
    );
    const next = root.querySelector<HTMLButtonElement>(
      '[data-action="next-slide"]',
    );

    next?.click();

    await vi.waitFor(() => expect(root.dataset.state).toBe("degraded"));
    expect(root.textContent).toContain(
      "Slide 2 could not be rendered. The previous slide is still shown. Try another slide or open it in the default application.",
    );
    expect(root.textContent).toContain("Obsidian PPTX smoke test");
    expect(root.textContent).toContain("1 / 3");
    expect(
      root.querySelector<HTMLInputElement>('[data-action="page-number"]')
        ?.value,
    ).toBe("1");
    expect(root.dataset.lastSlideSwitchMs).toBeUndefined();
    expect(previous?.disabled).toBe(true);
    expect(next?.disabled).toBe(false);

    next?.click();

    await vi.waitFor(() => expect(root.textContent).toContain("2 / 3"));
    expect(root.dataset.state).toBe("ready");
    expect(root.textContent).not.toContain("Unable to render this slide.");
    expect(root.dataset.lastSlideSwitchMs).toMatch(/^\d/);
    expect(previous?.disabled).toBe(false);
    expect(next?.disabled).toBe(false);
  });

  it("ignores a rejected navigation after disposal", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    let failNavigation: ((error: Error) => void) | undefined;
    const { adapter, rendererSession } = makeRenderer(3);
    rendererSession.renderSlide = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            failNavigation = reject;
          }),
      );
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("deck.pptx");
    root
      .querySelector<HTMLButtonElement>('[data-action="next-slide"]')
      ?.click();
    await vi.waitFor(() =>
      expect(rendererSession.renderSlide).toHaveBeenLastCalledWith(1),
    );

    session.dispose();
    failNavigation?.(new Error("disposed"));
    await Promise.resolve();

    expect(root.childElementCount).toBe(0);
    expect(root.dataset.state).toBeUndefined();
    expect(root.dataset.lastSlideSwitchMs).toBeUndefined();
  });

  const errorCases = [
    ["unsupported-legacy", "Legacy PPT files are not supported."],
    ["malformed", "This PPTX is damaged or incomplete."],
    ["protected", "This PPTX is encrypted or password-protected."],
    [
      "incompatible",
      "This PPTX uses content this viewer cannot safely display.",
    ],
    [
      "resource-exhausted",
      "This PPTX is too large or complex to open within the viewer's safety limits.",
    ],
    ["cancelled", "Loading this PPTX was cancelled."],
    ["unknown", "An unexpected error prevented this PPTX from opening."],
  ] as const;

  for (const [category, message] of errorCases) {
    it(`shows a stable ${category} failure without rejecting the view load`, async () => {
      const root = document.createElement("div");
      const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
      const adapter: PptxRendererAdapter = {
        open: vi.fn(async () => {
          throw new PptxOpenError(category, "candidate-specific details");
        }),
      };
      const session = new PptxViewSession(root, reader, adapter);

      await expect(session.open("deck.pptx")).resolves.toBeUndefined();

      expect(root.dataset.state).toBe("error");
      expect(root.dataset.errorCategory).toBe(category);
      expect(root.textContent).toContain(message);
      expect(root.textContent).toContain(
        category === "unsupported-legacy"
          ? "The original file was not modified."
          : "The original PPTX file was not modified.",
      );
      expect(
        root.querySelector<HTMLButtonElement>('[data-action="retry"]'),
      ).not.toBeNull();
      expect(root.textContent).not.toContain("candidate-specific details");
    });
  }

  it("classifies an unexpected Vault read failure as unknown", async () => {
    const root = document.createElement("div");
    const reader = {
      readBinary: vi.fn(async () => {
        throw new Error("private filesystem details");
      }),
    };
    const { adapter } = makeRenderer();
    const session = new PptxViewSession(root, reader, adapter);

    await expect(session.open("deck.pptx")).resolves.toBeUndefined();

    expect(root.dataset.errorCategory).toBe("unknown");
    expect(root.textContent).not.toContain("private filesystem details");
  });

  it("retries the same file and reaches ready after a recoverable failure", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const recovered = makeRenderer(2);
    const adapter: PptxRendererAdapter = {
      open: vi
        .fn()
        .mockRejectedValueOnce(new PptxOpenError("malformed", "first failure"))
        .mockImplementationOnce(recovered.adapter.open),
    };
    const session = new PptxViewSession(root, reader, adapter);
    await session.open("deck.pptx");

    root.querySelector<HTMLButtonElement>('[data-action="retry"]')?.click();

    await vi.waitFor(() => expect(root.dataset.state).toBe("ready"));
    expect(reader.readBinary).toHaveBeenCalledTimes(2);
    expect(root.textContent).toContain("1 / 2");
    expect(root.dataset.errorCategory).toBeUndefined();
  });

  it("offers the injected default-application fallback", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const adapter: PptxRendererAdapter = {
      open: vi.fn(async () => {
        throw new PptxOpenError("protected", "protected");
      }),
    };
    const openExternally = vi.fn(async () => {});
    const session = new PptxViewSession(root, reader, adapter, {
      openExternally,
    });
    await session.open("deck.pptx");

    root
      .querySelector<HTMLButtonElement>('[data-action="open-externally"]')
      ?.click();

    await vi.waitFor(() =>
      expect(openExternally).toHaveBeenCalledWith("deck.pptx"),
    );
  });

  it("offers the default-application fallback while a deck is readable", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const { adapter } = makeRenderer(2);
    const openExternally = vi.fn(async () => {});
    const session = new PptxViewSession(root, reader, adapter, {
      openExternally,
    });
    await session.open("deck.pptx");

    root
      .querySelector<HTMLButtonElement>('[data-action="open-externally"]')
      ?.click();

    await vi.waitFor(() =>
      expect(openExternally).toHaveBeenCalledWith("deck.pptx"),
    );
    expect(root.dataset.state).toBe("ready");
  });

  it("disposes renderer resources when first-slide rendering fails", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const rendererSession: PptxRendererSession = {
      slideCount: 1,
      slideWidth: 960,
      slideHeight: 540,
      capabilities: { thumbnails: false, prefetch: false },
      renderSlide: vi.fn(async () => {
        throw new Error("renderer exploded");
      }),
      dispose: vi.fn(),
    };
    const adapter: PptxRendererAdapter = {
      open: vi.fn(async () => rendererSession),
    };
    const session = new PptxViewSession(root, reader, adapter);

    await session.open("deck.pptx");

    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.dataset.errorCategory).toBe("incompatible");
  });

  it("disposes a late renderer result after the view closes", async () => {
    const root = document.createElement("div");
    const reader = { readBinary: vi.fn(async () => new ArrayBuffer(1)) };
    const rendererSession: PptxRendererSession = {
      slideCount: 1,
      slideWidth: 960,
      slideHeight: 540,
      capabilities: { thumbnails: false, prefetch: false },
      renderSlide: vi.fn(async () => {}),
      dispose: vi.fn(() => {
        throw new Error("late candidate cleanup failed");
      }),
    };
    let resolveOpen!: (value: PptxRendererSession) => void;
    const adapter: PptxRendererAdapter = {
      open: vi.fn(
        async () =>
          new Promise<PptxRendererSession>((resolve) => {
            resolveOpen = resolve;
          }),
      ),
    };
    const session = new PptxViewSession(root, reader, adapter);
    const opening = session.open("deck.pptx");
    await vi.waitFor(() => expect(adapter.open).toHaveBeenCalledOnce());

    session.dispose();
    resolveOpen(rendererSession);
    await expect(opening).resolves.toBeUndefined();

    expect(rendererSession.dispose).toHaveBeenCalledOnce();
    expect(root.childElementCount).toBe(0);
  });
});
