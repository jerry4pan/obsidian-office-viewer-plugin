---
status: accepted
---

# ADR-0006: Add Optional DOCX Layout View

DOCX readers may need a page-grouped layout surface in addition to the default
continuous **DOCX reading view**. The product adds an explicit, session-local
**DOCX layout view** that keeps `docx-preview@0.3.6` behind the existing
renderer adapter seam, switches render profiles without caching two DOM trees,
and never claims live Word pagination or print fidelity.

## Decision

- Default every file open to reading view. Do not persist mode across files or
  sessions.
- Keep one replaceable `DocxRendererAdapter` with `open(buffer, model, options)`
  returning an unmounted session that mounts atomically into the reading body.
- Use reading and layout render profiles inside `DocxPreviewRendererAdapter`
  only. Do not introduce a second shallow adapter for profile differences.
- Disable layout for bounded/simplified large documents. Layout failure during
  a user switch keeps the previous reading DOM and shows a non-blocking status.
- Exclude headers, footers, footnotes, endnotes, comments, and text boxes from
  new semantic support in this release. Do not render auxiliary stories that
  would bypass project-owned inspection.
- Treat `section.docx` pages as break evidence, not an authoritative page count.

## Consequences

Search, paragraph ordinals, hyperlink/bookmark policy, and unavailable-content
detection remain owned by `DocxSemanticModel`. Mapping must support
cross-page paragraph fragments with exact ordered character equality. Product
copy and README must describe layout view without “print-identical” or
“Word-accurate pagination” claims.
