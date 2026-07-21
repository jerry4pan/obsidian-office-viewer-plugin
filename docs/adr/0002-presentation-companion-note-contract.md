# ADR-0002: Presentation Companion Note Contract

- Status: Accepted
- Date: 2026-07-21
- Decision owners: project maintainers
- Scope: local PPTX **Presentation companion note** association in Obsidian
- Spec: GitHub Issue #53

## Context

Readers can already search PPTX **Knowledge material**, copy a **Slide
reference**, and use a source-driven **Slide embed**. Those actions still
require a separately chosen Markdown note and do not define a stable
presentation-level home for reader-authored understanding.

A new domain object is required: one **Presentation companion note** per PPTX.
The association must be explicit, local, and durable across Vault renames
without rewriting note bodies, overwriting user files, or depending on private
Obsidian layout APIs. Product material previously treated companion notes as a
possible paid differentiator; this decision authorizes an ungated local
technical capability only. It does not authorize public release, permanent
free packaging, or **Real-reader workflow validation**.

## Decision

1. **Canonical healthy path.** For a claimed relationship, the healthy note
   path is the PPTX's directory plus the PPTX basename with a `.md` extension.
   Same-directory/same-basename is a discoverable convention, not the identity
   of the relationship.

2. **Explicit claim only.** Opening a PPTX never creates or adopts a Markdown
   note. Creation or adoption happens only when the reader invokes the viewer
   action. An incidental same-name Markdown is adopted byte-for-byte unchanged
   only after that explicit action; the plugin never appends a template,
   frontmatter, or source marker during adoption.

3. **Relationship identity.** Persist only a map of normalized Vault-relative
   `sourcePath` (`.pptx`) and `notePath` (`.md`) pairs. Do not persist note
   text, slide text, images, speaker notes, search queries, renderer state,
   Workspace leaf state, or a separate mutable conflict flag. Healthy versus
   **Companion note path conflict** is derived by comparing `notePath` with the
   canonical path for `sourcePath`.

4. **Source-led migration.** When a claimed PPTX is renamed or moved inside the
   Vault and the canonical target is free, move the claimed note to that target
   and update the pair. Never modify PPTX bytes. Plugin-initiated note moves
   must be marked so the resulting Vault rename is not treated as an independent
   user rename.

5. **Conflict authority.** If the canonical target is occupied by any file or
   folder, update `sourcePath`, retain the previous `notePath`, and surface a
   **Companion note path conflict**. The previously claimed note remains
   authoritative. Opening during conflict opens that note. The next explicit
   open retries migration only after the target becomes free. Never overwrite,
   delete, rename-away, or adopt the occupying target.

6. **Detach without cascade.** Independently renaming or moving the claimed
   Markdown deletes the relationship and retains both files. Deleting either
   endpoint deletes only the relationship and retains the other endpoint. A
   deleted note is recreated only after another explicit open. Invalid pairs
   discovered on plugin load detach by exact-path validation only—no Vault-wide
   scanning, fingerprinting, or fuzzy reassociation.

7. **Workspace boundary.** Session-owned companion leaves live in the invoking
   PPTX file view. Create a right-side vertical split from that leaf through the
   public Workspace API so main-window and pop-out containers are preserved.
   Reuse the owned leaf only while it still shows the claimed note. Do not
   recover adjacency after restart via private layout trees or DOM inspection.

## Alternatives considered

### Configurable note folder or filename pattern

Rejected for the first slice. Configurable locations weaken the
outside-the-plugin discoverability of the same-name convention and expand the
conflict surface before the basic claim/migrate/detach contract is proven.

### Automatic adoption on PPTX open

Rejected. Merely viewing a presentation must not write the Vault. Explicit
claim keeps incidental same-name Markdown files untouched until the reader asks.

### Persisting a conflict status field

Rejected. A second mutable status can drift from the path pair. Deriving
conflict from `notePath !== canonical(sourcePath)` keeps one source of truth.

### Content-based or Vault-wide reassociation after detach

Rejected. Fingerprints, basename scans, and fuzzy matching can attach unrelated
notes after offline renames. Exact-path validation with safe detach is the
reversible, privacy-preserving default.

### Restart-time leaf adjacency recovery

Rejected. Public Workspace APIs do not provide a stable direct-adjacent-leaf
query. Accepting a fresh right split after restart preserves the public-API
boundary.

## Consequences

- Plugin data schema upgrades to version 2 with a companion-note relationship
  map while retaining valid settings and reading positions.
- Companion relationships are independent of the remember-reading-position
  setting.
- Source wikilink rewriting inside Markdown remains Obsidian's native
  automatic-link-update behavior; the plugin updates only its path pair.
- The viewer exposes a compact companion-note action for `.pptx` in every
  viewing state once the source path is known; legacy `.ppt` is excluded.
- Documentation must distinguish source-PPTX read-only guarantees from the
  explicit user-triggered Markdown write path.
- Passing technical verification does not authorize release, pricing, or
  real-reader workflow claims.

## Follow-up

Implementation is tracked by GitHub Issues #54–#58 under Spec #53.
