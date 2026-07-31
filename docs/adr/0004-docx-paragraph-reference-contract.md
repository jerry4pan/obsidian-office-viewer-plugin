---
status: rejected
---

# ADR-0004: DOCX Paragraph Reference Contract

A **Word paragraph reference** uses one canonical Obsidian wikilink fragment:
`#paragraph-id=<UPPERCASE-HEX>&paragraph=<creation-ordinal>`. For example,
`[[reports/market.docx#paragraph-id=2673269E&paragraph=17|market — Paragraph 17]]`.
`paragraph-id` is the only target identity; the positive `paragraph` value
records the creation-time position for human context and diagnostics and must
never be used as a fallback. A missing identity is reported as unavailable
rather than redirected to the current paragraph at that ordinal.

Following a valid reference opens the DOCX, scrolls to and activates the target
paragraph, and briefly highlights it. If its current ordinal differs, the view
reports both creation-time and current ordinals. A missing or duplicate identity
opens the source in an unavailable-reference state without activating an
ordinal or similar-text substitute; a missing source retains Obsidian's normal
missing-file behavior.

The creation-time ordinal is the one-based position among searchable non-empty
paragraphs in canonical main-body document order, including headings, list
items, and paragraphs inside table cells. Empty paragraphs, hidden or deleted
revision content, excluded content stories, and object-only unavailable-content
placeholders do not increment it.

The first exploration accepts the exact field order and canonical encoding
only. **Sourced paragraph copy** writes one complete paragraph followed by a
blank line and the ordinary wikilink. Its visible alias uses the active
**Message locale**, matching the existing PPTX reference behavior; changing
locale affects only newly copied aliases and never rewrites existing Markdown.
The link target and fragment remain locale-neutral. An image-style `![[...]]`
form is outside the exploration because live paragraph embedding has not been
authorized.

This contract mirrors the existing PPTX stable-identity plus creation-ordinal
shape while keeping slide and paragraph namespaces explicit. Microsoft Word
16.111.2 technical validation rejected it: moving a paragraph assigned a new
`w14:paraId`, while splitting a paragraph preserved the old identity on only
one fragment and would create a false binding. The evidence is recorded in
[`../research/docx-exploration-results-2026-07-31.md`](../research/docx-exploration-results-2026-07-31.md).
Rejection does not authorize a fallback identity, a reduced contract, or a
public DOCX release.
