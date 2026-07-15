# Multilingual UI Terminology

- Status: Draft pending human review in GitHub Issue #20
- Source locale: English
- Target catalogs: Simplified Chinese and region-neutral Traditional Chinese

Use this table for plugin-owned user-facing messages. Obsidian-owned terms
follow the upstream
[Obsidian translations](https://github.com/obsidianmd/obsidian-translations);
the remaining terms are Office Viewer translation decisions that require the
human approvals recorded in Issue #20.

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
| Slide | 幻灯片 | 投影片 | Office Viewer draft |
| Thumbnail | 缩略图 | 縮圖 | Office Viewer draft |
| Viewer | 查看器 | 檢視器 | Office Viewer draft |
| Remember reading position | 记住阅读位置 | 記住閱讀位置 | Office Viewer draft |
| Retry | 重试 | 重試 | Office Viewer draft |

## Review rules

- Prefer natural sentence structure over word-for-word translation.
- Keep named placeholders unchanged, including braces.
- Apply an approved terminology correction to visible text, tooltips, status
  messages, and accessible text together.
- Do not mark either Chinese catalog supported until Issue #20 records the
  reviewer, reviewed revision, and explicit approval.
