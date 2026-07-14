# Obsidian Office Viewer

An experimental, desktop-only Obsidian plugin for reading local `.pptx` files
without converting them to PDF or uploading them to a service.

The M1 development build registers a dedicated PPTX view, reads source bytes
through the Obsidian Vault API, and renders them locally with the selected
`@aiden0z/pptx-renderer@1.2.4` adapter. It is not yet a public release.

The basic reading loop shows the current and total slide counts, supports
Previous, Next, and validated page-number jumps, and offers an Open in default
application fallback. Empty, loading, recoverable navigation, and blocking
open failures have explicit states. Malformed, incomplete, protected, and
renderer-incompatible inputs reach stable read-only error states with retry;
see `docs/compatibility/pptx-failure-handling.md`.

## Development install

Requirements: desktop Obsidian, Node.js 22, and npm.

```bash
npm install
npm run build
mkdir -p /path/to/vault/.obsidian/plugins/office-viewer
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/office-viewer/
```

Enable **Office Viewer** under Community plugins, then open a `.pptx` from the
Vault file explorer. Rebuild and copy the same three files after source
changes. `npm run test:e2e` performs the equivalent build-and-install path in a
sandboxed test Vault without using a personal Obsidian configuration.

## Development

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
current machine and writes ignored evidence under
`artifacts/performance/aiden-pptx-renderer-1.2.4/`. The committed
reference-machine result for `@aiden0z/pptx-renderer@1.2.4` is
`tests/performance/baselines/aiden-pptx-renderer-1.2.4.json`, with the matching
human-readable report in
`docs/performance/aiden-pptx-renderer-1.2.4.md`. Validate the committed evidence
shape and fixed gate calculation with `npm run test:performance:baseline`.

To refresh the reference baseline, run `npm run test:performance` without
changing its samples or thresholds, inspect the recorded verdict, then copy
`artifacts/performance/aiden-pptx-renderer-1.2.4/results.json` and
`artifacts/performance/aiden-pptx-renderer-1.2.4/summary.md` byte-for-byte over
those two committed files. Run
`npm run test:performance:baseline` after the copy. A budget miss remains valid
evidence and must be committed as FAIL rather than tuned away.

## Current boundaries

- `.pptx` only; legacy `.ppt` is not supported.
- Read-only and local; the plugin never writes back to the source file.
- No Office, LibreOffice, PDF conversion, cloud renderer, or document server.
- Thumbnails, zoom, keyboard navigation, full-screen mode, and reading-position
  persistence remain M2 work.
- General compatibility warnings, diagnostics, release packaging, and public
  submission remain M3/M4 work.

## Test fixture

The committed minimal presentation is generated from repository-authored
content with PptxGenJS. See `tests/fixtures/README.md` for provenance.
