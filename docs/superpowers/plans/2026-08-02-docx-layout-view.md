# DOCX 版式视图建设实施规格

- 状态：Ready for implementation
- 日期：2026-08-02
- 面向：接手实现的 AI/工程师
- 基线：`main` at `0808fb9`，包含最新 DOCX 响应式阅读改动

## 1. 执行摘要

在现有默认 **DOCX reading view** 之外，增加一个用户显式选择的
**DOCX layout view（DOCX 版式视图）**。它以纵向页面栈展示可安全表示的正文，
保留源文档声明的纸张尺寸、页边距、节方向、显式分页符和保存时分页标记。
阅读视图继续作为每次打开文件的默认视图。

这不是 Word 打印预览。固定依赖 `docx-preview@0.3.6` 不会实时执行 Word 的分页
算法，只能依据显式分页、`w:lastRenderedPageBreak` 和节变化近似分页面。因此产品
界面和文档均不得使用“精准分页”“打印一致”或“像 Word 一样”等表述。

实施必须守住：

1. 本地、只读、零网络，源 DOCX 字节不变。
2. 搜索仍由项目自有 `DocxSemanticModel` 提供。
3. 阅读视图现有的响应式图片、表格和自适应留白保持不变。
4. 5,000 段压力文档继续使用 bounded semantic renderer，DOM 上限不回退。
5. 模式切换失败保留原视图，不把整个文件切入阻断性错误状态。
6. 同一时间只保留一套 renderer DOM，不缓存两种模式的两棵树。

## 2. 开始前必须读取

- `AGENTS.md`
- `CONTEXT.md`
- `docs/adr/0003-separate-docx-semantics-from-rendering.md`
- `docs/adr/0005-limit-first-docx-release-to-reading-and-search.md`
- `docs/prd/docx-reading-search-release.md`
- `docs/compatibility/docx-preview-0.3.6.md`
- `src/docx/docx-file-view.ts`
- `src/docx/renderer/docx-renderer-adapter.ts`
- `src/docx/renderer/docx-preview-renderer-adapter.ts`
- `src/docx/renderer/bounded-docx-renderer-adapter.ts`
- `styles.css` 中完整 DOCX 区域

开始时运行：

```bash
git status --short
git diff --check
npm run build
npx vitest run tests/docx/docx-renderer-adapters.test.ts \
  tests/docx/bounded-docx-renderer-adapter.test.ts \
  tests/docx/docx-file-view.test.ts
```

当前代码基线已有以下响应式实现，实施者不得覆盖或回退：

- `src/docx/renderer/docx-preview-renderer-adapter.ts`
- `src/docx/renderer/docx-renderer-adapter.ts`
- `styles.css`
- `tests/docx/docx-renderer-adapters.test.ts`

这些改动增加了阅读视图的自适应页边距、图片缩放和宽表格列宽归一化。版式视图
必须通过模式作用域避开这些 reflow 规则，而不是删除它们。

## 3. 产品定义

### 3.1 领域术语

在 `CONTEXT.md` 增加：

> **DOCX layout view**：一种本地、只读、按页面分组的 DOCX 正文表示。它保留
> 源文档声明的纸张尺寸、页边距、节方向、显式分页符和可用的保存时分页标记，
> 用于理解页面组织和版面关系。它不重新实现 Microsoft Word 排版引擎，不承诺
> 实时分页、页码准确性、打印一致性或像素级格式等价。

界面术语：

| English | 简体中文 | 繁體中文 |
| --- | --- | --- |
| Reading view | 阅读视图 | 閱讀檢視 |
| Layout view | 版式视图 | 版面配置檢視 |
| Document view | 文档视图 | 文件檢視 |

繁体中文最终必须按仓库的人工语言审阅流程确认。

### 3.2 用户体验

- 文件首次打开固定进入阅读视图，不持久化上次模式。
- toolbar primary 在搜索按钮前增加二选一模式组：
  - `data-action="docx-view-mode-reading"`
  - `data-action="docx-view-mode-layout"`
- 模式组使用 `role="group"` 和本地化 `aria-label`，两个按钮使用
  `aria-pressed` 表示实际生效模式。
- root 始终设置 `data-view-mode="reading|layout"`。
- 切换期间设置 `data-view-mode-switching="true"`，禁用模式按钮并保留旧 DOM。
- 搜索面板、query、results 和 active paragraph 在切换后保留。
- 切换后优先恢复 active paragraph；没有 active 时恢复切换前最靠近 viewport
  顶部的 mapped paragraph。
- 版式视图是连续滚动页面栈，不增加页码、翻页和手动缩放控件。
- 窄窗口先自动缩小页面；到最低可读比例后允许 reading body 自身横向滚动。
- 大文档/simplified renderer 不支持版式时禁用按钮并解释原因。
- “在默认应用中打开”始终保留为精确版式兜底。

### 3.3 本期不做

- Word 实时分页、精确页码或像素级打印一致性。
- 编辑、批注、修订审阅、打印、PDF 转换、页面缩略图。
- headers、footers、footnotes、endnotes、comments、text boxes 的新语义支持。
- 大于 bounded threshold 的文档版式渲染。
- 模式偏好持久化或跨文件继承。
- 新 renderer、云端转换、LibreOffice/Word 自动化。

## 4. Renderer 事实与配置

阅读视图保持当前 profile：

```ts
ignoreWidth: true,
ignoreHeight: true,
breakPages: false,
ignoreLastRenderedPageBreak: true,
renderHeaders: false,
renderFooters: false,
renderFootnotes: false,
renderEndnotes: false,
```

版式视图 profile：

```ts
ignoreWidth: false,
ignoreHeight: false,
breakPages: true,
ignoreLastRenderedPageBreak: false,
renderHeaders: false,
renderFooters: false,
renderFootnotes: false,
renderEndnotes: false,
```

其余安全选项保持当前值，特别是 `useBase64URL: true`、
`renderChanges: false`、`renderComments: false`、`renderAltChunks: false`。

不要调用或持久化 `parseAsync` 返回的内部 `WordDocument`。依赖文档只承诺
`renderAsync` 稳定；模式切换允许重新渲染。

renderer 创建的 `section.docx` 仅表示现有 break evidence。缺少保存时分页标记的
长文档可能只有一张很高的 page；产品不得把 section 数显示为权威总页数。

正文语义仍然唯一权威。版式视图不改变 `inspectDocxPackage`、`searchDocxBody`、
hyperlink/bookmark 安全策略、unavailable-content 检测或 paragraph ordinal。
辅助 stories 本期不渲染，避免绕过项目自有 semantic inspection。

## 5. 模块与 seam 设计

### 5.1 Renderer seam

在 `src/docx/renderer/docx-renderer-adapter.ts` 定义：

```ts
export type DocxViewMode = "reading" | "layout";

export interface DocxRendererOpenOptions {
  readonly mode: DocxViewMode;
  readonly signal: AbortSignal;
}

export interface DocxRendererSession {
  readonly candidate: DocxRendererCandidate;
  readonly mode: DocxViewMode;
  readonly supportedModes: readonly DocxViewMode[];
  readonly paragraphAnchors: ReadonlyMap<number, HTMLElement>;
  readonly warnings: readonly string[];
  readonly managesUnavailableContent?: boolean;
  mount(container: HTMLElement): void;
  revealParagraph(ordinal: number, textHint?: string): HTMLElement | null;
  dispose(): void;
}

export interface DocxRendererAdapter {
  open(
    buffer: ArrayBuffer,
    model: DocxSemanticModel,
    options: DocxRendererOpenOptions,
  ): Promise<DocxRendererSession>;
}
```

接口 invariant：

- `mode` 是实际模式；`supportedModes` 是该 session 对当前文档确定支持的模式。
- `paragraphAnchors` 每个 semantic paragraph 一个代表元素，但不承诺只有一个 DOM
  fragment。
- 同一 semantic paragraph 的全部 fragments 设置相同
  `data-docx-paragraph-ordinal`。
- `revealParagraph` 优先选择包含 `textHint` 的 fragment，否则回退 anchor。
- `open` 只产生 unmounted session，不接触产品当前 reading body；`mount` 最多调用
  一次，原子替换目标 container 并开始 scroll/resize observers。
- `revealParagraph` 只在 mount 后调用；mount 前调用必须安全返回 `null`。
- `dispose` 释放 DOM、listeners、ResizeObserver 和内部引用。
- session 拥有自己的 renderer root；`dispose()` 在 mount 前后都必须幂等。

这条 seam 有两个真实行为：rich preview 支持 reading/layout，bounded semantic 只
支持 reading。不要为 render profile 再增加浅 adapter；第三方选项、分页 DOM 和
页面缩放留在 `DocxPreviewRendererAdapter` implementation 内。

### 5.2 跨页 paragraph fragment mapping

开启 `breakPages` 后，一个 semantic paragraph 可能被 renderer 拆到两个页面。
现有“一段对应一个 `<p>`”映射会失败，必须先深化 mapping，不能关闭校验绕过。

把现有 mapping 改成 paragraph-anchor mapping：

1. 按文档顺序取得 main-body leaf paragraph elements。
2. 对每个 semantic paragraph 累积一个或多个连续 rendered fragments。
3. 只有 fragments 的 comparable text 拼接后与 semantic text 完全相等才绑定。
4. 累积文本不再是 semantic text 前缀时立即失败，不得跳跃、模糊匹配或猜测。
5. ordinal 标到所有 fragments，anchor 保存第一个 fragment。
6. semantic paragraphs 用尽后仍有 main-body paragraph 时失败。
7. fallback alignment 同样只能保序、精确字符匹配。
8. selector 明确排除 `header`、`footer` 和 notes 容器。

`DocxFileView` 激活段落时标记同 ordinal 的全部 fragments；unavailable placeholder
放到最后一个 fragment。搜索 reveal 把当前 query 作为 `textHint`，优先滚到包含
query 的 fragment。

### 5.3 数据流

```text
Vault binary（每次文件打开只读一次）
        |
        +--> inspectDocxPackage --> DocxSemanticModel --> search/navigation
        |
        +--> createSafeDocxRendererBuffer --> 内存中的 sanitized derivative
                                                |
                     requested mode ------------+
                                                v
                                   DocxRendererAdapter.open
                                                |
                  +-----------------------------+--------------------+
                  |                                                  |
          reading render profile                           layout render profile
          responsive reflow hooks                         page geometry + scale
                  |                                                  |
                  +--------------- paragraph anchors ---------------+
```

`DocxFileView` 在当前 file session 内保存 sanitized buffer 和 semantic model，用于
模式切换。不得再次读取 Vault，也不得把 derivative 写回 Vault。

### 5.4 原子模式切换

在 `DocxFileView` 内集中实现一个 private render transaction，例如：

```ts
private async renderMode(
  requestedMode: DocxViewMode,
  reason: "initial-open" | "user-switch",
): Promise<void>;
```

transaction 必须：

1. 捕获旧 session、active paragraph 或顶部 paragraph anchor。
2. 创建独立 AbortController 和递增 generation。
3. adapter `open` 只创建 unmounted session；transaction 校验 generation 后才调用
   `session.mount(readingBody)` 原子替换旧 renderer root。
4. 仅在 generation/current file 仍有效时安装新 session。
5. 安装后再 dispose 旧 session。
6. 恢复 placeholders、notices、active fragments、search current 状态和 viewport。
7. 成功后更新 mode dataset、ARIA 和 diagnostics。
8. user-switch 失败时保留旧 session/DOM/mode，只显示非阻断本地化 status。
9. initial-open 失败仍走现有 error surface。
10. rapid toggle、file replacement、close、plugin unload 必须 abort 过期 transaction。

不要先 dispose 旧 session，也不要在切换开始时清空 reading body。
当前 adapter 的内部 staging 在成功时仍替换调用者 container，不能提供原子切换。
这次应把 seam 深化为 `open -> unmounted session -> mount`：过期 generation 直接
dispose 未挂载 session，旧 DOM 完全不动；layout ResizeObserver 和 bounded scroll
listener 都在 mount 时绑定真实 reading body。

### 5.5 大文档策略

`BoundedDocxRendererAdapter` 按请求模式执行：

| 文档 | reading 请求 | layout 请求 |
| --- | --- | --- |
| `paragraphs <= threshold` 且 preview 成功 | delegate；支持两种 | delegate |
| 小文档 reading preview incompatible | bounded reading；只支持 reading | 传播失败并保留旧 reading |
| `paragraphs > threshold` | bounded reading；只支持 reading | 不调用 rich delegate，不创建 layout DOM |

初始 session 只支持 reading 时，file view 直接禁用 layout button。5,000 段文档 DOM
`<= 1,200` 是硬门槛，不能降低 threshold 或绕过 bounded adapter。

### 5.6 页面缩放内部模块

新增：

- `src/docx/renderer/docx-layout-viewport.ts`
- `tests/docx/docx-layout-viewport.test.ts`

它是 renderer implementation 的内部模块，不是外部 seam，并在 session mount 后
启动。职责：

1. 读取所有 `section.docx` 未缩放的 authored/computed page width。
2. 以最宽页面作为统一缩放基准。
3. 监听 reading body 宽度变化，包括 Obsidian split resize 和 search rail 开关。
4. 计算 `scale = Math.min(1, Math.max(0.65, available / widestPage))`。
5. 写入 `--office-viewer-docx-layout-scale` 和 `data-layout-scale`。
6. Electron/Chromium 用 CSS `zoom` 缩放 page，使缩放参与正常布局。
7. 无 page 或无 `ResizeObserver` 时回退 `scale=1` 和可滚动页面，不阻断打开。
8. `dispose()` 断开 observer。

把 scale calculation 提取成纯函数。最低 0.65 是可读性保护；更窄 pane 允许
reading body 横向滚动，而阅读视图仍必须无横向滚动。

## 6. CSS 结构

把当前连续阅读规则收进：

```css
.office-viewer-docx-shell[data-view-mode="reading"] ...
```

仅 reading 生效：52rem 宽度、wrapper/page collapse、fallback page padding、
responsive media/table 和 dark-theme inversion。

layout 最低视觉契约：

- reading body 以 `var(--background-secondary)` 作为 page canvas。
- wrapper 为居中的纵向 page stack，并保留局部 overflow。
- `section.docx` 使用 authored width/min-height/margins，page 间有 1.5rem–2rem gap、
  border 和轻 shadow。
- 深浅主题中都保持白纸/黑字，不使用 reading invert filter；media 保持自然颜色。
- `zoom` 只作用于 page，不污染 toolbar、search rail 或 status。
- authored table/image geometry 不被 reading reflow hooks 改写。
- active highlight 和 unavailable placeholder 两种模式均可见。

不要留下未作用域的 `.docx-wrapper > section.docx` override，这是两种模式互相污染
的主要风险。

## 7. 实施任务

### Task 1：领域和 renderer interface

修改：

- `CONTEXT.md`
- 新建 `docs/adr/0006-add-optional-docx-layout-view.md`
- `docs/prd/docx-reading-search-release.md`
- `src/docx/renderer/docx-renderer-adapter.ts`
- renderer/fake adapter 相关测试

步骤：

1. ADR 记录 renderer 分页限制、默认 reading、辅助 stories 排除、大文档禁用 layout
   和无权威页码。
2. 先写 interface 编译/行为测试，再增加 mode/open options/session fields。
3. 一次性更新 production 和 test adapters，不得长期用 `as unknown as` 绕过契约。
4. renderer candidate 类型不变；view mode 不是新 candidate。

### Task 2：fragment-safe mapping

修改：

- `src/docx/renderer/docx-renderer-adapter.ts`
- `src/docx/renderer/docx-preview-renderer-adapter.ts`
- `src/docx/docx-file-view.ts`
- `src/docx/docx-search-panel.ts`
- `tests/docx/docx-renderer-adapters.test.ts`
- `tests/docx/docx-file-view.test.ts`

先增加失败测试：

1. 一个 semantic paragraph 被两个连续 fragments 拆分，拼接相同则成功，两个元素
   ordinal 相同。
2. 拼接少字、多字、乱序或跨过其他段落时失败。
3. anchor 是第一个 fragment。
4. `textHint` 命中第二 fragment 时 reveal 返回第二 fragment。
5. active paragraph 高亮所有 fragments，切换 active 后全部清理。
6. unavailable placeholder 放在最后一个 fragment。
7. header/footer 同文文本不参与 mapping。

把 `DocxSearchPanel` 的 navigate callback 扩展为传递当前 query/text hint；search
结果仍保持每 paragraph 一个，不引入 occurrence-level 结果。

用新 interface 测 observable contract，删除已被替代的近义旧测试，不维护两套
mapping 实现。

### Task 3：两套 render profile

修改 `src/docx/renderer/docx-preview-renderer-adapter.ts` 和 adapter tests。

1. 把共同安全选项和 reading/layout 差异集中到 private/pure profile builder。
2. reading 保持当前配置并调用 `prepareRenderedDocxReadingLayout`。
3. layout 开启 width/height/page breaks/last-rendered breaks，不调用 reading hooks。
4. 两种模式都 detached render → sanitize → mapping → 返回 unmounted session。
5. root 分别增加 `office-viewer-docx--reading`、`office-viewer-docx--layout`。
6. session `mount` 才 replace container 并启动 mode-specific observers/listeners。
7. error/abort/mapping failure 和 stale generation 时 destination DOM 不变。

验收：同一 fixture reading 是连续 surface，layout 产生多个 page sections，且两者
semantic mapping 完整。

### Task 4：layout viewport

实现第 5.6 节模块。单测至少覆盖：

- 800px page / 760px available → `0.95`。
- 800px / 300px → clamp `0.65`。
- 500px page / 600px available → 不放大，`1`。
- 多 page 使用最宽 page。
- resize 更新 CSS variable。
- 缺 page/observer 不抛错。
- dispose 后 resize 不再更新。

### Task 5：bounded mode policy

修改：

- `src/docx/renderer/bounded-docx-renderer-adapter.ts`
- `src/docx/renderer/create-docx-renderer-adapter.ts`
- 对应两个测试文件

完整覆盖第 5.5 节矩阵，并特别断言：大文档 layout 不调用 delegate；小文档 layout
失败不伪装成功；reading fallback 只声明 reading support；cancellation/dispose 清理
不变。

### Task 6：toolbar 与原子 transaction

修改：

- `src/docx/docx-file-view.ts`
- `src/docx/docx-search-panel.ts`
- `src/docx/docx-messages.ts`
- `tests/docx/docx-file-view.test.ts`

至少新增 messages：`viewModeLabel`、`readingView`、`layoutView`、
`layoutViewUnavailable`、`viewModeSwitchFailed`。

测试：

1. 初始 reading，dataset 和两个 `aria-pressed` 正确。
2. layout switch 复用 retained safe buffer，不二次 `vault.readBinary`。
3. 成功切换只留一个 renderer root，旧 session dispose 恰好一次。
4. 保留 search query/results/active paragraph，并恢复匹配 fragment。
5. 失败保留旧 DOM/mode/search/active，只显示非阻断 status。
6. rapid reading→layout→reading 只安装最后 generation。
7. replace/close abort in-flight switch，无 stale DOM/observer/listener。
8. bounded session 禁用 layout button，不能触发 layout open。
9. error/loading 时模式按钮禁用，retry 后恢复。
10. 所有路径源字节不变。

fake renderer 使用 deferred Promise 覆盖 race，不使用 sleep。

### Task 7：隔离 reading/layout CSS

修改 `styles.css`：

1. 先给 reading rules 加 mode scope，确认现有图片、宽表格、自适应 margin 不回退。
2. 再增加 layout canvas/page stack/zoom/theme styles。
3. search rail resize 后页面重新 fit。
4. minimum scale 后，横滚只属于 reading body，不扩张 Obsidian workspace。
5. 检查 focus-visible、forced colors、reduced motion；本功能不需要动画。

### Task 8：确定性 fixture 与 installed E2E

修改：

- `scripts/generate-docx-exploration-fixtures.mjs`
- `tests/e2e/docx-reading-search.e2e.ts`
- `tests/e2e/docx-compatibility.compatibility.ts`

新增 `layout-pages.docx`，包含：明确 `w:pgSz`/`w:pgMar`、portrait section、一个
semantic paragraph 内 manual page break、后续 paragraph、landscape section、table、
inline image、第二页唯一搜索文本和固定 ZIP timestamps。

Installed E2E 断言：

1. 默认 reading，并记录源 hash。
2. 点击 layout 后 root mode 正确，存在多个 `section.docx`。
3. authored width/min-height 生效，portrait/landscape 宽度不同。
4. 第二页搜索文本定位到正确 fragment，所有同 ordinal fragments 高亮。
5. search rail 开关后 scale 更新或保持正确 clamp。
6. dark theme page 为白色、正文为深色。
7. 切回 reading 后 page gap/canvas 消失，responsive hooks 恢复。
8. 全流程零网络，源 hash 不变。
9. stress 文档 layout disabled，DOM 始终 `<= 1,200`。

Compatibility corpus 对所有 rich-preview 可读文档执行 layout toggle；layout 可读率
至少 90%，正文 marker 和 mapping 仍存在。

### Task 9：性能、文档与发布一致性

按需修改：

- `docs/compatibility/docx-preview-0.3.6.md`
- `docs/performance/docx-preview-0.3.6.md`
- `README.md`
- `docs/globalization/m3-message-review.md`
- `release-contract.json`

性能门槛：

- 默认 reading first-readable/search-ready 不超过现有门槛。
- 1,000 段 representative 的 reading→layout 和 layout→reading p95 均
  `<= 3,000 ms`。
- rapid switch cancellation/cleanup `<= 2,000 ms`。
- 同时只有一套 `.office-viewer-docx` root。
- 5,000 段不创建 layout DOM，body DOM `<= 1,200`。

README 必须同时说明版式视图能力和非精确 Word 分页限制。

## 8. 验收矩阵

| 场景 | 阅读视图 | 版式视图 | 必须结果 |
| --- | --- | --- | --- |
| 普通 body-led DOCX | 默认 | 可切换 | 内容、搜索、links/bookmarks 可用 |
| paragraph 内 page break | 连续 reflow | 分页 | 同一 paragraph 跨 fragments 精确映射 |
| portrait + landscape | 连续 reflow | 不同纸张宽度 | 统一比例、无裁切 |
| 图片/宽表格 | 响应式缩小 | authored geometry + 整页缩放 | 两种模式互不污染 |
| dark theme | Obsidian 主题适配 | 白纸/深色正文 | media 不反色 |
| search rail 开关 | 无横向滚动 | 重新 fit，最低比例后局部横滚 | workspace 不被撑宽 |
| layout render 失败 | 保持 reading | 不安装失败 DOM | 非阻断提示，可继续阅读 |
| >1,000 段 | bounded reading | disabled | DOM `<=1,200` |
| active/protected/malformed | 现有安全错误 | 不可进入 | 稳定类别、源不变 |
| rapid toggle/close/reopen | 最后 generation 生效 | 同左 | 无 stale resources |

## 9. 最终验证

按顺序运行并保留输出：

```bash
npm run fixtures:docx
npm run build
npx vitest run tests/docx/docx-renderer-adapters.test.ts \
  tests/docx/bounded-docx-renderer-adapter.test.ts \
  tests/docx/create-docx-renderer-adapter.test.ts \
  tests/docx/docx-layout-viewport.test.ts \
  tests/docx/docx-file-view.test.ts
npm run test:e2e:docx
npm run test:compatibility:docx
npm run test:performance:docx
npm test
git diff --check
```

另用以下真实 DOCX 做窄窗复测，但不得提交、复制进 fixtures、日志或发布截图：

- `/Users/oulong/Library/Mobile Documents/com~apple~CloudDocs/Obsidian Vault/02 Areas/AI Agent/青少年限速_网络失败及业务失败告警复盘20240110.docx`
- `/Users/oulong/Library/Mobile Documents/com~apple~CloudDocs/Obsidian Vault/02 Areas/AI Agent/网络信息安全总体规划方案-20250707.docx`

真实文档验收：

- reading 保持此前验证过的图片/表格响应式表现；
- layout 显示 page canvas、paper boundary 和 section geometry；
- 两种模式搜索同一正文并能切换后继续定位；
- 源 hash 前后相同；
- 临时 Vault、截图和复制文件在测试后清理。

## 10. 已知基线问题

2026-08-01 的一次本地全量单测出现：

- committed performance baseline 的 representative fixture SHA 与本地生成 fixture
  不一致；
- 5,000 段 `docx-file-view` 测试在并行全量运行时一次 15 秒超时，隔离复跑通过。

不得为让本功能变绿而盲目覆盖 performance hash 或放宽 DOM/时限。先运行
deterministic fixture regeneration 和专用 performance suite，区分 stale baseline、
fixture generator 变化与真实回归；如需更新 baseline，单独记录 provenance 和原因。

## 11. 完成定义

只有同时满足以下条件才完成：

- 领域文档明确区分 reading、layout 和 Word print fidelity。
- 默认阅读和现有响应式改动无回退。
- renderer seam 支持 mode，第三方分页复杂度不泄漏到 file view。
- 跨页 fragments mapping 精确、保序、无猜测。
- 切换原子、可取消、失败可恢复，只保留一棵 renderer DOM。
- 大文档 layout disabled，DOM 和性能门槛不回退。
- 三种语言文案完整并满足人工审阅要求。
- unit、installed E2E、compatibility、performance、full regression 和
  `git diff --check` 通过，或已知基线异常被独立、可复现地解释。
- 两份真实 DOCX 完成 reading/layout 窄窗复测并清理临时材料。

执行者不要自行提交、推送或创建 PR，除非操作者另行明确授权。
