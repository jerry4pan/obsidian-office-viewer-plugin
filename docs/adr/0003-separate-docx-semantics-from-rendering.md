---
status: accepted
---

# ADR-0003: Separate DOCX Semantics from Rendering

DOCX support uses a project-owned preflight and semantic extraction layer for
package safety, **Source-authored document body text**, session-local search
data, and degradation evidence. A
replaceable DOCX renderer adapter may turn a project-owned, in-memory sanitized
derivative of that local source into the **DOCX reading view**, but its internal
document model is not authoritative for **Document body search**. This keeps
the reading contract independent of unstable or lossy third-party
renderer internals, at the accepted cost of duplicate parsing and an explicit
mapping invariant between semantic paragraphs and rendered paragraphs. The
sanitized derivative is never written back to the vault.

## Considered options

- **Use the renderer's parsed model for all behavior:** rejected because the
  leading candidates either expose an unstable internal parse API or
  intentionally discard source structure.
- **Build a complete project-owned DOCX renderer:** rejected because recreating
  broad Word formatting support would delay the bounded reading/search scope.

## Consequences

The implementation verifies that rendered paragraphs map deterministically to
the project-owned semantic model, treats mapping disagreement as degradation or
failure rather than guessing, and keeps candidate-specific DOM and parser
details behind the renderer adapter. ADR-0005 separately defines the public
DOCX release scope and excludes stable paragraph references.
