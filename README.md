# Obsidian Office Viewer

An experimental, desktop-only Obsidian plugin for reading local `.pptx` files
without converting them to PDF or uploading them to a service.

The M3 development build registers a dedicated PPTX view, reads source bytes
through the Obsidian Vault API, and renders them locally with the selected
`@aiden0z/pptx-renderer@1.2.4` adapter. It is not yet a public release.

The basic reading loop shows the current and total slide counts, supports
Previous, Next, and validated page-number jumps, and offers an Open in default
application fallback. Empty, loading, recoverable navigation, and blocking
open failures have explicit states. Malformed, incomplete, protected, and
renderer-incompatible inputs reach stable read-only error states with retry;
see `docs/compatibility/pptx-failure-handling.md`.

The M2 reading experience adds a scrollable, virtualized and resizable
thumbnail rail, keyboard navigation, automatic fit-to-window rendering, full
screen, independent state in each workspace leaf, and optional reading-position
recovery. Thumbnails render progressively:
the current slide is rendered first, adjacent slides are prefetched next, and
visible/overscan thumbnails use a single-concurrency background queue. Closing
a view or switching files cancels that work and releases mounted resources.

Keyboard reading uses `ArrowLeft` or `PageUp` for the previous slide and
`ArrowRight` or `PageDown` for the next slide. These shortcuts are ignored
while a button, input, select, textarea, or editable element has focus. Full
screen uses the desktop Fullscreen API and keeps the toolbar and thumbnail rail
available; use the Full screen control to enter or exit, or the platform Escape
behavior to leave full screen.

The main slide always fits the available reading pane; manual zoom controls are
not exposed. Drag the thumbnail rail's right edge to enlarge or shrink slide
previews. The preferred rail width defaults to `168px`, is constrained to
`120px`–`480px`, and is temporarily capped at 45% of the reading body in narrow
panes. Release the pointer to request high-resolution thumbnails. Double-click
the divider to reset it, or focus it and use Arrow keys (`16px`; `48px` with
Shift). The preferred width is shared across the Vault and restored after the
rail is collapsed and reopened. Navigation, thumbnail scroll, and full-screen
state remain independent for every open workspace leaf.

**Remember reading position** is enabled by default in the Office Viewer
settings. It stores only a Vault-relative path, file size, modification time,
zero-based slide index, and update timestamp. It never stores absolute paths,
slide text, images, author metadata, or rendered DOM. A changed fingerprint or
invalid slide index is discarded. Turning the setting off immediately clears
saved positions and prevents future position loads/saves; turning it back on
starts with no history. Rename events migrate only the Vault-relative key
while retaining the prior size/mtime fingerprint, so a rename combined with
content changes invalidates the saved page on the next open. Deletion events
remove entries.

M3 adds persistent compatibility warnings for known unsupported media and
local font substitution, separates resource-limit rejection from renderer
incompatibility, and routes legacy `.ppt` files to an explicit explanation
without reading or parsing them. Every readable or blocking view offers
**Copy diagnostic summary**. The copied JSON includes versions, source byte
size, slide count, timings, stable categories, and anonymous feature flags; it
excludes filenames, paths, presentation text, images, author metadata, URLs,
raw exceptions, and rendered content.

The complete plugin-owned interface follows Obsidian in English, Simplified
Chinese, or Traditional Chinese, with English fallback for other languages.

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

## Packaged install, upgrade, and uninstall

A release ZIP contains exactly `main.js`, `manifest.json`, and `styles.css`.
Extract those files to `<Vault>/.obsidian/plugins/office-viewer/`, reload
Obsidian, and enable **Office Viewer**. To upgrade, disable the plugin, replace
all three files from the new ZIP together, reload Obsidian, and re-enable it.
To uninstall, disable the plugin and remove the `office-viewer` directory; the
plugin never writes to source PPTX files.

## Development

```bash
npm install
npm run fixtures
npm run verify
npm run test:e2e
npm run test:compatibility
npm run test:performance
npm run test:performance:baseline
npm run release:check
npm run release:package
npm run test:release
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

`npm run release:check` requires package, manifest, compatibility-version, and
required documentation consistency. `npm run release:package` creates a
deterministic `dist/office-viewer-<version>.zip`. `npm run test:release`
installs that extracted ZIP into a clean test Vault, opens a real PPTX,
rehearses an in-place package upgrade, and verifies disable/removal without
network access or source mutation. Tag CI additionally requires `v<version>`
and proves a second package build is byte-identical before uploading the CI
artifact; public GitHub release creation remains M4.

## Current boundaries

- `.pptx` is the only parsed format; legacy `.ppt` receives an explicit local
  explanation and external-open fallback.
- Read-only and local; the plugin never writes back to the source file.
- Desktop Obsidian only; mobile and tablet are not supported.
- No Office, LibreOffice, PDF conversion, cloud renderer, or document server.
- Normal viewing does not upload presentation content, follow external
  relationships, execute macros/scripts, or make a network request.
- Rendering is a readable preview, not pixel-perfect PowerPoint fidelity;
  embedded SVG and other advanced content can degrade. Use **Open in default
  application** when the preview is not trustworthy.
- Known unsupported media and unavailable fonts produce persistent
  compatibility warnings. Unknown PowerPoint differences may still exist.
- Privacy and security details are in `PRIVACY.md` and `SECURITY.md`; reporting
  and contribution guidance is in `CONTRIBUTING.md`.
- M4 retains Beta validation, GitHub release publication, and Obsidian
  Community Plugins submission.
- Editing, saving, animations, legacy `.ppt` parsing, search, page links,
  embeds, notes, telemetry, accounts, licensing, and cloud services are out of
  scope.

## Test fixture

The committed minimal presentation is generated from repository-authored
content with PptxGenJS. See `tests/fixtures/README.md` for provenance.
