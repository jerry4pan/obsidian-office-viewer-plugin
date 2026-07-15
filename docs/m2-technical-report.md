# M2 Daily Reading Experience Technical Report

## Status

On 2026-07-15, the accepted product amendment removed manual main-slide zoom
after real-deck testing exposed transient scaling artifacts. M2 now retains
automatic fit-to-window rendering and adds a resizable, accessible thumbnail
rail. The preferred width is Vault-wide, while page, thumbnail scroll, and
full-screen state remain view-local. The evidence matrix below reflects that
amended boundary; the original implementation history remains recorded for
provenance.

The original seven M2 deliverables and five M2 exit conditions were integrated
to local `main` at `9f05c019e8448f70f9fac27a7ada15b16a26bb4a`. The 2026-07-15
amendment is reviewed and verified against that fixed baseline on local `main`.
This remains unpublished, so M2 issue #15 and milestone 3 must remain open
until the reviewed commit exists remotely and GitHub is updated from that
published commit.

This report distinguishes M2 requirement completion from branch publication
readiness. The retained M1 compatibility gate was rerun against the intentional
M2 default toolbar/thumbnail layout rather than inferred from focused tests.

## Authority and review range

The current amendment review range starts at
`9f05c019e8448f70f9fac27a7ada15b16a26bb4a`. The branch/commit details below
record the original M2 implementation and are retained as historical
provenance rather than describing the current working tree.

- PRD: `docs/prd/v0.1-first-public-release.md`, milestone M2.
- Approved design: `docs/superpowers/specs/2026-07-14-m2-daily-reading-experience-design.md`.
- Execution plan: `docs/superpowers/plans/2026-07-14-m2-daily-reading-experience.md`.
- Fixed review baseline: `10caf4a9b4000539b6fd8c4be0610a9684fcd173`
  (`docs: design M2 daily reading experience`).
- Implementation branch: `codex/m2-daily-reading-experience`.
- Pre-documentation implementation HEAD:
  `e93d7d5628456fa5cff94dd990392236fd8ba0cd`
  (`test(performance): lock M2 evidence provenance`).
- Branch point with current local `main`:
  `8f931c94d85c4974c3d5c9c3fb8adcbf5ba522f4`.
- Current local `main` at report preparation:
  `a367a5fe4ecdf89c37d8a4e83e8744161b5c4136`; it has one local-only
  documentation commit not present on this M2 branch.
- Local `origin/main` tracking ref:
  `195c454ae302a335b68e99fbdbcbfcbba28efa17`; local `main` is 13 commits
  ahead and the M2 implementation HEAD is 35 commits ahead of that tracking
  ref.
- The M2 branch has no upstream, and no local remote-tracking branch contains
  its HEAD. These are read-only local ref observations; no fetch, push, issue
  edit, comment, label change, or milestone change was performed for this
  report.

Implementation commits after the M2 plan are:

- `fa8e671` / `4482133` — reading-position storage and privacy hardening.
- `e15d47a` — candidate-neutral renderer M2 capabilities.
- `60052be` — bounded render queue and virtual-window math.
- `86beb80`, `94a7864`, `49cde03`, `93afeeb`, `ca7e477` — thumbnail rail
  implementation and cancellation/resource hardening.
- `22354e2`, `2519ba4` — original view-local navigation/zoom controller and
  UI-sink isolation, superseded for zoom by the 2026-07-15 amendment.
- `cd21618`, `46247c4`, `f7467b7`, `66d5f86` — complete session interaction,
  deterministic/re-entrant cleanup, and full-screen probe isolation.
- `45abc6d`, `2251a79`, `0b3f314` — Obsidian persistence/settings lifecycle
  and non-throwing error containment.
- `f4d953d`, `ace483a` — installed M2 behavior, accessibility, network, source
  hash, restart, multi-leaf, and cleanup acceptance.
- `c9811e1`, `481ac9b`, `e93d7d5` — 50-slide performance baseline, real
  readiness/warm-switch proof, retained-run provenance, and provenance lock.

## Requirement-to-evidence matrix

### M2 deliverables

| Deliverable | Implementation | Focused evidence | Installed/performance evidence | Status |
| --- | --- | --- | --- | --- |
| Virtualized, resizable thumbnail rail | `src/thumbnail-rail.ts`, `src/thumbnail-rail-resizer.ts`, `src/thumbnail-rail-sizing.ts`, `src/thumbnail-virtual-window.ts`, `src/render-task-queue.ts`, `styles.css` | Rail/session/sizing tests prove bounded windows, live pointer layout, commit-time rerender, 120–480px preference normalization, 45% narrow-pane cap, keyboard steps, double-click reset, accessibility, cancellation, and cleanup | Installed M2 test uses the real divider and verifies the default/reset width while the 200-slide deck remains virtualized | PASS |
| Automatic fit-to-window | Renderer adaptive resize in `src/renderer/aiden-pptx-renderer-adapter.ts`; product UI contains no manual zoom state or actions | Session and adapter tests prove the automatic-fit contract and absence of manual zoom controls | Installed M2 test resizes the real workspace pane and observes the rendered slide recompute without a manual scaling mode | PASS |
| Keyboard navigation and full screen | `src/pptx-view-session.ts`, `styles.css` | Session tests prove Arrow/Page key mapping, editable-control guard, accessible actions, real state subscription, local rejection handling, and cleanup | Installed M2 test proves the viewer owns focus immediately after open and uses Webdriver keys without a pointer action; it also uses the real Electron Fullscreen API and preserves the source hash | PASS |
| Independent state across leaves | One controller, queue, rail, full-screen subscription, and renderer lifecycle per `PptxViewSession` open generation | Controller/session tests prove view-local page state and stale-completion suppression | Installed M2 test opens a real split leaf and proves page, thumbnail scroll position, and full-screen state remain independent; rail width is intentionally Vault-wide | PASS |
| Optional per-file reading-position persistence and Vault-wide rail preference | `src/reading-position-store.ts`, `src/office-viewer-setting-tab.ts`, `src/main.ts`, `src/pptx-file-view.ts` | `tests/reading-position-store.test.ts` covers default enablement, exact fingerprint validation, invalidation, path-only rename migration, delete, disable-and-clear, serialization, retry, last-event-wins, unload flush, and normalized rail-width persistence; `tests/plugin-registration.test.ts` proves a rename retains the old size/mtime so simultaneous content changes invalidate on next open | Installed M2 test restores page 9 after Obsidian restart, then disables/clears history and proves page 1 after the next restart | PASS |
| Progressive rendering, adjacent prefetch, cancellation, and release | Parse-only renderer open in `src/renderer/*`; current page in `src/pptx-viewer-controller.ts`; one-concurrency background work in `src/render-task-queue.ts`; rail/session disposal in `src/thumbnail-rail.ts` and `src/pptx-view-session.ts` | Renderer tests prove disposable thumbnail/prefetch handles and abort; queue tests prove priority, de-duplication, concurrency one, cancellation, stale-result disposal; controller/session tests prove current-first rendering and deterministic/re-entrant cleanup | Installed cleanup case reaches pending/running/mounted `0/0/0`; performance records current-first readiness, warm switches, adapter stop, close/file-switch stop, and full cleanup | PASS |
| Light/dark theme and basic accessibility | Scoped `.pptx-viewer` rules in `styles.css`; native controls and ARIA/live state in `src/pptx-view-session.ts`, `src/thumbnail-rail.ts`, and `src/thumbnail-rail-resizer.ts` | Session/rail tests prove accessible names, logical DOM actions, `aria-current`, live status, separator values/keyboard steps, and focusability; all CSS selectors remain scoped | Installed M2 test checks both themes, semantic names including the resize separator, effective opaque control backgrounds, enabled-control contrast, and at least 3:1 focused-separator outline contrast | PASS |

### M2 exit conditions

| Exit condition | Direct evidence | Status |
| --- | --- | --- |
| 50-slide benchmark meets fixed latency budgets | Current committed evidence records 10/10 first-readable p95 `143.1 ms` (`<=3000 ms`) and 40/40 proven-warm switches p95 `2.0 ms` (`<=100 ms`), with no artifact failures. | PASS |
| Large deck does not schedule or mount every page | Virtual-window unit tests cover 100 and 200 slides. Installed stress test observes bounded 200-slide mounting. Committed/fresh 50-slide performance observations mount 10, never 50; the background queue's observed concurrency is one. The 200-slide fixture exceeds the PRD's 100-slide floor. | PASS |
| Close and file switch stop work and release resources | Current evidence: close `1.2 ms`, file switch `20.4 ms`, both `0/0/0`; cancellation adapter-stop p95 is `78.1 ms`, and full resource-completion p95 is `1854.3 ms` within the unchanged 2000 ms observation window. | PASS |
| Valid page restores after restart | Installed M2 test captures the first ready transition at page `9 / 12`, survives `browser.reloadObsidian`, and separately proves disable-and-clear starts at `1 / 12`. Store/plugin focused tests cover invalidation and lifecycle. | PASS |
| Keyboard-only core reading loop works | Installed M2 test asserts the real viewer is automatically focused immediately after open, then uses `ArrowRight`, `PageDown`, and `PageUp` without any click or pointer action; focused tests cover both Arrow directions, both Page keys, boundaries, and editable controls. | PASS |

## Performance and fixture evidence

The reference environment is
`panjieruideMacBook-Pro.local (Apple M4 Pro, 48 GiB)`, Darwin 24.6.0 arm64,
Obsidian/installer 1.12.7, Electron 39.8.3, Chromium 142.0.7444.265,
Node 22.22.1, and `@aiden0z/pptx-renderer@1.2.4`.

| Fixture | Slides | Bytes | SHA-256 | Source/Vault |
| --- | ---: | ---: | --- | --- |
| `m2-representative-50-slides.pptx` | 50 | 1,307,274 | `d613d62d93be1a11c9a52537ecf2bcd5bbc8c0aae8cd4c6b84b721ebc96d8948` | exact match |
| `representative-12-slides.pptx` | 12 | 343,783 | `e71651a6b3d9884717792f8a47045be68a4e7ac0c4890a63a314d85bd9af8a3d` | exact match |
| `stress-200-slides.pptx` | 200 | 2,564,331 | `7f7b07939e25c14167bae72d3f9e9f8db56215730514dcee942b7335ee32a5f2` | exact match |

The current production bundle is `1,176,586` bytes and matches the committed
provenance lock. The committed JSON baseline SHA-256 is
`de905093d696926b404ddb94613d9e20888b542c81cd13b588f69886a7e8073b`;
its reproducible Markdown SHA-256 is
`cc73021df68bd6427f32c68876bed5d2b22856084e4fa85e05aa5ce466eeae9f`.

The committed baseline retains all 14 amendment attempts, including nine
failures, and permits promotion only after two consecutive clean runs with the
same bundle and fixture. Accepted runs are
`00b81a67-8991-4f30-9909-91f006af829c` and
`27fe45c4-1be5-4a08-8802-5f9ebc6b2fbd`. The collector now uses
renderer-authoritative post-GC timing, performs one unmeasured cancellation
instrumentation warmup, and waits silently for the fixed post-close sample so
WebDriver polling cannot starve the renderer timer. No budget, measured sample
count, or cleanup threshold was loosened, and every failed attempt remains
committed rather than discarded.

Committed distributions and cleanup outcomes:

- metadata/open: 10/10, p50 `83.7 ms`, p95 `140.7 ms`;
- first readable: 10/10, p50 `85.5 ms`, p95 `143.1 ms`;
- proven-warm switch: 40/40, p50 `1.8 ms`, p95 `2.0 ms`;
- project-owned thumbnail readiness: 10/10, p50 `150.6 ms`, p95 `221.3 ms`;
- mounted thumbnails: 10/10, p50/p95 `10`;
- cancellation adapter stop: 5/5, p95 `78.1 ms`;
- full resource completion: 15/15, p95 `1854.3 ms`;
- peak memory p95: heap `35,986,280` bytes, RSS `350,437,376` bytes;
- all ten measured heap-return attempts passed the unchanged 50% retained
  incremental-heap policy; RSS is reported, not gated.

The final installed collector run passed as a test, not merely as ignored
output. Its accepted predecessor has first-readable p95 `91.6 ms`; the final
accepted run has p95 `143.1 ms`. Both use the same bundle and fixture hashes,
retain all prior failures, and report empty artifact failure arrays.

## Privacy, offline, read-only, and renderer boundaries

- Production reads presentation bytes only through `Vault.readBinary`; M2 adds
  no Vault write path for PPTX content. Installed tests hash representative and
  stress sources before/after use.
- Installed M2 network guards cover renderer and Electron request paths across
  restart boundaries. Normal viewing, theme, persistence, full-screen, and
  cleanup tests observed no request.
- Persistence stores schema version, `rememberReadingPosition`, and entries
  containing only Vault-relative `path`, `size`, `mtime`, `slideIndex`, and
  `updatedAt`. Tests reject absolute/traversal paths and strip arbitrary caller
  fields such as text, author, or image data.
- Active/external content is not executed or fetched. External hyperlinks are
  rendered safely; the operating-system external-open action remains an
  explicit user fallback.
- Candidate objects and disposable handles remain inside renderer adapters.
  Product/controller/rail code consumes only the project-owned
  `PptxRendererSession` and `PptxRendererResource` contracts, preserving
  ADR-0001.

## Final dual-axis review

The fixed-range review `10caf4a...HEAD` ran separate standards and spec axes.
The standards axis found one hard documentation contradiction: the refreshed
compatibility report still described Aiden as unselected after ADR-0001 had
selected it. The report now states the accepted decision while retaining the
known SVG limitation. Its possible `PptxViewSession.open()` Divergent Change
smell was evaluated as non-blocking: the approved M2 design makes the session
the product-owned orchestration seam, and extracting it during acceptance
would add lifecycle risk without changing an unmet requirement.

The spec axis found four gaps, all resolved with direct evidence:

- rename migration now changes only the path/key and retains the old size and
  mtime, so a content-changing rename cannot bless stale state;
- the original installed zoom test changed pane width and proved adaptive fit;
  manual multiplier behavior was later removed by the 2026-07-15 amendment;
- the two-leaf installed test covers thumbnail scroll and full-screen state in
  addition to page; rail width is intentionally a shared Vault preference;
- installed keyboard navigation now begins from automatic viewer focus and
  performs no pointer action.

The 2026-07-15 amendment re-review additionally found that cancellation GC
timing mixed collector and renderer clocks, separator focus contrast was not
measured, and the committed performance lock still described the prior bundle.
The collector now records the renderer's timestamp after GC, the installed test
requires at least 3:1 separator focus contrast in both themes, and the current
JSON/Markdown/lock set is generated from the same two accepted clean runs.

## Amendment verification (2026-07-15)

| Command | Result |
| --- | --- |
| `npm run verify` | PASS — 33 Vitest files; 303 passed, 1 skipped. |
| `npm run test:e2e` | PASS — production open 6/6, M2 5/5, degraded navigation 1/1. |
| `npm run test:compatibility` | PASS — installed compatibility 2/2; approved screenshots retain zero pixel drift. |
| `npm run test:performance` | PASS — installed collector 1/1 after two consecutive clean retained runs. |
| `npm run test:performance:baseline` | PASS — 24 passed, 1 candidate-specific skip. |

## Original Task 11 verification (2026-07-14)

Commands were run from the M2 worktree on 2026-07-14 (Asia/Shanghai).

| Command | Result |
| --- | --- |
| `npm run verify` | PASS — fixture generation, typecheck/build, 31 Vitest files; 295 passed, 1 skipped. |
| `npm run test:e2e` | PASS — production `open-pptx` 6/6 and M2 5/5; degraded-navigation 1/1; the final production bundle rebuild passed. |
| `npm run test:compatibility` | PASS after a TDD inspection-boundary fix and explicit baseline review — 18/20 readable (`90%`) versus the fixed 80% gate; 3 supported, 2 known SVG-degraded, 0 failed; all five approved `462x549` M2-layout PNGs matched with zero changed pixels. |
| `npm run test:performance` | PASS — installed collector 1/1, fresh complete evidence summarized above, no recorded artifact failure. |
| `npm run test:performance:baseline` | PASS — 24 passed, 1 candidate-specific skip; committed provenance, fixture hash, bundle, derived metrics, and Markdown were accepted. |
| `git diff --check` | PASS before and after the documentation edits; no whitespace errors. |

The first Task 11 compatibility run correctly rejected the old `632x589`
baselines after the M2 default toolbar and 168 px thumbnail rail intentionally
reduced the main surface to `462x549`. It also exposed a real evidence bug:
font inspection walked the viewer root, so duplicate thumbnail text could win
before the main-slide text. A failing installed regression test observed only
`Revenue grew 24%` and `Theme footer`, missing all three expected font labels.
Scoping the text walker, images, and contained selectors to
`.pptx-viewer__slide` restored 5/5 text-theme evidence without changing the
80% gate. All five new Aiden PNGs were then visually reviewed and explicitly
approved; ordinary mode proved 18/20 readability and zero pixel drift. The
PPTX-preview baselines and results were not changed.

Approved Aiden M2-layout baseline SHA-256 values are:

- `text-theme-wide`: `b8621cdfc9dd6cffa1c5af2c257d5070bc5a9026e65f28011189f3725d2bdae6`;
- `images-transparency-standard`: `d1ebeaee8c153627001af8d76c54997e65f07f19d67ce3e22547fc87fb8f7166`;
- `tables-charts`: `e233151e7c031386b1836d3d05ca79e6eb0ca10b57323f04b12106630f2859de`;
- `grouped-rotated`: `d2b797a99d29f0e198816f436fb04cfbe81b5d11a540e35c5c71dfd9f8a125e4`;
- `complex-drawing`: `9da90cef6b91003b3875ed2d16bc98973c9791b3e5acba189249a51d0ced3aff`.

## Publication and GitHub state

Task 1 created
[`#15 — [M2] 完成日常可用的 PPTX 阅读体验`](https://github.com/jerry4pan/obsidian-office-viewer-plugin/issues/15)
under milestone 3 with canonical label `ready-for-agent`, exactly seven
deliverable checkboxes and five exit-condition checkboxes. The Task 1 readback
recorded the issue open, the milestone open with one open issue, and no
comments. This documentation task intentionally did not perform a fresh
network read or mutate GitHub.

Remote closure is not authorized or justified by the current state. Exact
prerequisites are:

1. integrate the M2 branch with the one local-main delegation-doc commit and
   complete final code/spec review;
2. publish the reviewed integration commit to the configured GitHub remote;
3. verify that exact commit exists on the published integration branch;
4. only then post this requirement/evidence matrix, replace
   `ready-for-agent` with `ready-for-human`, close issue #15 as completed, and
   close milestone 3 only after it reports zero open issues.

M3 remains deferred: complete compatibility warnings and stable diagnostic
export, the full privacy/security/compatibility documentation set, CI and
release assets, and packaged clean-Vault install/upgrade/uninstall validation.
M4 retains Beta and public Community Plugins submission. No M2 evidence in
this report claims either later milestone complete.
