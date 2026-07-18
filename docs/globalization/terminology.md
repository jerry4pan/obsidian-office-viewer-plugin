# Multilingual UI Terminology

- Status: Approved by human review in GitHub Issue #20
- Reviewed revision: `5593a6a`
- Reviewer: `@jerry4pan` (proficient in Simplified and Traditional Chinese)
- Approved: 2026-07-15
- Additional reference/embed terminology approval: `@jerry4pan`, 2026-07-18,
  retained in pull request #29
- Source locale: English
- Target catalogs: Simplified Chinese and region-neutral Traditional Chinese

Use this table for plugin-owned user-facing messages. Obsidian-owned terms
follow the upstream
[Obsidian translations](https://github.com/obsidianmd/obsidian-translations);
the remaining terms are Office Viewer translation decisions approved by the
human review recorded in Issue #20.

## Protected identifiers

These identifiers do not change between message locales:

| English | Simplified Chinese | Traditional Chinese |
| --- | --- | --- |
| Obsidian | Obsidian | Obsidian |
| Office Viewer | Office Viewer | Office Viewer |
| PPTX | PPTX | PPTX |

## Interface terms

| English source term | Simplified Chinese | Traditional Chinese | Authority |
| --- | --- | --- | --- |
| Vault | 仓库 | 儲存庫 | Obsidian upstream |
| Open in default application | 在默认应用中打开 | 在預設應用程式中開啟 | Obsidian upstream |
| Full screen | 全屏 | 全螢幕 | Obsidian upstream |
| Slide | 幻灯片 | 投影片 | Office Viewer, approved in #20 |
| Thumbnail | 缩略图 | 縮圖 | Office Viewer, approved in #20 |
| Viewer | 查看器 | 檢視器 | Office Viewer, approved in #20 |
| Remember reading position | 记住阅读位置 | 記住閱讀位置 | Office Viewer, approved in #20 |
| Retry | 重试 | 重試 | Office Viewer, approved in #20 |

## Reference and embed terminology

The reference/embed exploration introduced the following catalog terms after
the review recorded in Issue #20. Their catalog values and automated locale
coverage are complete, and `@jerry4pan` explicitly approved all three language
mappings for pull request #29 on 2026-07-18.

| English source term | Simplified Chinese | Traditional Chinese | Authority |
| --- | --- | --- | --- |
| Slide reference | 幻灯片引用 | 投影片引用 | Office Viewer, approved in #29 |
| Slide embed | 幻灯片嵌入 | 投影片嵌入 | Office Viewer, approved in #29 |
| Open presentation | 打开演示文稿 | 開啟簡報 | Office Viewer, approved in #29 |

## Review rules

- Prefer natural sentence structure over word-for-word translation.
- Keep named placeholders unchanged, including braces.
- Apply an approved terminology correction to visible text, tooltips, status
  messages, and accessible text together.
- Mark a Chinese catalog supported only after its review record identifies the
  reviewer, reviewed revision, and explicit approval. Issue #20 is the review
  record for this first release.
