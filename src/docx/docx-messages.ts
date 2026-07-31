import {
  resolveMessageLocale,
  type MessageLocale,
  type MessageParameters,
} from "../i18n";

const ENGLISH_DOCX_MESSAGES = {
  fallbackTitle: "DOCX reader",
  loading: "Loading document…",
  searchLabel: "Search document body",
  searchPlaceholder: "Search document body",
  noResults: "No matching document body text.",
  resultLabel: "Paragraph {paragraph}, matches: {matches}",
  openDefault: "Open in default application",
  openDefaultFailure: "Unable to open the default application.",
  unavailableContent:
    "Some main-body content cannot be represented here. In-flow placeholders mark every detected omission.",
  unavailablePlaceholder: "This document content cannot be displayed.",
  largeDocumentSimplified:
    "This large document is shown in a simplified reading mode.",
  blockedLink: "This document link is blocked for safety.",
  bookmarkUnavailable:
    "The internal document link target is unavailable.",
  malformed: "This DOCX is damaged or incomplete.",
  protected: "This DOCX is encrypted or password-protected.",
  incompatible: "This DOCX contains content that cannot be displayed safely.",
  resourceExhausted:
    "This DOCX is too large or complex to open within the viewer's safety limits.",
  cancelled: "Loading this DOCX was cancelled.",
  unknown: "An unexpected error prevented this DOCX from opening.",
  sourceUnmodified: "The original DOCX file was not modified.",
} as const;

export type DocxMessageKey = keyof typeof ENGLISH_DOCX_MESSAGES;
type DocxMessageCatalog = Readonly<Record<DocxMessageKey, string>>;

const SIMPLIFIED_CHINESE_DOCX_MESSAGES = {
  fallbackTitle: "DOCX 阅读器",
  loading: "正在加载文档…",
  searchLabel: "搜索文档正文",
  searchPlaceholder: "搜索文档正文",
  noResults: "未在文档正文中找到匹配内容。",
  resultLabel: "第 {paragraph} 段，{matches} 处匹配",
  openDefault: "在默认应用中打开",
  openDefaultFailure: "无法打开默认应用。",
  unavailableContent:
    "部分正文内容无法在此呈现；所有检测到的缺失位置均已显示占位提示。",
  unavailablePlaceholder: "无法显示此文档内容。",
  largeDocumentSimplified: "此大型文档正以简化阅读模式显示。",
  blockedLink: "出于安全原因，已阻止此文档链接。",
  bookmarkUnavailable: "此文档内部链接的目标不可用。",
  malformed: "此 DOCX 已损坏或不完整。",
  protected: "此 DOCX 已加密或受密码保护。",
  incompatible: "此 DOCX 包含无法安全显示的内容。",
  resourceExhausted: "此 DOCX 过大或过于复杂，超出了查看器的安全限制。",
  cancelled: "已取消加载此 DOCX。",
  unknown: "发生意外错误，无法打开此 DOCX。",
  sourceUnmodified: "原始 DOCX 文件未被修改。",
} as const satisfies DocxMessageCatalog;

const TRADITIONAL_CHINESE_DOCX_MESSAGES = {
  fallbackTitle: "DOCX 閱讀器",
  loading: "正在載入文件…",
  searchLabel: "搜尋文件正文",
  searchPlaceholder: "搜尋文件正文",
  noResults: "未在文件正文中找到相符內容。",
  resultLabel: "第 {paragraph} 段，{matches} 處相符",
  openDefault: "在預設應用程式中開啟",
  openDefaultFailure: "無法開啟預設應用程式。",
  unavailableContent:
    "部分正文內容無法在此呈現；所有偵測到的缺失位置均已顯示占位提示。",
  unavailablePlaceholder: "無法顯示此文件內容。",
  largeDocumentSimplified: "此大型文件正以簡化閱讀模式顯示。",
  blockedLink: "基於安全原因，已阻止此文件連結。",
  bookmarkUnavailable: "此文件內部連結的目標不可用。",
  malformed: "此 DOCX 已損毀或不完整。",
  protected: "此 DOCX 已加密或受密碼保護。",
  incompatible: "此 DOCX 包含無法安全顯示的內容。",
  resourceExhausted: "此 DOCX 過大或過於複雜，超出檢視器的安全限制。",
  cancelled: "已取消載入此 DOCX。",
  unknown: "發生未預期的錯誤，無法開啟此 DOCX。",
  sourceUnmodified: "原始 DOCX 檔案未經修改。",
} as const satisfies DocxMessageCatalog;

const CATALOGS: Readonly<Record<MessageLocale, DocxMessageCatalog>> = {
  en: ENGLISH_DOCX_MESSAGES,
  "zh-Hans": SIMPLIFIED_CHINESE_DOCX_MESSAGES,
  "zh-Hant": TRADITIONAL_CHINESE_DOCX_MESSAGES,
};

function interpolate(
  template: string,
  parameters: MessageParameters = {},
): string {
  return template.replace(/\{([a-z][a-zA-Z0-9]*)\}/g, (placeholder, name) => {
    const value: string | number | undefined = parameters[name];
    return value === undefined ? placeholder : String(value);
  });
}

export interface DocxMessageTranslator {
  readonly locale: MessageLocale;
  text(key: DocxMessageKey, parameters?: MessageParameters): string;
}

export function createDocxMessageTranslator(
  language: string,
): DocxMessageTranslator {
  const locale = resolveMessageLocale(language);
  const catalog = CATALOGS[locale];
  return {
    locale,
    text: (key, parameters) => interpolate(catalog[key], parameters),
  };
}
