# M0 PPTX renderer comparison

Date: 2026-07-13  
Ticket: #6  
Decision: keep `@aiden0z/pptx-renderer@1.2.4`; eliminate `pptx-preview@1.0.7`

## Executive result

`@aiden0z/pptx-renderer` remains the M0 shipping candidate. It passes the
shared compatibility, safety, latency, cancellation, resource-return, and
production-bundle acceptance paths. `pptx-preview` reaches the 80% fixture
readability threshold, but it cannot open the unchanged 12-slide
representative performance presentation in any of the 13 cold, warmup, or
measured attempts. That is a functional compatibility failure, so no
first-readable or slide-switch latency can be reported for it.

The second candidate's failed run is retained as a committed baseline. It is
not converted to a smaller corpus, a looser threshold, or a synthetic timing.

## Same-protocol comparison

| Decision input | `@aiden0z/pptx-renderer` 1.2.4 | `pptx-preview` 1.0.7 |
| --- | --- | --- |
| Readable main content | 18 / 20 (90%); 3 supported, 2 degraded | 16 / 20 (80%); 1 supported, 4 degraded |
| Visual gaps | Embedded SVG images fail | Master footer missing; SVG images fail; chart labels/data are incorrect |
| Representative 12-slide opens | 13 / 13 pass | 0 / 13 pass; package reports no usable slide |
| First-readable p50 / p95 | 41.7 / 43.9 ms (10 / 10 measured) | n/a / n/a (0 / 10 measured) |
| Slide-switch p50 / p95 | 1.6 / 2.3 ms (40 / 40 switches) | n/a / n/a (0 / 40 switches) |
| Peak heap p50 / p95 | 21,470,692 / 27,200,624 bytes | n/a / n/a; no readable steady state |
| Memory/resource-return runs | 10 / 10 complete | 0 / 10 reach a readable steady state |
| In-flight cancellation p50 / p95 | 12.1 / 12.9 ms; 5 / 5 pass | 11.2 / 14.6 ms; 5 / 5 pass |
| Full resource completion p50 / p95 | 1,852.0 / 1,853.7 ms; 15 / 15 | 1,850.9 / 1,853.2 ms; 5 / 15 cancellation-only |
| Production candidate bundle | 1,142,910 bytes | 1,409,791 bytes (+266,881; +23.4%) |
| Shared malformed/unsafe fixtures | Pass; stable project error categories | Pass; stable project error categories |
| Adapter size | 84 source lines | 105 source lines plus project preflight |
| Parser cancellation and ZIP limits | Native `AbortSignal` and renderer ZIP limits | No parser abort or resource-limit API; project preflight only |
| Package/session isolation | Instance-owned lifecycle | Module-global event registry may couple concurrent sessions |
| Published license | Apache-2.0, public upstream repository | npm metadata says ISC; README says source is closed and restricts republication/modification into another open-source project |
| Maintenance signal | Public repository and documented API; still new and maintainer-concentrated | One npm maintainer, no repository metadata, latest release 2025-10-17 |
| Production dependency audit | 0 vulnerabilities after the rejected candidate is excluded | Adds 3 moderate production advisories through ECharts 5.6 and uuid 10 |

All timings are from the same installed Obsidian 1.12.7 / Electron 39.8.3
environment, fixed run counts, representative file, production build mode,
and two-second resource observation window. Package size is the corresponding
candidate-only `main.js`; the build alias proves the unselected renderer is
not included.

## Why the second candidate is eliminated

The decisive reason is not its 80% compatibility score or its package size.
It silently resolves `load()` with an empty internal slide collection for the
representative presentation, and the adapter correctly converts that state to
the stable `incompatible` error category. The real-package unit test and the
installed run reproduce the same failure.

Even if that parser defect were fixed, the lower fidelity, lack of an internal
abort/resource-limit API, global event registry, ambiguous redistribution
language, and vulnerable transitive production dependencies all increase the
shipping risk relative to the first candidate.

The decision can be reopened only if a future `pptx-preview` release opens the
unchanged representative file under all shared safety and performance runs,
improves compatibility beyond the selected candidate, provides redistribution
terms acceptable for this open-source plugin, removes the vulnerable runtime
chain, and supplies instance-safe cancellation and cleanup semantics. The
candidate must rerun the existing corpus and thresholds; passing a substituted
file or candidate-specific protocol is not sufficient.

## Dependency consequence

`pptx-preview` remains pinned in `devDependencies` only so the rejected
candidate's compatibility, safety, and performance evidence remains
reproducible. The default production composition root selects Aiden, and
`npm audit --omit=dev` reports zero production vulnerabilities. A future
candidate comparison can reuse the same build selector, fixtures, baselines,
and validators without adding candidate branches to product UI.

## Evidence map

- Candidate screening: `docs/research/first-renderer-candidate.md` and
  `docs/research/second-renderer-candidate.md`
- Compatibility: `docs/compatibility/aiden-pptx-renderer-1.2.4.md` and
  `docs/compatibility/pptx-preview-1.0.7.md`
- Performance: `docs/performance/aiden-pptx-renderer-1.2.4.md` and
  `docs/performance/pptx-preview-1.0.7.md`
- Machine-readable performance evidence:
  `tests/performance/baselines/aiden-pptx-renderer-1.2.4.json` and
  `tests/performance/baselines/pptx-preview-1.0.7.json`
- Machine-readable compatibility evidence under
  `tests/compatibility/results/`

## Ticket #7 handoff

Ticket #7 should record Aiden as an accepted M0 dependency with explicit
follow-ups for SVG fidelity, upstream/API maturity, and maintainer
concentration. This decision approves the renderer for the M0 scope; it does
not claim pixel-perfect PowerPoint fidelity or approve a public release.
