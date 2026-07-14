# Obsidian Office Viewer

An experimental, desktop-only Obsidian plugin for reading local `.pptx` files
without converting them to PDF or uploading them to a service.

The M2 development build registers a dedicated PPTX view, reads source bytes
through the Obsidian Vault API, and renders them locally with the selected
`@aiden0z/pptx-renderer@1.2.4` adapter. It is not yet a public release.

The basic reading loop shows the current and total slide counts, supports
Previous, Next, and validated page-number jumps, and offers an Open in default
application fallback. Empty, loading, recoverable navigation, and blocking
open failures have explicit states. Malformed, incomplete, protected, and
renderer-incompatible inputs reach stable read-only error states with retry;
see `docs/compatibility/pptx-failure-handling.md`.

The M2 reading experience adds a scrollable, virtualized thumbnail rail,
keyboard navigation, zoom, full screen, independent state in each workspace
leaf, and optional reading-position recovery. Thumbnails render progressively:
the current slide is rendered first, adjacent slides are prefetched next, and
visible/overscan thumbnails use a single-concurrency background queue. Closing
a view or switching files cancels that work and releases mounted resources.

Keyboard reading uses `ArrowLeft` or `PageUp` for the previous slide and
`ArrowRight` or `PageDown` for the next slide. These shortcuts are ignored
while a button, input, select, textarea, or editable element has focus. Full
screen uses the desktop Fullscreen API and keeps the toolbar and thumbnail rail
available; use the Full screen control to enter or exit, or the platform Escape
behavior to leave full screen.

Zoom starts in fit-to-window mode at `100%`. Zoom in/out enters view-local
manual mode in 25-point steps, clamped to `25%`–`400%`. Pane resize recomputes
the fitted scale while retaining the manual multiplier; **Fit** returns to
fit-to-window at `100%`. Navigation, zoom, thumbnail scroll, and full-screen
state are independent for every open workspace leaf.

**Remember reading position** is enabled by default in the Office Viewer
settings. It stores only a Vault-relative path, file size, modification time,
zero-based slide index, and update timestamp. It never stores absolute paths,
slide text, images, author metadata, or rendered DOM. A changed fingerprint or
invalid slide index is discarded. Turning the setting off immediately clears
saved positions and prevents future position loads/saves; turning it back on
starts with no history. Rename and deletion events migrate or remove entries.

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
does not use the normal Obsidian configuration or a personal Vault. Six cases
exercise the production adapter; a separate installed case uses a test-only
adapter to inject one recoverable slide failure, then rebuilds the production
bundle before exiting.

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
- Desktop Obsidian only; mobile and tablet are not supported.
- No Office, LibreOffice, PDF conversion, cloud renderer, or document server.
- Normal viewing does not upload presentation content, follow external
  relationships, execute macros/scripts, or make a network request.
- Rendering is a readable preview, not pixel-perfect PowerPoint fidelity;
  embedded SVG and other advanced content can degrade. Use **Open in default
  application** when the preview is not trustworthy.
- M3 retains complete compatibility-warning surfaces, privacy/security and
  compatibility documentation, content-free diagnostic export, CI/release
  asset generation, and packaged clean-Vault install/upgrade/uninstall proof.
- M4 retains Beta validation, GitHub release publication, and Obsidian
  Community Plugins submission.
- Editing, saving, animations, legacy `.ppt`, search, page links, embeds,
  notes, telemetry, accounts, licensing, and cloud services are not M2 work.

## Test fixture

The committed minimal presentation is generated from repository-authored
content with PptxGenJS. See `tests/fixtures/README.md` for provenance.
