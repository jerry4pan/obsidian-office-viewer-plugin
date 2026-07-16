export type MessageLocale = "en" | "zh-Hans" | "zh-Hant";

const ENGLISH_MESSAGES = {
  "viewer.empty": "Open a PPTX file from your Vault to start reading.",
  "viewer.loading": "Loading presentation…",
  "viewer.fallbackTitle": "PPTX viewer",
  "navigation.previous": "Previous",
  "navigation.next": "Next",
  "navigation.slideNumber": "Slide number",
  "navigation.pageTotalPending": "of …",
  "navigation.go": "Go",
  "navigation.slide": "Slide",
  "navigation.invalidPage": "Enter a slide number from 1 to {total}.",
  "navigation.renderFailure":
    "Slide {slide} could not be rendered. The previous slide is still shown. Try another slide or open it in the default application.",
  "page.counter": "{current} / {total}",
  "page.total": "of {total}",
  "thumbnails.toggle": "Thumbnails",
  "thumbnails.toggleLabel": "Toggle slide thumbnails",
  "thumbnails.railLabel": "Slide thumbnails",
  "thumbnails.slideLabel": "Slide {slide}",
  "thumbnails.previewUnavailable": "Slide {slide} preview unavailable",
  "thumbnails.resizeLabel": "Resize slide thumbnails",
  "thumbnails.resizeTitle":
    "Drag to resize thumbnails; double-click to reset",
  "thumbnails.resizeValue": "{pixels} pixels",
  "fullscreen.button": "Full screen",
  "fullscreen.enterLabel": "Enter full screen",
  "fullscreen.exit": "Exit full screen",
  "fullscreen.failure": "Unable to change full-screen mode.",
  "external.open": "Open in default application",
  "external.failure": "Unable to open the default application.",
  "compatibility.unsupportedContent":
    "Some presentation content may not render correctly. Compare with the default application when accuracy matters.",
  "compatibility.fontSubstitution":
    "One or more presentation fonts are unavailable and may be substituted, which can change the layout.",
  "diagnostics.copy": "Copy diagnostic summary",
  "diagnostics.copied": "Diagnostic summary copied.",
  "diagnostics.copyFailure": "Unable to copy the diagnostic summary.",
  "error.unsupportedLegacy":
    "Legacy PPT files are not supported. Open this file in the default application.",
  "error.malformed": "This PPTX is damaged or incomplete.",
  "error.protected": "This PPTX is encrypted or password-protected.",
  "error.incompatible":
    "This PPTX uses content this viewer cannot safely display.",
  "error.resourceExhausted":
    "This PPTX is too large or complex to open within the viewer's safety limits.",
  "error.cancelled": "Loading this PPTX was cancelled.",
  "error.unknown": "An unexpected error prevented this PPTX from opening.",
  "error.sourceUnmodified": "The original PPTX file was not modified.",
  "error.sourceUnmodifiedLegacy": "The original file was not modified.",
  "error.retry": "Retry",
  "settings.rememberPosition": "Remember reading position",
  "settings.rememberPositionDescription":
    "Store only the last slide number and a local file-change fingerprint.",
  "settings.localProcessing": "Local processing and privacy",
  "settings.localProcessingDescription":
    "Presentation bytes stay on this device. Office Viewer does not upload files or include telemetry.",
  "settings.compatibility": "Compatibility and safety",
  "settings.compatibilityDescription":
    "Rendering is a read-only preview. Unsupported or potentially inaccurate content is identified when known, and the original file is never modified.",
  "settings.diagnostics": "Diagnostic summary",
  "settings.diagnosticsDescription":
    "The copied summary includes versions, file size, slide count, timings, and stable categories. It excludes filenames, paths, slide text, images, and author metadata.",
} as const;

export type MessageKey = keyof typeof ENGLISH_MESSAGES;
export type MessageCatalog = Readonly<Record<MessageKey, string>>;
export type MessageParameters = Readonly<Record<string, string | number>>;

const SIMPLIFIED_CHINESE_MESSAGES = {
  "viewer.empty": "从仓库中打开 PPTX 文件即可开始阅读。",
  "viewer.loading": "正在加载演示文稿…",
  "viewer.fallbackTitle": "PPTX 查看器",
  "navigation.previous": "上一页",
  "navigation.next": "下一页",
  "navigation.slideNumber": "幻灯片编号",
  "navigation.pageTotalPending": "共 … 页",
  "navigation.go": "跳转",
  "navigation.slide": "幻灯片",
  "navigation.invalidPage": "请输入 1 到 {total} 之间的幻灯片编号。",
  "navigation.renderFailure":
    "无法渲染第 {slide} 张幻灯片。仍显示上一张幻灯片。请尝试其他幻灯片，或使用默认应用打开。",
  "page.counter": "{current} / {total}",
  "page.total": "共 {total} 页",
  "thumbnails.toggle": "缩略图",
  "thumbnails.toggleLabel": "切换幻灯片缩略图",
  "thumbnails.railLabel": "幻灯片缩略图",
  "thumbnails.slideLabel": "第 {slide} 张幻灯片",
  "thumbnails.previewUnavailable": "第 {slide} 张幻灯片的预览不可用",
  "thumbnails.resizeLabel": "调整幻灯片缩略图大小",
  "thumbnails.resizeTitle": "拖动以调整缩略图大小；双击以重置",
  "thumbnails.resizeValue": "{pixels} 像素",
  "fullscreen.button": "全屏",
  "fullscreen.enterLabel": "进入全屏",
  "fullscreen.exit": "退出全屏",
  "fullscreen.failure": "无法切换全屏模式。",
  "external.open": "在默认应用中打开",
  "external.failure": "无法打开默认应用。",
  "compatibility.unsupportedContent":
    "部分演示文稿内容可能无法正确显示。需要确认准确性时，请与默认应用中的效果进行比较。",
  "compatibility.fontSubstitution":
    "一个或多个演示文稿字体不可用，可能会被替换并导致版式变化。",
  "diagnostics.copy": "复制诊断摘要",
  "diagnostics.copied": "已复制诊断摘要。",
  "diagnostics.copyFailure": "无法复制诊断摘要。",
  "error.unsupportedLegacy": "不支持旧版 PPT 文件。请在默认应用中打开此文件。",
  "error.malformed": "此 PPTX 已损坏或不完整。",
  "error.protected": "此 PPTX 已加密或受密码保护。",
  "error.incompatible": "此 PPTX 包含此查看器无法安全显示的内容。",
  "error.resourceExhausted":
    "此 PPTX 过大或过于复杂，超出了查看器的安全限制。",
  "error.cancelled": "已取消加载此 PPTX。",
  "error.unknown": "发生意外错误，无法打开此 PPTX。",
  "error.sourceUnmodified": "原始 PPTX 文件未被修改。",
  "error.sourceUnmodifiedLegacy": "原始文件未被修改。",
  "error.retry": "重试",
  "settings.rememberPosition": "记住阅读位置",
  "settings.rememberPositionDescription":
    "仅存储上次阅读的幻灯片编号和用于检测本地文件更改的信息。",
  "settings.localProcessing": "本地处理与隐私",
  "settings.localProcessingDescription":
    "演示文稿数据始终保留在此设备上。Office Viewer 不会上传文件，也不包含遥测。",
  "settings.compatibility": "兼容性与安全",
  "settings.compatibilityDescription":
    "渲染结果是只读预览。已知的不支持或可能不准确的内容会显示提示，原始文件始终不会被修改。",
  "settings.diagnostics": "诊断摘要",
  "settings.diagnosticsDescription":
    "复制的摘要包含版本、文件大小、幻灯片数量、耗时和稳定分类，不包含文件名、路径、幻灯片文本、图像或作者元数据。",
} as const satisfies MessageCatalog;

const TRADITIONAL_CHINESE_MESSAGES = {
  "viewer.empty": "從儲存庫開啟 PPTX 檔案即可開始閱讀。",
  "viewer.loading": "正在載入簡報…",
  "viewer.fallbackTitle": "PPTX 檢視器",
  "navigation.previous": "上一頁",
  "navigation.next": "下一頁",
  "navigation.slideNumber": "投影片編號",
  "navigation.pageTotalPending": "共 … 頁",
  "navigation.go": "跳至",
  "navigation.slide": "投影片",
  "navigation.invalidPage": "請輸入 1 到 {total} 之間的投影片編號。",
  "navigation.renderFailure":
    "無法呈現第 {slide} 張投影片。仍顯示上一張投影片。請嘗試其他投影片，或使用預設應用程式開啟。",
  "page.counter": "{current} / {total}",
  "page.total": "共 {total} 頁",
  "thumbnails.toggle": "縮圖",
  "thumbnails.toggleLabel": "切換投影片縮圖",
  "thumbnails.railLabel": "投影片縮圖",
  "thumbnails.slideLabel": "第 {slide} 張投影片",
  "thumbnails.previewUnavailable": "第 {slide} 張投影片的預覽無法使用",
  "thumbnails.resizeLabel": "調整投影片縮圖大小",
  "thumbnails.resizeTitle": "拖曳以調整縮圖大小；按兩下以重設",
  "thumbnails.resizeValue": "{pixels} 像素",
  "fullscreen.button": "全螢幕",
  "fullscreen.enterLabel": "進入全螢幕",
  "fullscreen.exit": "結束全螢幕",
  "fullscreen.failure": "無法切換全螢幕模式。",
  "external.open": "在預設應用程式中開啟",
  "external.failure": "無法開啟預設應用程式。",
  "compatibility.unsupportedContent":
    "部分簡報內容可能無法正確顯示。需要確認準確性時，請與預設應用程式中的效果進行比較。",
  "compatibility.fontSubstitution":
    "一個或多個簡報字型無法使用，可能會被替代並導致版面配置變化。",
  "diagnostics.copy": "複製診斷摘要",
  "diagnostics.copied": "已複製診斷摘要。",
  "diagnostics.copyFailure": "無法複製診斷摘要。",
  "error.unsupportedLegacy": "不支援舊版 PPT 檔案。請在預設應用程式中開啟此檔案。",
  "error.malformed": "此 PPTX 已損毀或不完整。",
  "error.protected": "此 PPTX 已加密或受密碼保護。",
  "error.incompatible": "此 PPTX 包含此檢視器無法安全顯示的內容。",
  "error.resourceExhausted":
    "此 PPTX 過大或過於複雜，超出檢視器的安全限制。",
  "error.cancelled": "已取消載入此 PPTX。",
  "error.unknown": "發生未預期的錯誤，無法開啟此 PPTX。",
  "error.sourceUnmodified": "原始 PPTX 檔案未經修改。",
  "error.sourceUnmodifiedLegacy": "原始檔案未經修改。",
  "error.retry": "重試",
  "settings.rememberPosition": "記住閱讀位置",
  "settings.rememberPositionDescription":
    "僅儲存上次閱讀的投影片編號，以及用於偵測本機檔案變更的資訊。",
  "settings.localProcessing": "本機處理與隱私",
  "settings.localProcessingDescription":
    "簡報資料始終保留在此裝置上。Office Viewer 不會上傳檔案，也不包含遙測。",
  "settings.compatibility": "相容性與安全",
  "settings.compatibilityDescription":
    "呈現結果是唯讀預覽。已知不支援或可能不準確的內容會顯示提示，原始檔案始終不會被修改。",
  "settings.diagnostics": "診斷摘要",
  "settings.diagnosticsDescription":
    "複製的摘要包含版本、檔案大小、投影片數量、耗時和穩定分類，不包含檔名、路徑、投影片文字、影像或作者中繼資料。",
} as const satisfies MessageCatalog;

export const MESSAGE_CATALOGS: Readonly<
  Record<MessageLocale, MessageCatalog>
> = {
  en: ENGLISH_MESSAGES,
  "zh-Hans": SIMPLIFIED_CHINESE_MESSAGES,
  "zh-Hant": TRADITIONAL_CHINESE_MESSAGES,
};

export interface MessageTranslator {
  readonly locale: MessageLocale;
  text(key: MessageKey, parameters?: MessageParameters): string;
}

const SIMPLIFIED_CHINESE_REGIONS = new Set(["cn", "sg"]);
const TRADITIONAL_CHINESE_REGIONS = new Set(["tw", "hk", "mo"]);

export function resolveMessageLocale(language: string): MessageLocale {
  const normalized = language.trim().replaceAll("_", "-").toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) return "en";

  const [languageCode, ...subtags] = normalized.split("-");
  if (languageCode === "en") return "en";
  if (languageCode !== "zh") return "en";

  if (
    subtags.includes("hant") ||
    subtags.some((subtag) => TRADITIONAL_CHINESE_REGIONS.has(subtag))
  ) return "zh-Hant";

  if (
    subtags.length === 0 ||
    subtags.includes("hans") ||
    subtags.some((subtag) => SIMPLIFIED_CHINESE_REGIONS.has(subtag))
  ) return "zh-Hans";

  return "en";
}

function interpolate(
  template: string,
  parameters: MessageParameters = {},
): string {
  return template.replace(/\{([a-z][a-zA-Z0-9]*)\}/g, (placeholder, name) => {
    const key = name as keyof MessageParameters;
    const value: string | number | undefined = parameters[key];
    return value === undefined ? placeholder : String(value);
  });
}

export function createMessageTranslator(
  language: string,
  catalogOverride?: Partial<MessageCatalog>,
): MessageTranslator {
  const locale = resolveMessageLocale(language);
  const selectedCatalog = catalogOverride ?? MESSAGE_CATALOGS[locale];
  return {
    locale,
    text: (key, parameters) => {
      const selectedMessage = selectedCatalog[key];
      const template = selectedMessage?.trim()
        ? selectedMessage
        : ENGLISH_MESSAGES[key];
      return interpolate(template, parameters);
    },
  };
}

export const ENGLISH_MESSAGE_TRANSLATOR = createMessageTranslator("en");
