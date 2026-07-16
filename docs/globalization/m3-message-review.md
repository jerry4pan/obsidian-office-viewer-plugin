# M3 and Post-release Message Review Record

- Status: Pending human approval
- Source revisions: final M3 branch diff from `f4b5440` plus the 2026-07-16
  post-release alignment change
- Catalogs: Simplified Chinese (`zh-Hans`) and Traditional Chinese (`zh-Hant`)

## Review scope

Human reviewers must compare the English source and both Chinese values in
`src/i18n.ts` for these M3 keys:

- `compatibility.unsupportedContent`
- `compatibility.fontSubstitution`
- `diagnostics.copy`
- `diagnostics.copied`
- `diagnostics.copyFailure`
- `error.unsupportedLegacy`
- `error.resourceExhausted`
- `error.cancelled`
- `error.sourceUnmodifiedLegacy`
- `settings.localProcessing`
- `settings.localProcessingDescription`
- `settings.compatibility`
- `settings.compatibilityDescription`
- `settings.diagnostics`
- `settings.diagnosticsDescription`

The post-release alignment changes the last two descriptions above. Reviewers
must approve these exact source/translation pairs in addition to the original
M3 scope:

| Key | English source | Simplified Chinese | Traditional Chinese |
| --- | --- | --- | --- |
| `settings.compatibilityDescription` | Rendering is a read-only preview. Blocking errors always stay visible. Detectable non-blocking compatibility warnings and the diagnostic copy control appear only when Diagnostic summary is enabled. | 渲染结果是只读预览。阻断性错误始终可见。可检测的非阻断兼容性提示和诊断复制入口仅在开启诊断摘要后显示。 | 呈現結果是唯讀預覽。阻斷性錯誤始終可見。可偵測的非阻斷相容性提示和診斷複製入口僅在開啟診斷摘要後顯示。 |
| `settings.diagnosticsDescription` | Off by default. When enabled, detectable compatibility warnings and the copy control appear the next time you open, retry, or reload a file. The copied summary includes versions, file size, slide count, timings, and stable categories. It excludes filenames, paths, slide text, images, and author metadata. | 默认关闭。开启后，下一次打开、重试或重新加载文件时会显示可检测的兼容性提示和复制入口。复制的摘要包含版本、文件大小、幻灯片数量、耗时和稳定分类，不包含文件名、路径、幻灯片文本、图像或作者元数据。 | 預設關閉。開啟後，下一次開啟、重試或重新載入檔案時會顯示可偵測的相容性提示和複製入口。複製的摘要包含版本、檔案大小、投影片數量、耗時和穩定分類，不包含檔名、路徑、投影片文字、影像或作者中繼資料。 |

Automated catalog completeness, placeholder checks, three-locale DOM coverage,
and installed locale smoke tests do not replace the approvals below.

## Approval

- [ ] Simplified Chinese reviewed by a proficient human; reviewer, date, and
  reviewed commit recorded here or in the linked GitHub review.
- [ ] Traditional Chinese reviewed by a proficient human; reviewer, date, and
  reviewed commit recorded here or in the linked GitHub review.

M3 release readiness remains pending until both boxes have durable evidence.
