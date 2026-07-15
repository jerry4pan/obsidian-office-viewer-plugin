# M3 Compatibility, Diagnostics, and Release Quality Plan

## Invariants

- Local, offline, read-only `.pptx` viewing remains the default path.
- `.ppt` is explanation/fallback only; it is never parsed or converted.
- Renderer-specific objects, errors, and feature details remain behind the
  project-owned adapter and preflight boundaries.
- Diagnostic output contains stable categories and aggregate metadata only.
- New user-facing messages update all three supported catalogs together.
- Release preparation does not publish a release or submit to Obsidian.

## Vertical slices

1. Extend package inspection to return stable compatibility metadata and split
   resource-limit rejection from renderer incompatibility. Prove the corpus and
   failure fixtures at the package-inspection seam.
2. Surface readable warnings and the complete stable error vocabulary through
   `PptxViewSession`; route `.ppt` to the unsupported-legacy state without
   reading it. Prove all three message locales at the session/plugin seams.
3. Add a content-free diagnostic builder and copy action for ready, degraded,
   and error views. Prove deterministic fields, optional values, redaction, and
   clipboard failure at the builder/session seams.
4. Add translated settings explanations and the durable privacy, security,
   compatibility, contribution, and issue-reporting documents.
5. Add version/release checks and deterministic package generation, then CI
   workflows that verify ordinary commits and tagged artifacts.
6. Add packaged clean-Vault install, upgrade, and uninstall acceptance and
   retain the existing no-network/source-hash checks.
7. Run `npm run verify`, installed E2E, compatibility, performance-baseline,
   release, and packaged acceptance gates. Review `128bb87...HEAD` on standards
   and spec axes, resolve findings, and commit the completed M3 slice.
