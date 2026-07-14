# M1 Technical Report: Installable Plugin and Basic Reading Loop

- Date: 2026-07-14
- Milestone: `v0.1 M1 — 基础阅读闭环`
- Tracking issue: #13
- Integration target: local `main`
- Review baseline: `195c454`
- Review scope: `195c454...HEAD` on the integrated local branch
- Scope authority: `docs/prd/v0.1-first-public-release.md`
- Renderer authority: `docs/adr/0001-select-aiden-pptx-renderer-for-m0.md`

## Scope result

M1 is implemented without pulling M2 or M3 features forward. The installed
desktop plugin opens a Vault `.pptx`, renders it locally and read-only, exposes
the basic navigation loop, represents empty/loading/degraded/error states,
retries blocking failures, and keeps the desktop default application available
as a fallback.

## Deliverable evidence

| M1 deliverable | Implementation evidence | Test evidence | Status |
| --- | --- | --- | --- |
| PPTX file registration and dedicated workspace view | `src/main.ts` registers extension `pptx` with `PPTX_VIEW_TYPE`; `src/pptx-file-view.ts` implements the `FileView` | `tests/plugin-registration.test.ts`; installed `tests/e2e/open-pptx.e2e.ts` | Complete |
| Local binary read and read-only rendering | `PptxFileView.onLoadFile` delegates to `Vault.readBinary`; the adapter receives an `ArrayBuffer`; no source write capability is present | Plugin boundary asserts no `writeBinary`; installed E2E hashes sources before, during, and after open/navigation/close | Complete |
| Current page, total pages, Previous, Next, and page jump | `src/pptx-view-session.ts` routes all controls through one zero-based navigation function and exposes a one-based validated input | Session tests cover pages 1–3 and invalid `""`, `0`, `4`, `1.5`; plugin and installed tests jump through a real 12-slide fixture | Complete |
| Loading, empty, basic error, and retry | The session starts in `empty`, keeps navigation disabled while loading, preserves the last readable slide by rollback or snapshot restoration when later slides fail, moves recoverable failures to `degraded`, and uses stable blocking error panels with retry | Session tests cover lifecycle, loading controls, degraded navigation, all stable categories, retry, stale work, and disposal; both adapter suites prove failed navigation preserves visible content, including rollback failure; installed abnormal fixtures cover retry and cleanup; a test-only installed adapter deterministically rejects slide 2 and proves the previous slide remains visible before slide 3 recovers | Complete |
| Open in default application fallback | `src/pptx-file-view.ts` injects desktop `electron.shell.openPath`; the session exposes it in ready and error states and contains local failure copy | Session tests invoke the injected action; plugin and installed tests prove fallback availability without launching a host application during automation | Complete |
| Main-path integration in real Obsidian | WebdriverIO config builds and installs the repository plugin into the sandboxed `tests/vault` through `wdio-obsidian-service` | `npm run test:e2e` passes six production-adapter cases and one deterministic degraded-navigation case on Obsidian 1.12.7; the runner restores the production bundle after fault injection | Complete |

## Exit-condition evidence

| M1 exit condition | Authoritative evidence | Status |
| --- | --- | --- |
| A clean Vault can install the development build and open a supported PPTX | `wdio.conf.mts` installs plugin `.` into sandbox Vault `tests/vault`; installed E2E opens `minimal.pptx` to `ready` and renders its marker | Met |
| Navigation boundaries are correct and invalid page input cannot damage the view | Session tests reject four invalid input forms without calling the renderer; installed E2E keeps page 12 readable after `0`, `13`, and `1.5` | Met |
| Opening, paging, and closing do not modify the source | Installed E2E compares SHA-256 before open, after navigation, and after leaf detach; all abnormal fixtures are also hash-checked | Met |
| One bad file cannot affect other workspace leaves | Installed E2E keeps a healthy leaf readable while a resource-limit fixture fails, retries, and closes | Met |
| The main seams cover success, degradation, error, and external fallback | Installed E2E covers success/error/fallback availability and deterministically proves recoverable navigation degradation; the installed compatibility suite covers the two approved degraded Aiden fixtures; session tests cover degradation and fallback invocation | Met |

## Verification record

All results below were produced on the integrated local `main` working tree on
2026-07-14. GitHub issue #13 and milestone 2 remain open until this local branch
is published; the report does not treat unpublished integration as remote
completion.

| Command | Result |
| --- | --- |
| `npm run verify` | PASS: 25 test files; 179 passed, 1 skipped |
| `npm run test:e2e` | PASS: 7 installed Obsidian cases: 6 production-adapter cases and 1 deterministic degraded-navigation case |
| `npm run test:compatibility` | PASS: 5 fixtures captured and classified; existing zero-pixel baselines preserved |
| `npm run test:performance` | PASS: first-readable p95 43.2 ms; slide-switch p95 2.5 ms; no recorded failures |
| `npm run test:performance:baseline` | PASS: 8 tests passed, 1 skipped |

The M1 production bundle is 1,146,032 bytes. Because the review changed that value,
the full installed performance protocol was rerun rather than editing the M0
artifact. The generated JSON and Markdown were copied byte-for-byte into
`tests/performance/baselines/aiden-pptx-renderer-1.2.4.json` and
`docs/performance/aiden-pptx-renderer-1.2.4.md`; the baseline validator then
passed.

Preceding performance invocations exposed two collector failure paths: selected
snapshots could outlive their raw evidence after a timeout, and an expired
attempt deadline could skip renderer cleanup before the next sample. The
validator rejected every invalid or failed artifact, so none was promoted.
Issue #14 records the original inconsistency. Regression tests now prove that
selected snapshots are recomputed from available raw evidence and that
collector cleanup receives a fresh bounded deadline; the installed collector
also performs an idempotent close before releasing registry evidence and stops
the run if that cleanup fails. A subsequent full protocol produced the passing
artifact recorded above without changing thresholds or sample counts.

## Deferred work

M2 retains thumbnails, zoom, keyboard navigation, full-screen mode,
reading-position persistence, progressive scheduling, and broader resource
management. M3 retains general compatibility warnings, diagnostics, settings,
release packaging, and public-release documentation. M1 makes no claim that
those later milestones are complete.
