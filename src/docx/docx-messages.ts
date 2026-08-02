import {
  resolveMessageLocale,
  type MessageLocale,
  type MessageParameters,
} from "../i18n";

const ENGLISH_DOCX_MESSAGES = {
  fallbackTitle: "DOCX reader",
  loading: "Loading document…",
  searchOpen: "Search document body",
  searchClose: "Close document search",
  searchLabel: "Search document body",
  searchPlaceholder: "Search document body",
  resultsLabel: "Matching paragraphs",
  resultCount: "Matching paragraphs: {count}",
  resultRange: "Showing {start}–{end} of {count}",
  previousResults: "Previous search results",
  nextResults: "Next search results",
  noResults: "No matching document body text.",
  resultLabel: "Paragraph {paragraph}, matches: {matches}",
  paragraph: "Paragraph {paragraph}",
  matchCount: "Matches: {count}",
  openDefault: "Open in default application",
  openDefaultFailure: "Unable to open the default application.",
  retry: "Retry",
  viewModeLabel: "Document view",
  readingView: "Reading view",
  layoutView: "Layout view",
  layoutViewUnavailable:
    "Layout view is unavailable for this document. Use reading view or open the file in the default application.",
  viewModeSwitchFailed:
    "Unable to switch document view. The previous view remains available.",
  unavailableContent:
    "Some main-body content cannot be represented here. In-flow placeholders mark every detected omission.",
  unavailablePlaceholder: "This document content cannot be displayed.",
  largeDocumentSimplified:
    "This large document is shown in a simplified reading mode.",
  mappingDegraded:
    "Some paragraphs could not be linked for search navigation; the document remains readable.",
  previewUnavailableSimplified:
    "Rich preview was unavailable, so this document is shown in a simplified reading mode.",
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
  searchOpen: "搜索文档正文",
  searchClose: "关闭文档搜索",
  searchLabel: "搜索文档正文",
  searchPlaceholder: "搜索文档正文",
  resultsLabel: "匹配段落",
  resultCount: "找到 {count} 段",
  resultRange: "显示第 {start}–{end} 项，共 {count} 项",
  previousResults: "上一组搜索结果",
  nextResults: "下一组搜索结果",
  noResults: "未在文档正文中找到匹配内容。",
  resultLabel: "第 {paragraph} 段，{matches} 处匹配",
  paragraph: "第 {paragraph} 段",
  matchCount: "{count} 处匹配",
  openDefault: "在默认应用中打开",
  openDefaultFailure: "无法打开默认应用。",
  retry: "重试",
  viewModeLabel: "文档视图",
  readingView: "阅读视图",
  layoutView: "版式视图",
  layoutViewUnavailable:
    "此文档无法使用版式视图。请继续使用阅读视图，或在默认应用中打开文件。",
  viewModeSwitchFailed: "无法切换文档视图，仍保留先前视图。",
  unavailableContent:
    "部分正文内容无法在此呈现；所有检测到的缺失位置均已显示占位提示。",
  unavailablePlaceholder: "无法显示此文档内容。",
  largeDocumentSimplified: "此大型文档正以简化阅读模式显示。",
  mappingDegraded: "部分段落无法关联到搜索定位，但文档仍可阅读。",
  previewUnavailableSimplified:
    "富文本预览不可用，此文档正以简化阅读模式显示。",
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
  searchOpen: "搜尋文件正文",
  searchClose: "關閉文件搜尋",
  searchLabel: "搜尋文件正文",
  searchPlaceholder: "搜尋文件正文",
  resultsLabel: "相符段落",
  resultCount: "找到 {count} 段",
  resultRange: "顯示第 {start}–{end} 項，共 {count} 項",
  previousResults: "上一組搜尋結果",
  nextResults: "下一組搜尋結果",
  noResults: "未在文件正文中找到相符內容。",
  resultLabel: "第 {paragraph} 段，{matches} 處相符",
  paragraph: "第 {paragraph} 段",
  matchCount: "{count} 處相符",
  openDefault: "在預設應用程式中開啟",
  openDefaultFailure: "無法開啟預設應用程式。",
  retry: "重試",
  viewModeLabel: "文件檢視",
  readingView: "閱讀檢視",
  layoutView: "版面配置檢視",
  layoutViewUnavailable:
    "此文件無法使用版面配置檢視。請繼續使用閱讀檢視，或在預設應用程式中開啟檔案。",
  viewModeSwitchFailed: "無法切換文件檢視，仍保留先前檢視。",
  unavailableContent:
    "部分正文內容無法在此呈現；所有偵測到的缺失位置均已顯示占位提示。",
  unavailablePlaceholder: "無法顯示此文件內容。",
  largeDocumentSimplified: "此大型文件正以簡化閱讀模式顯示。",
  mappingDegraded: "部分段落無法關聯到搜尋定位，但文件仍可閱讀。",
  previewUnavailableSimplified:
    "豐富預覽不可用，此文件正以簡化閱讀模式顯示。",
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
