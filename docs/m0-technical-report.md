# M0 PPTX rendering technical report

Date: 2026-07-13  
Milestone: `v0.1 M0 — 技术可行性与质量基线`  
Decision: **technical GO for M1; repository integration pending**

## Executive conclusion

The browser-native, local-only PPTX preview path is technically viable for M1.
`@aiden0z/pptx-renderer@1.2.4` exceeds the fixed 80% readability gate, is far
inside the 3-second first-readable budget, passes slide navigation, abnormal
input, cancellation, and resource-return checks, and has an Apache-2.0 license
compatible with open distribution and future commercial Pro work under its
distribution obligations.

This is a conditional technical decision, not a milestone close or a
public-release approval. Tickets
#3, #5, and #6 are implementation-complete on reviewed PRs but are not yet
merged into `main`; M1 should not branch from `main` until #9, #10, and #11
land and close their linked issues. No evidence conflict is hidden by this
integration condition.

## Gate result

| M0 question | Evidence | Result |
| --- | --- | --- |
| Can a local PPTX open inside Obsidian without Office or a server? | Ticket #2 installed smoke path | yes |
| Is main content readable on representative fixtures? | 18 / 20 units, 90% | pass; threshold 80% |
| Is first content responsive? | p50 41.7 ms; p95 43.9 ms; 10 / 10 samples | pass; budget 3,000 ms |
| Is page switching responsive? | p50 1.6 ms; p95 2.3 ms; 40 / 40 samples | pass; budget 100 ms |
| Do abnormal files fail safely and locally? | shared encrypted, corrupt, active-content, size-limit, and safe-link fixtures | pass |
| Can in-flight work stop? | 5 / 5 cancellations; p95 12.9 ms | pass |
| Do measured resources return within the observation window? | 15 / 15 completions; p95 1,853.7 ms | pass; deadline 2,000 ms |
| Is the bundle measurable and candidate-isolated? | selected bundle 1,142,910 bytes; rejected implementation absent | pass with size risk |
| Does licensing meet the product floor? | selected package Apache-2.0 | pass with Apache-2.0 distribution obligations |

The budgets were not changed. The fixed environment was Obsidian 1.12.7,
installer 1.12.7, Electron 39.8.3, macOS on Apple M4 Pro with 48 GiB memory.
See the committed raw artifacts for exact protocol and runtime provenance.

### Memory observations

| Renderer-process observation | p50 | p95 |
| --- | ---: | ---: |
| Workload peak heap | 21,470,692 bytes | 27,200,624 bytes |
| Post-close heap | 17,355,824 bytes | 18,057,904 bytes |
| Workload peak RSS | 252,690,432 bytes | 277,839,872 bytes |
| Post-close RSS | 244,678,656 bytes | 245,235,712 bytes |

All 10 measured memory attempts passed the incremental-heap return policy.
Heap is gated against each run's pre-open/workload/post-close evidence; RSS is
reported but not gated because Chromium allocators retain and share resident
pages. These process observations are not a claim about whole-system memory.

## Candidate decision

The selected renderer scores 90% readability and completes the representative
performance protocol. The rejected `pptx-preview@1.0.7` candidate scores 80%
but fails 13 / 13 attempts to open the unchanged 12-slide performance file;
its latency values are correctly reported as `n/a`, not zero. It is also
266,881 bytes larger in the candidate-only production bundle and brings an
ambiguous redistribution posture plus three moderate production audit nodes.
Its visual review also found a missing theme/master footer, broken SVG images,
and missing or incorrect chart categories and data bars.

The selected adapter is 84 source lines versus 105 for the rejected adapter,
and both reuse the project-owned preflight decorator. More importantly, Aiden
exposes native abort and ZIP-limit controls, while the rejected adapter must
approximate those boundaries outside a non-interruptible parser. Both upstream
packages have concentrated maintenance; Aiden has the stronger signal because
its repository and API documentation are public, though its release history is
still recent.

The decision and reversal conditions are formalized in
[`ADR-0001`](adr/0001-select-aiden-pptx-renderer-for-m0.md). The full comparison
is in [`renderer-comparison.md`](research/renderer-comparison.md).

## Compatibility and visual boundary

The selected candidate supports the tested text/font fallback, theme/master,
tables, charts, native groups, rotations, transparency, and common raster
image paths. It degrades both SVG-bearing fixtures because the vector image is
replaced by a broken placeholder. All accepted screenshots are hash-bound and
ordinary runs permit zero changed pixels.

The following are not supported or not proven by M0:

- reliable embedded SVG, complex vector, EMF, and WMF rendering;
- optional embedded-PDF fallback while PDF.js is disabled;
- PowerPoint animations, transitions, audio, video, and interactive behavior;
- macros or active content; these are intentionally blocked rather than run;
- legacy binary `.ppt` files;
- editing, comments, saving back to Office formats, or round-trip fidelity;
- password entry/decryption for encrypted presentations;
- pixel-perfect layout across unavailable fonts, OS font metrics, arbitrary
  Office versions, and all real-world business decks.

### User-misinterpretation risks and required degradation cues

An incomplete slide can still look plausible. A missing logo, vector diagram,
master object, chart label, or font substitution may change business meaning
without making the view obviously broken. M1/public-release UX must therefore:

- describe the product as a preview, not an authoritative PowerPoint rendering;
- show a clear unsupported/degraded-content notice when the renderer exposes a
  detectable failure or blocked feature;
- keep malformed/damaged, protected/encrypted, incompatible/blocked, and
  unknown failures distinct;
- offer an explicit “open in system application” escape hatch for verification;
- never imply that blocked active content was executed or fully inspected;
- avoid editing/export promises based on the preview DOM.

M0 does not yet prove automatic detection of every visual omission. SVG/vector
degradation warning work is therefore required before public release even
though it does not block starting M1.

## Safety and lifecycle result

Project-owned preflight rejects unsafe package structures before allocating a
renderer. The view presents stable user-facing categories without leaking
candidate parse details, makes retry/close actions deterministic, avoids source
mutation, and blocks external access during automated fixtures. Closing a leaf,
switching files, or unloading the plugin aborts/disposes the active generation.

Resource evidence uses real renderer snapshots and a two-second close window.
Heap return is gated; RSS is observed but not gated because Electron/Chromium
allocators retain and share resident pages. That policy and every selected
snapshot are encoded in the validator rather than inferred from the report.

## M1 contract and isolation rules

M1 may build on the project-owned `PptxRendererAdapter` seam: binary open,
slide count, zero-based slide render, abort, and idempotent dispose. It may also
rely on package preflight, lifecycle diagnostics, stable failure categories,
candidate-only production builds, and the installed test entry points.

M1 must not couple product behavior to candidate DOM classes, internal parse
errors, event registries, chart/image cleanup, or package-specific option
objects. New functionality should enter through the adapter or a separately
owned capability. Candidate upgrades require the compatibility, safety,
performance, bundle, and evidence-reproducibility suites.

## Remaining risks that do not block M1

| Risk | User/product impact | Required follow-up |
| --- | --- | --- |
| SVG/vector gaps | diagrams or logos may be missing | detect and warn; investigate safe fallback before release |
| New/concentrated upstream maintenance | regressions or API churn | pin exact version; monitor upstream; retain adapter replacement seam |
| 1.14 MB renderer bundle | plugin install/load cost | track bundle regression and lazy-loading options |
| Font dependence | layout drift or fallback changes | document preview limitation; expand cross-platform corpus |
| Generated corpus coverage | unknown real-deck failures | add permissioned, anonymized real business decks in M1 |
| Cancellation-validator duplication | acceptance rules could drift during maintenance | extract a shared strict cancellation validator before modifying that protocol |
| Apache-2.0 obligations | distribution compliance | include the license, retain applicable notices, mark modified files, and include `NOTICE` only if upstream supplies one |

## Evidence index

- First installed renderer path:
  [`first-renderer-candidate.md`](research/first-renderer-candidate.md)
- Compatibility methodology and selected result:
  [`aiden-pptx-renderer-1.2.4.md`](compatibility/aiden-pptx-renderer-1.2.4.md)
- Abnormal-file behavior:
  [`pptx-failure-handling.md`](compatibility/pptx-failure-handling.md)
- Installed performance result:
  [`aiden-pptx-renderer-1.2.4.md`](performance/aiden-pptx-renderer-1.2.4.md)
- Second-candidate screen and result:
  [`second-renderer-candidate.md`](research/second-renderer-candidate.md),
  [`pptx-preview compatibility`](compatibility/pptx-preview-1.0.7.md), and
  [`pptx-preview performance`](performance/pptx-preview-1.0.7.md)
- Candidate comparison:
  [`renderer-comparison.md`](research/renderer-comparison.md)
- Raw committed baselines: `tests/compatibility/results/` and
  `tests/performance/baselines/`

## Milestone integration audit

| Ticket | Technical state | Repository state on 2026-07-13 |
| --- | --- | --- |
| #2 first local PPTX | complete | issue closed |
| #3 safe failures | complete and verified | PR #9 open |
| #4 representative corpus | complete | issue closed; PR #8 merged |
| #5 performance/resources | complete and verified | PR #10 open |
| #6 second candidate comparison | complete and reviewed | PR #11 open |
| #7 decision gate | this report and ADR complete on branch | merge pending |

Final milestone closure requires the open PRs to land, their linked issues to
close, and one `main` verification run to confirm there is no integration-only
regression. Until then the honest state is **technical GO, integration pending**.
