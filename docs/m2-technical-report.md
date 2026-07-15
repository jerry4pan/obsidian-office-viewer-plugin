# M2 Daily Reading Experience Technical Report

## Status

The seven M2 deliverables and five M2 exit conditions have direct source,
focused-test, installed-Obsidian, compatibility, and performance evidence on
local branch `codex/m2-daily-reading-experience`. The complete fresh Task 11
matrix is green. The branch remains unpublished and still requires final
dual-axis review plus integration, so M2 issue #15 and milestone 3 must remain
open until the reviewed integration exists remotely and GitHub is updated from
that published commit.

This report distinguishes M2 requirement completion from branch publication
readiness. The retained M1 compatibility gate was rerun against the intentional
M2 default toolbar/thumbnail layout rather than inferred from focused tests.

## Authority and review range

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
- `22354e2`, `2519ba4` — view-local navigation/zoom controller and UI-sink
  isolation.
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
| Virtualized thumbnail rail | `src/thumbnail-rail.ts`, `src/thumbnail-virtual-window.ts`, `src/render-task-queue.ts`, `styles.css` | `tests/thumbnail-rail.test.ts` proves bounded/accessibly named windows, scroll replacement, priorities, retry, stale cancellation, ready counts, and cleanup; `tests/thumbnail-virtual-window.test.ts` proves bounded 100/200-slide math | `tests/e2e/pptx-m2.e2e.ts` uses the 200-slide deck and observes a positive mounted count below 200; committed and fresh performance evidence mount 10 of 50 | PASS |
| Fit, manual zoom, and reset | `src/pptx-viewer-controller.ts`, `src/pptx-view-session.ts`, `styles.css` | `tests/pptx-viewer-controller.test.ts` proves 25-point steps, 25–400% clamps, serialization, failure rollback, and fit at 100%; session tests prove actions and per-view state | Installed M2 test changes the real workspace pane width, observes the rendered width recompute while manual `125%` remains active, verifies the 1.25 multiplier against Fit, and proves split-leaf zoom isolation | PASS |
| Keyboard navigation and full screen | `src/pptx-view-session.ts`, `styles.css` | Session tests prove Arrow/Page key mapping, editable-control guard, accessible actions, real state subscription, local rejection handling, and cleanup | Installed M2 test proves the viewer owns focus immediately after open and uses Webdriver keys without a pointer action; it also uses the real Electron Fullscreen API and preserves the source hash | PASS |
| Independent state across leaves | One controller, queue, rail, full-screen subscription, and renderer lifecycle per `PptxViewSession` open generation | Controller/session tests prove view-local page/zoom state and stale-completion suppression | Installed M2 test opens a real split leaf and proves page, zoom, thumbnail scroll position, and full-screen state remain independent | PASS |
| Optional per-file reading-position persistence | `src/reading-position-store.ts`, `src/office-viewer-setting-tab.ts`, `src/main.ts`, `src/pptx-file-view.ts` | `tests/reading-position-store.test.ts` covers default enablement, exact fingerprint validation, invalidation, path-only rename migration, delete, disable-and-clear, serialization, retry, last-event-wins, and unload flush; `tests/plugin-registration.test.ts` proves a rename retains the old size/mtime so simultaneous content changes invalidate on next open | Installed M2 test restores page 9 after Obsidian restart, then disables/clears history and proves page 1 after the next restart | PASS |
| Progressive rendering, adjacent prefetch, cancellation, and release | Parse-only renderer open in `src/renderer/*`; current page in `src/pptx-viewer-controller.ts`; one-concurrency background work in `src/render-task-queue.ts`; rail/session disposal in `src/thumbnail-rail.ts` and `src/pptx-view-session.ts` | Renderer tests prove disposable thumbnail/prefetch handles and abort; queue tests prove priority, de-duplication, concurrency one, cancellation, stale-result disposal; controller/session tests prove current-first rendering and deterministic/re-entrant cleanup | Installed cleanup case reaches pending/running/mounted `0/0/0`; performance records current-first readiness, warm switches, adapter stop, close/file-switch stop, and full cleanup | PASS |
| Light/dark theme and basic accessibility | Scoped `.pptx-viewer` rules in `styles.css`; native controls and ARIA/live state in `src/pptx-view-session.ts` and `src/thumbnail-rail.ts` | Session/rail tests prove accessible names, logical DOM actions, `aria-current`, live status, and focusability; all CSS selectors remain scoped | Installed M2 test checks both themes, semantic names, effective opaque control backgrounds, enabled-control contrast, and visible focus/outline contrast of at least 3:1 | PASS |

### M2 exit conditions

| Exit condition | Direct evidence | Status |
| --- | --- | --- |
| 50-slide benchmark meets fixed latency budgets | Committed 10/10 first-readable p95 `88.1 ms` (`<=3000 ms`) and 40/40 proven-warm switches p95 `1.8 ms` (`<=100 ms`). Final fresh Task 11 run: first-readable p95 `88.5 ms`, switches p95 `1.8 ms`; no failures. | PASS |
| Large deck does not schedule or mount every page | Virtual-window unit tests cover 100 and 200 slides. Installed stress test observes bounded 200-slide mounting. Committed/fresh 50-slide performance observations mount 10, never 50; the background queue's observed concurrency is one. The 200-slide fixture exceeds the PRD's 100-slide floor. | PASS |
| Close and file switch stop work and release resources | Committed evidence: close `2.3 ms`, file switch `17.5 ms`, both `0/0/0`; final fresh run: close `1.1 ms`, file switch `17.5 ms`, both `0/0/0`. Adapter-stop p95 is `18.1 ms` committed and `17.2 ms` fresh; committed/fresh full resource completion p95 `1854.9`/`1855.3 ms` is within the unchanged 2000 ms observation window. | PASS |
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

The current production bundle is `1,172,397` bytes and matches the committed
provenance lock. The committed JSON baseline SHA-256 is
`0bc0be3c4c3912b62455d797066fa300d39630166ed8d2a3c38e2aacfa957cbc`;
its reproducible Markdown SHA-256 is
`1775b776b2b102ada4be774dd49f8402aa9414bef4b07418f7abf262266c1a31`.

The committed baseline retains all seven fix-round attempts, including three
failures, and permits promotion only after two consecutive clean runs with the
same bundle and fixture. Accepted runs are
`7c1e65af-e7ce-42a8-8109-12f6779a95e9` and
`81fe9fd4-73bd-49da-abec-385f4982be21`. The strict cancellation heap-return
rule can be noisy when the measured in-flight increment is small; no budget,
sample count, or cleanup threshold was loosened, and the failed history remains
committed rather than discarded.

Committed distributions and cleanup outcomes:

- metadata/open: 10/10, p50 `84.9 ms`, p95 `86.2 ms`;
- first readable: 10/10, p50 `86.8 ms`, p95 `88.1 ms`;
- proven-warm switch: 40/40, p50 `1.7 ms`, p95 `1.8 ms`;
- project-owned thumbnail readiness: 10/10, p50 `151.4 ms`, p95 `156.2 ms`;
- mounted thumbnails: 10/10, p50/p95 `10`;
- cancellation adapter stop: 5/5, p95 `18.1 ms`;
- full resource completion: 15/15, p95 `1854.9 ms`;
- peak memory p95: heap `35,719,024` bytes, RSS `347,979,776` bytes;
- all ten measured heap-return attempts passed the unchanged 50% retained
  incremental-heap policy; RSS is reported, not gated.

The final ignored Task 11 performance output also passed: first readable 10/10
p50 `85.1 ms`, p95 `88.5 ms`; warm switches 40/40 p50 `1.7 ms`, p95
`1.8 ms`; thumbnail readiness p95 `153.9 ms`; mounted maximum `10`;
adapter-stop p95 `17.2 ms`; full completion p95 `1855.3 ms`;
close/file-switch ended at `0/0/0`; artifact failures were empty. The retained
history now has 11 attempts. Attempt 9 remains failed because its first
cancellation sample missed the unchanged 2000 ms lifecycle/resource deadline;
attempt 10 (`02a3b988-4c73-4ad3-bc0a-989ae57bf503`) and attempt 11
(`0c85b8e5-8611-44cd-9ab5-b89a193ca45e`) are the required two consecutive
clean runs. This ignored evidence was not copied over the committed reference
baseline.

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
- the installed zoom test changes pane width and proves adaptive fit plus the
  preserved manual multiplier; removing the main-wrapper `max-width` clamp
  fixed a real bug where the label said `125%` but rendered width remained at
  Fit;
- the two-leaf installed test now covers thumbnail scroll and full-screen
  state in addition to page and zoom;
- installed keyboard navigation now begins from automatic viewer focus and
  performs no pointer action.

## Fresh Task 11 verification

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
