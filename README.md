# Obsidian Office Viewer

A desktop Obsidian plugin for reading local `.pptx` files right inside
Obsidian — no PDF conversion, no uploads, no network requests.

## Features

**Reading**
- Open `.pptx` files directly from your Vault and read them slide by slide.
- Navigate with Previous / Next buttons, jump to any slide by number, or use
  `ArrowLeft` / `ArrowRight` and `PageUp` / `PageDown` keys.
- Each open file has its own independent reading position, thumbnail scroll
  state, and full-screen state across workspace panels.
- The current slide always fills the available reading area automatically.

**Thumbnails**
- A scrollable thumbnail strip shows previews of all slides alongside the main
  view.
- Thumbnails render progressively, starting with the slide you are on.
- Drag the right edge of the thumbnail strip to resize previews, double-click
  to reset, or use keyboard arrows when the divider is focused.

**Full screen**
- Enter full screen to use the full display while keeping the toolbar and
  thumbnail strip accessible.
- Exit with the on-screen control or the platform Escape key.

**Fallback**
- **Open in default application** sends the file to PowerPoint, Keynote, or
  your system default when the preview is not enough.

**Error handling**
- Corrupted, encrypted, or otherwise unreadable files show a clear explanation
  rather than a blank screen or a cryptic error.
- Legacy `.ppt` files are recognized and explained without attempting to parse
  them.
- Compatible files that run into a rendering problem show a warning while
  keeping the last readable slide visible.

**Reading position**
- **Remember reading position** (on by default) reopens each file at the slide
  you left off.
- Only a file fingerprint is stored — no slide text, images, paths, or personal
  data. Turn it off at any time to clear saved positions instantly.

**Compatibility awareness**
- When diagnostic summary is enabled, files with unsupported media or missing
  fonts display a persistent banner so you know when to double-check in an
  external application.

**Diagnostic summary**
- Off by default. Turn on **Diagnostic summary** in settings to show
  compatibility warnings and the copy control.
- **Copy diagnostic summary** captures versions, file size, slide count,
  timings, and stable categories for troubleshooting. It excludes filenames,
  paths, slide text, images, and any personal or rendered content.

**Languages**
- The interface supports English, Simplified Chinese, and Traditional Chinese,
  following your Obsidian language setting. Other languages fall back to
  English.

**Privacy**
- Everything stays local. The plugin never uploads files, phones home, or
  collects telemetry. Source files are never modified.

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

A release ZIP contains the three runtime files (`main.js`, `manifest.json`,
and `styles.css`) plus the project license, attribution notice, and bundled
renderer license. Extract all files to
`<Vault>/.obsidian/plugins/office-viewer/`, reload
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

`npm run release:check` requires package, manifest, compatibility-version,
supported-extension, license, and required-documentation consistency.
`npm run release:package` creates a
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
