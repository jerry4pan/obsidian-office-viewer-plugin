# First renderer candidate: @aiden0z/pptx-renderer

- Status: conditional first candidate for M0; not the final renderer decision
- Reviewed: 2026-07-13
- Version tested: 1.2.4

## Problem background

Ticket #2 needs one browser-native renderer to prove the complete local path
from an Obsidian Vault binary file to a visible first slide. The adapter must
remain replaceable because M0 requires a later comparison with a second
candidate.

## Constraints and success criteria

- Browser/Electron runtime with no server or Office installation.
- Input is an `ArrayBuffer` read through Obsidian's Vault API.
- Single-slide rendering and deterministic cleanup are required.
- User-controlled PPTX input must have decompression limits.
- The license must allow open-source distribution and future commercial Pro
  development.

## Findings

Facts verified from the published package and upstream repository:

- npm version 1.2.4 is licensed under Apache-2.0.
- The unpacked npm package is approximately 2.62 MB.
- Runtime dependencies are ECharts 6 and JSZip 3.10; `pdfjs-dist` is an
  optional peer dependency.
- `PptxViewer.open` accepts browser binary input, a DOM container, ZIP limits,
  an abort signal, and slide/list rendering modes.
- `PptxViewer.destroy()` cleans up DOM observers, charts, and owned blob URLs.
- Upstream publishes `RECOMMENDED_ZIP_LIMITS` for untrusted PPTX packages.
- The package is browser-only at runtime and its release history is very
  recent. Version 1.2.4 was published immediately before this review.

Upstream reports broad shapes, text, images, tables, charts, SmartArt, groups,
fills, and color-pipeline coverage with a large visual regression suite. Those
are maintainer claims, not independently verified conclusions for this plugin.
Tickets #4–#6 perform the project-specific compatibility and comparison work.

## Recommendation

Use 1.2.4 conditionally as the first M0 candidate because its API directly
supports the required ArrayBuffer → DOM path, abort signal, resource limits,
single-slide render mode, and cleanup. Keep the entire dependency behind
`PptxRendererAdapter` and disable optional PDF.js fallback for this tracer
bullet.

Do not select it as the final renderer yet. The project must still measure
real business decks, malformed inputs, memory, cold-open latency, bundle size,
and a second candidate under identical tests.

## Risks and unknowns

- The package and its current API surface are new and may change quickly.
- Maintenance is concentrated in one npm collaborator.
- High-fidelity claims need validation against the project's own fixture set.
- ECharts contributes materially to the bundled plugin size.
- EMF/WMF and optional embedded-PDF fallbacks are incomplete when PDF.js is
  disabled.
- Browser DOM behavior may differ across Obsidian installer/Electron versions.

## Validation performed in Ticket #2

- Generated a repository-owned one-slide PPTX.
- Parsed and rendered its real bytes through the candidate adapter.
- Verified visible slide text and a slide count of one.
- Verified abort-before-open and idempotent disposal.
- Built the bundled Obsidian plugin.
- Opened the fixture in a sandboxed Obsidian 1.12.7 instance and observed the
  ready state, slide text, and `1 / 1` counter.

## Sources

- [Upstream repository and API documentation](https://github.com/aiden0z/pptx-renderer)
- [Published npm package](https://www.npmjs.com/package/@aiden0z/pptx-renderer)
- [Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [WDIO Obsidian Service documentation](https://jesse-r-s-hines.github.io/wdio-obsidian-service/wdio-obsidian-service/README.html)
