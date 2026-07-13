# Obsidian Office Viewer

An experimental, desktop-only Obsidian plugin for opening local `.pptx` files
without converting them to PDF or uploading them to a service.

The current M0 tracer bullet opens a PPTX from the Vault and renders slide 1.
It is not yet a public release and does not represent a final renderer choice.

## Development

Requirements: Node.js 22 and npm.

```bash
npm install
npm run fixtures
npm run verify
npm run test:e2e
npm run test:compatibility
npm run test:performance
npm run test:performance:baseline
```

`npm run test:e2e` downloads and launches a sandboxed Obsidian instance. It
does not use the normal Obsidian configuration or a personal Vault.

`npm run test:compatibility` opens the representative corpus through the same
installed plugin path, captures fixed-environment screenshots, compares them
with approved visual baselines, and writes ignored run artifacts under
`artifacts/compatibility/`. The first renderer currently scores 90.0% readable
main content and meets the 80% M0 gate with known SVG degradation; see
`docs/compatibility/aiden-pptx-renderer-1.2.4.md`.

`npm run test:performance` repeats the installed-Obsidian benchmark on the
current machine and writes ignored evidence to `artifacts/performance/`. The
committed reference-machine result for `@aiden0z/pptx-renderer@1.2.4` is
`tests/performance/baselines/aiden-pptx-renderer-1.2.4.json`, with the matching
human-readable report in
`docs/performance/aiden-pptx-renderer-1.2.4.md`. Validate the committed evidence
shape and fixed gate calculation with `npm run test:performance:baseline`.

To refresh the reference baseline, run `npm run test:performance` without
changing its samples or thresholds, inspect the recorded verdict, then copy
`artifacts/performance/results.json` and `artifacts/performance/summary.md`
byte-for-byte over those two committed files. Run
`npm run test:performance:baseline` after the copy. A budget miss remains valid
evidence and must be committed as FAIL rather than tuned away.

## Current boundaries

- `.pptx` only; legacy `.ppt` is not supported.
- Read-only and local; the plugin never writes back to the source file.
- No Office, LibreOffice, PDF conversion, cloud renderer, or document server.
- The installed path has previous/next navigation and candidate-independent
  timing instrumentation. Thumbnails and compatibility warnings remain later
  M0/M1 work.

## Test fixture

The committed minimal presentation is generated from repository-authored
content with PptxGenJS. See `tests/fixtures/README.md` for provenance.
