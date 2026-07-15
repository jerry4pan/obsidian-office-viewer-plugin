# M3 Compatibility, Diagnostics, and Release Quality Design

- Status: Implemented; human language approval pending
- Date: 2026-07-15
- Source: `docs/prd/v0.1-first-public-release.md`, M3
- Baseline: M2 plus the approved English/Simplified Chinese/Traditional Chinese UI

## Adjustment to the original M3 framing

M3 still owns the seven PRD deliverables and five exit conditions. The current
code changes how they should be implemented in four ways:

1. M2 already has a strong package preflight, failure corpus, visual baseline,
   installed no-network checks, source hashes, and lifecycle diagnostics. M3
   extends those seams instead of introducing a second inspection pipeline.
2. The current `incompatible` category covers both unsupported content and
   bounded resource rejection. M3 separates `resource-exhausted` so diagnostic
   reports can group failures accurately without renderer details.
3. A completed multilingual UI now makes every new warning, error, diagnostic
   action, and setting description part of the three-catalog contract and the
   installed locale smoke path.
4. M3 prepares immutable release assets but does not publish a GitHub release
   or submit to Community Plugins; those external actions remain M4.

## Product behavior

### Stable compatibility and failure vocabulary

Blocking open failures use these stable, untranslated identifiers:

- `unsupported-legacy`: a `.ppt` file intentionally routed to an explanation;
- `protected`: encrypted or password-protected OOXML;
- `malformed`: invalid or incomplete PPTX packaging;
- `incompatible`: unsafe active/external content or renderer incompatibility;
- `resource-exhausted`: a package rejected by explicit bounded-size limits;
- `cancelled`: a current load cancelled outside normal view replacement/close;
- `unknown`: a failure that cannot be classified more specifically.

Normal close, file switch, plugin unload, and stale-generation cancellation
remain silent lifecycle events. They must not flash a blocking error.

Readable documents can carry non-blocking compatibility warning categories:

- `unsupported-content`: package features with a known renderer limitation,
  initially SVG, EMF, WMF, or embedded PDF media;
- `font-substitution`: at least one declared presentation font is unavailable
  in the current browser environment.

Warnings remain visible while the document is readable and always retain the
external-open fallback. They contain no filename, path, slide text, font name,
or candidate exception.

### Content-free diagnostic summary

Every ready, degraded, or blocking-error view exposes **Copy diagnostic
summary**. The copied, deterministic JSON contains only:

- schema version;
- plugin, Obsidian, renderer, and operating-system versions/identifiers;
- source byte size and slide count when known;
- stable lifecycle state, warning categories, or error category;
- open/first-readable/last-switch timings when known;
- anonymous feature flags for thumbnails, prefetch, remembered position, and
  external-open availability.

The summary never contains filename, Vault-relative or absolute path, text,
images, author metadata, URLs, raw exceptions, or rendered DOM. Clipboard
failure is reported locally and does not replace the readable/error state.

### Settings and documentation

The settings page keeps the existing reading-position toggle and adds
non-interactive, translated explanations of local processing, compatibility,
and diagnostic contents. Durable English release documentation covers privacy,
security, compatibility, installation/upgrade/uninstall, contribution, and
issue reporting. Publishing copy localization remains outside the approved
multilingual UI scope.

## Release engineering

- `npm run release:check` validates package/manifest/versions consistency,
  required files, supported extension declarations, and an optional `vX.Y.Z`
  tag supplied by CI.
- `npm run release:package` performs a production build and creates a
  deterministic `dist/office-viewer-X.Y.Z.zip` containing the three Obsidian
  runtime files plus the project license, attribution notice, and bundled
  renderer license, all with fixed entry metadata.
- CI runs the fast/full verification and release checks on pushes and pull
  requests. A tag workflow rebuilds, verifies the tag/version match, creates
  the asset, proves a second build is byte-identical, and uploads the artifact
  without publishing a GitHub release.
- Packaged acceptance starts from an empty test Vault, installs the ZIP,
  verifies the plugin can be enabled and open a PPTX, overlays a second package
  as an upgrade without changing the source, and disables/removes the plugin
  without leaving plugin files or corrupting the Vault source.

## Public test seams

TDD uses the existing public boundaries:

1. package inspection and renderer-session compatibility metadata;
2. `PptxViewSession` DOM states/actions and copied diagnostic text;
3. plugin extension registration and settings DOM;
4. release-check/package CLI file contracts;
5. installed Obsidian behavior from a packaged clean Vault.

## Completion boundary

M3 is complete when all PRD deliverables and exit conditions have direct
evidence, the multilingual contract remains green, the full repository suite
passes, and a dual-axis review finds no unresolved Critical or Important
issue. Beta recruitment, public GitHub release creation, and Community Plugins
submission remain M4.
