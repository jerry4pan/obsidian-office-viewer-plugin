# Obsidian 社区插件用户反馈链路基准研究

研究日期：2026-07-26

## 结论

**300+ 下载但没有真实用户反馈，并不异常；但当前反馈链路值得优化。**

这里的“不异常”不等于“产品已经被验证”。Office Viewer 的官方市场页当前显示
312 downloads、创建约两周、13 次更新；官方统计文件又按版本分别记录下载次数。
因此下载量更接近“安装与更新产生的累计下载事件”，不能视为独立用户数、活跃用户数，
更不能证明用户完成了真实知识工作流。[Office Viewer 官方市场页](https://community.obsidian.md/plugins/office-viewer)
和 [Obsidian 官方下载统计文件（本次研究时的固定版本）](https://github.com/obsidianmd/obsidian-releases/blob/87974f3a83206df5ed8afbd1b2a2c08e6f91d4b5/community-plugin-stats.json#L61302-L61318)
提供了直接证据：后一文件中的 `office-viewer.downloads` 等于各版本下载数之和。

当前市场本身没有插件评分或评论入口；市场页展示的是 Overview、Scorecard、Updates，
并把仓库 README 渲染为 Overview。Office Viewer 的反馈链接虽然已经出现在 README，
但位于很长的功能说明之后，而且 Bugs 与 Feature requests 共用一个普通 Issues 入口。
官方发布仓库也明确说明，插件详情页会拉取仓库的 `README.md`，插件问题应在插件自己的
仓库提交。因此，**问题主要不是“没有渠道”，而是入口过深、场景不匹配、反馈类型没有
分流、提交前仍需用户自己组织上下文**。
[Obsidian 官方发布仓库说明](https://github.com/obsidianmd/obsidian-releases/blob/87974f3a83206df5ed8afbd1b2a2c08e6f91d4b5/README.md#how-community-plugins-are-pulled)

> 证据与推断的边界：没有一手资料给出“每 300 次 Obsidian 插件下载应收到多少反馈”的
> 基准比例。本文不虚构反馈率。上述“不异常”是根据累计下载口径、更新次数、入口摩擦和
> 新插件生命周期作出的推断；“没有真实工作流验证”则是确定结论。

## 最强一手证据

### 1. Obsidian 市场不会替插件建立反馈闭环

- Obsidian 从仓库拉取 README 展示插件详情，更新时从 GitHub Release 获取插件文件；
  官方发布仓库还建议首次发布后在论坛和 Discord 宣传，也建议在正式提交前用公开测试
  获取反馈。[官方发布与分发说明](https://github.com/obsidianmd/obsidian-releases/blob/87974f3a83206df5ed8afbd1b2a2c08e6f91d4b5/README.md#how-community-plugins-are-pulled)
- Office Viewer 的市场页能看到累计下载数和 README 内的 Feedback 段落，但没有用户评分、
  评论或面向工作流验证的专用表单。[Office Viewer 官方市场页](https://community.obsidian.md/plugins/office-viewer)

**推断：** 仅把 GitHub Issues 链接放在 README 底部，是被动接收“愿意专门来报告问题的
GitHub 用户”，无法覆盖成功用户、非技术用户或尚不确定自己遇到的是 bug 还是使用问题的
用户。

### 2. 自动遥测不是适合 Obsidian 社区插件的补救方案

Obsidian 的开发者政策以私密、离线使用为优先，明确禁止 client-side telemetry；
网络使用必须在 README 披露，server-side telemetry 还必须链接隐私政策。
[Obsidian Developer policies](https://github.com/obsidianmd/obsidian-developer-docs/blob/2d0e942f03b23ed94ebda3c610ed074662ed63db/en/Developer%20policies.md#not-allowed)

**推断：** 不应为了回答“有多少人打开过 PPTX”而引入埋点、自动崩溃上报或后台请求。
更合适的方案是：在正确时机显示本地 CTA；诊断信息在本地生成、可预览、由用户明确复制
或提交；插件本身不自动发送任何内容。

### 3. GitHub 原生能力足以把不同反馈分流

GitHub 官方将 Issues 定位为可跟踪的 bug、改进和具体任务，将 Discussions 定位为开放式
问答、想法和社区对话；讨论明确后可由维护者创建 Issue。
[GitHub Discussions quickstart](https://docs.github.com/en/enterprise-cloud%40latest/discussions/quickstart)

GitHub Issue Forms 可以用必填字段、下拉框和复选框收集结构化信息；Discussion Forms
也可以为某一讨论类别定义结构化字段。新 Issue URL 还能预填标题、正文、模板和表单字段。
[Issue Forms 官方文档](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates)
、[Discussion Forms 官方文档](https://docs.github.com/en/discussions/managing-discussions-for-your-community/creating-discussion-category-forms)
、[Issue URL 预填参数](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue#creating-an-issue-from-a-url-query)

**推断：** 本项目不需要引入第三方反馈 SaaS，先用 GitHub 原生表单即可把“工程缺陷”和
“开放式工作流探索”分开；这同时降低隐私、运营和政策风险。

### 4. 高下载 Obsidian 插件采用“分流 + 场景化诊断”

官方统计文件显示，Tasks 的累计下载约 388 万，Obsidian Git 约 291 万。
[Obsidian 官方插件统计](https://github.com/obsidianmd/obsidian-releases/blob/87974f3a83206df5ed8afbd1b2a2c08e6f91d4b5/community-plugin-stats.json)

- Tasks 关闭空白 Issue，把“提问”送到 Discussions Q&A，并为 Bug 与 Feature
  Request 使用不同 Issue Forms。Bug 表单要求复现步骤、期望/实际行为、系统与插件版本；
  Feature 表单要求单一功能、适用于其他用户、用例与替代方案。
  [Tasks 路由配置](https://github.com/obsidian-tasks-group/obsidian-tasks/blob/610c8cca95a8690e0625f70b9f2c4b0d2b934760/.github/ISSUE_TEMPLATE/config.yml)
  、[Bug Form](https://github.com/obsidian-tasks-group/obsidian-tasks/blob/610c8cca95a8690e0625f70b9f2c4b0d2b934760/.github/ISSUE_TEMPLATE/bug-report.yaml)
  、[Feature Form](https://github.com/obsidian-tasks-group/obsidian-tasks/blob/610c8cca95a8690e0625f70b9f2c4b0d2b934760/.github/ISSUE_TEMPLATE/feature-request.yaml)
- Tasks 还在实际解析错误发生时显示问题说明、Issue 入口，并提示附上 debug info；这比让
  用户事后从 README 寻找入口更接近问题发生点。
  [Tasks 场景化错误报告代码](https://github.com/obsidian-tasks-group/obsidian-tasks/blob/610c8cca95a8690e0625f70b9f2c4b0d2b934760/src/Obsidian/Cache.ts#L378-L409)
- Obsidian Git 在插件设置中提供 “Copy Debug Information”，并明确警告内容可能敏感。
  [Obsidian Git 设置代码](https://github.com/Vinzent03/obsidian-git/blob/616fe86ffa52054529617d930b0f58478f73cc31/src/setting/settings.ts#L996-L1043)

**推断：** Tasks 的分流和错误现场入口值得采用；Obsidian Git 的“用户主动复制”值得采用，
但不应照搬“复制全部 settings”。Office Viewer 应继续只输出白名单诊断字段，并在复制前
明确说明不包含文件名、路径、幻灯片文本、图像或搜索内容。

### 5. 反馈请求应出现在“完成有意义任务之后”

Apple 与 Google 的官方应用体验指南都建议：用户体验到足够价值或完成一个动作/任务后再
请求反馈，避免启动时打断，也不要频繁提示。
[Apple requesting reviews](https://developer.apple.com/documentation/storekit/requesting-app-store-reviews)
、[Google Play in-app review guidelines](https://developer.android.com/guide/playcore/in-app-review#when-to-request)

**推断：** 虽然这些指南针对商店评分，不是 Obsidian 插件反馈，但“完成价值动作后、
低频、可忽略”同样适用于工作流反馈。安装成功、插件启动和第一次打开文件都太早。

## 建议的反馈架构

| 用户意图 | 正确去向 | 入口时机 | 最少需要的信息 |
| --- | --- | --- | --- |
| “功能坏了” | GitHub Bug Issue Form | 错误、重试、兼容性警告附近；设置页常驻入口 | 复现步骤、期望/实际、版本、白名单诊断摘要 |
| “希望增加能力” | GitHub Feature Issue Form | 设置页、README/市场页 | 用户目标、现有工作流、当前替代方案、期望结果 |
| “不知道怎么用” | GitHub Discussions Q&A | 设置页、README/市场页 | 想完成什么、已经尝试什么 |
| “我的真实工作流是这样” | Discussions 的 Workflow stories 类别 | 完成一次知识引用闭环后的一次性轻提示；设置页常驻入口 | 素材来源、实际步骤、使用频率、在哪一步受阻、是否再次返回引用位置 |
| 安全漏洞 | GitHub Private Vulnerability Reporting / SECURITY.md | README 与设置页安全链接 | 保持私密，不进入公开 Issue |

### 建议的界面与触发点

1. **常驻入口：** 在插件设置加入 “Feedback & support” 区块，提供三个明确按钮：
   “Report a problem”“Request a feature”“Share your workflow”。不要只给一个
   “GitHub”按钮。
2. **Bug 现场：** 在阻塞错误、兼容性警告和重试界面旁加入 “Copy diagnostic summary”
   与 “Report this problem”。后者打开预填的 Bug Form；用户仍需确认并提交。
3. **能力缺口现场：** 用户选择 “Open in default application” 时，可提供低干扰的
   “Tell us what was missing” 链接，去 Feature Form 或 Workflow Discussion；不要阻止
   原操作。
4. **工作流成功现场：** 用户成功通过 Slide reference 返回精确幻灯片后，最多显示一次
   非模态提示：“Did this help your real workflow? Share how you use it.” 可立即关闭，
   并永久不再提示。只保存 `shown/dismissed` 之类的本地 UI 状态，不发送行为数据。
5. **不要做：** 启动弹窗、安装即调查、每 N 次使用弹窗、自动打开浏览器、自动附加日志、
   自动上传 PPTX 或引入第三方分析 SDK。

## 建议表单内容

### Bug Issue Form

- 发生了什么、期望发生什么、最短复现步骤。
- Obsidian 版本、插件版本、操作系统。
- 发生在哪个动作：打开 / 导航 / 搜索 / speaker notes / copy reference /
  embed / return to reference / fullscreen / external open。
- 可选粘贴白名单 Diagnostic summary。
- 明示：不要上传包含机密内容的演示文稿；如需样例，优先提供最小化、脱敏后的复现文件。

### Feature Issue Form

- 想完成的用户目标，而不是只写解决方案。
- 当前在 Obsidian 与 PowerPoint/Keynote 之间怎样完成。
- 哪一步最费力或无法完成。
- 当前替代方案。
- 希望出现的结果；一次只提交一个能力。

### Workflow Discussion Form

- 真实 PPTX 的来源类别与大致复杂度，不要求文件或文件名。
- 从发现内容、打开精确位置、复制或嵌入、写入笔记、再次返回的实际步骤。
- 哪些步骤重复发生，哪些只发生一次。
- 是否在真实 Vault 中再次通过引用返回正确幻灯片。
- 最有价值的一步与最容易放弃的一步。
- 是否愿意后续交流；不要要求在公开 Discussion 填邮箱或敏感身份信息。

## 两阶段实施建议

### P0：无需产品代码，立即做

1. 启用 GitHub Discussions，至少建 `Q&A` 和 `Workflow stories` 两类。
2. 新建 Bug 与 Feature 两个 Issue Forms，关闭 blank issues；把 Q&A 和 workflow
   feedback 配成 contact links。
3. 把 README 的三类反馈入口移到安装说明或首屏功能摘要之后。由于 Obsidian 市场直接
   渲染 README，这一步同时改善市场页入口。
4. 在 Obsidian 论坛既有发布帖中发一个具体问题，而非泛泛“欢迎反馈”，例如：
   “你通常在找到某张幻灯片后，把它怎样带回笔记？之后会再次返回原幻灯片吗？”

### P1：小范围产品改动

1. 设置页加入三个分流按钮。
2. 错误与兼容性表面加入用户主动复制诊断和预填 Bug Form。
3. “Open in default application” 后增加能力缺口反馈入口。
4. 在首次成功完成 Slide reference 返回后显示一次性、可永久关闭的 workflow CTA。

建议先运行 4 周，人工检查：

- 是否出现来自不同真实读者的完整 workflow stories；
- Bug 报告是否包含可复现步骤和诊断摘要；
- Feature 请求是否描述工作目标而不只是功能名；
- 是否有人报告在自己的 Vault 与 PPTX 中重复完成知识引用闭环。

这些是反馈质量和工作流验证信号，不应再用下载量替代。若四周后仍没有工作流故事，应从
“被动入口优化”升级为在 Obsidian 论坛/Discord 定向招募少量真实读者访谈，而不是引入
遥测。

