# DOCX Knowledge Reference Loop Technical Exploration

- Status: Concluded - NO-GO
- Date: 2026-07-31
- Branch: `codex/docx-knowledge-reference-exploration`
- Scope: local, read-only `.docx` technical exploration only

This document is historical evidence for the rejected stable-reference scope.
The accepted release scope is now defined by
[`../prd/docx-reading-search-release.md`](../prd/docx-reading-search-release.md)
and ADR-0005.

## Result

The exploration is a NO-GO for the agreed paragraph-reference contract. A
Microsoft Word 16.111.2 native round trip showed that `w14:paraId` is not a
stable identity for every required edit:

- moving the target paragraph assigned it a new identity, so an identity-only
  resolver cannot follow the move;
- splitting the target kept the old identity on only one fragment, so the
  proposed resolver would falsely bind the original reference to that
  fragment instead of reporting the split as unavailable.

Both violate hard gates, and the agreed contract prohibits ordinal or
similar-text fallback. Both renderer candidates also materialized every
stress-fixture paragraph in the DOM, violating the bounded-DOM gate. The full
evidence is recorded in
[`docx-exploration-results-2026-07-31.md`](docx-exploration-results-2026-07-31.md).
No release contract, public support claim, or release path is changed.

## Purpose

This exploration tests whether **Body-led DOCX knowledge material** can complete
the **Knowledge reference loop** without changing the source, using a
**DOCX reading view**, **Document body search**, **Sourced paragraph copy**, and
a **Word paragraph reference**. It does not add DOCX to the release contract,
authorize a public release, complete M4, or establish real-reader workflow
value.

The first complete scenario is:

1. Open one local `.docx` in a continuous semantic reading view.
2. Search its **Source-authored document body text** for one paragraph.
3. Activate the result and copy the complete paragraph plus its canonical
   source reference into Markdown.
4. Follow that reference in a later session.
5. Resolve the same native paragraph identity or report it unavailable without
   ordinal or similar-text fallback.

## Product boundaries

- Only `.docx` is explored. Legacy `.doc`, macro-enabled `.docm`, and templates
  are excluded.
- The first target is prose-led reports, research material, proposals,
  memoranda, and explanatory documents. Layout-led forms, mail merge,
  brochures, and print artifacts are not target material.
- Rendering preserves reader-meaningful headings, paragraphs, lists, tables,
  inline images, and links in continuous flow. Word pagination, print-layout
  fidelity, and pixel equivalence are not success criteria.
- Search includes final-view visible main-body headings, ordinary paragraphs,
  list items, and paragraphs in table cells. It includes inserted revisions and
  excludes deleted revisions, revision metadata, hidden text, headers, footers,
  footnotes, endnotes, comments, and text boxes.
- Search state is session-local and is never persisted or added to a Vault-wide
  index.
- One result represents one paragraph regardless of match count.
- One active paragraph is selected by direct activation or search navigation.
  One toolbar action copies its entire text plus one reference. Character
  ranges, multi-paragraph ranges, and live paragraph embeds are excluded.
- DOCX companion notes and persistent DOCX reading positions are excluded.

## Identity and reference contract

The source must supply a unique, valid, render-mappable native identity for
every searchable non-empty body paragraph. This is an all-or-nothing
document-level gate. The plugin never writes identities into the DOCX, creates
synthetic identities, or enables references for only a subset of paragraphs.

The canonical fragment is:

```text
#paragraph-id=<UPPERCASE-HEX>&paragraph=<creation-ordinal>
```

For example:

```md
Market conditions changed materially.

[[reports/market.docx#paragraph-id=2673269E&paragraph=17|market — Paragraph 17]]
```

The identity is the only resolution key. The one-based creation ordinal counts
searchable non-empty paragraphs in canonical main-body order, including
headings, list items, and table-cell paragraphs. It excludes empty paragraphs,
hidden and deleted revision content, excluded stories, and object-only
unavailable-content placeholders. The visible alias follows the active message
locale for newly copied references; the link target is locale-neutral and
existing Markdown is never rewritten.

A resolved reference opens the DOCX, reveals and activates the identity, and
reports both creation-time and current ordinals when they differ. A missing or
duplicate identity opens the source in an unavailable-reference state and
never falls back to an ordinal or similar text.

## Interaction and trust boundaries

- The source DOCX is byte-for-byte read-only.
- Normal opening, rendering, searching, and reference resolution perform no
  network request.
- Reader-visible main-body content that cannot be represented gets an in-flow
  placeholder and a visible document-level degradation notice. It is never
  silently omitted.
- External resources are never fetched. Source-authored `https`, `http`, and
  `mailto` hyperlinks may open only after explicit reader activation. Other
  protocols, local absolute paths, UNC paths, automatic navigation, previews,
  and downloads are blocked.
- An internal bookmark link may activate the unique main-body paragraph that
  owns its target for the current session. Missing, duplicate, or excluded
  targets are unavailable and do not create persistent Markdown references.
- A default-application action remains available as the fidelity fallback.

## Architecture

ADR-0003 separates the project-owned DOCX preflight and semantic model from a
replaceable renderer adapter. The project-owned layer owns:

- ZIP and XML safety limits;
- relationship and active-content policy;
- final-view main-body paragraph order and text;
- native paragraph identity validation;
- search data and creation ordinals;
- bookmark and hyperlink classification;
- unavailable-content evidence.

The renderer receives a project-owned, in-memory sanitized derivative of the
same local bytes and produces the reading DOM. The derivative removes excluded
revisions, hidden runs, unsupported embedded objects, and unsafe external
resource relationships before third-party code sees the package; it is never
persisted. The adapter must expose a deterministic one-to-one mapping for every
searchable paragraph; candidate-specific parsed objects and DOM details remain
behind it. Mapping disagreement degrades or fails safely instead of guessing.

An independent `DocxFileView` owns continuous-document state. It may share
cross-format cancellation, diagnostics, external-open, localization, and
security primitives, but it does not add format branches to `PptxFileView`.

## Candidate comparison

The same adapter contract, corpus, thresholds, and installed-Obsidian protocol
compare exact-pinned candidates:

- `mammoth@1.10.0`
- `docx-preview@0.3.6`

Only one candidate is included in a measured build at a time. Selection waits
for evidence and, if successful, requires a separate accepted renderer ADR.

## Fixed corpus

The committed corpus combines:

- generated contract fixtures for identities present and absent, duplicate
  text, moves and edits, final-view revisions, headings, lists, tables, images,
  links, bookmarks, unavailable content, and English/CJK text;
- redistributable real-style reports, research documents, proposals, and long
  documents;
- malformed ZIP/XML, encrypted, external-resource, active-content, entry-count,
  uncompressed-size, and XML-size failure fixtures.

Private reader documents may supplement observation but are never committed or
used as the only acceptance evidence. Both candidates receive identical bytes
and expectations.

## Correctness gates

- At least 90% of target corpus documents have readable main-body content.
- Every in-scope paragraph is searchable with no normalized text omission.
- Every stable edit scenario for every **Reference-capable DOCX** resolves the
  correct identity.
- False reference resolution count is exactly zero.
- Every detected, unrepresentable main-body unit has a placeholder and visible
  degradation notice.
- Every malformed, encrypted, external-resource, and active-content fixture
  fails safely.
- Normal opening performs no network request and never modifies source bytes.

## Initial performance gates

On the fixed reference device in installed Obsidian:

- representative DOCX first-readable p95 is at most 3,000 ms;
- full-document search-ready p95 is at most 3,000 ms;
- indexed-query p95 is at most 100 ms;
- cancellation and resource cleanup complete within 2,000 ms;
- the stress fixture has a recorded memory baseline and does not create an
  unbounded all-content DOM on open.

Representative and stress fixtures are defined by paragraph count, tables,
images, ZIP entry count, and uncompressed size rather than unstable page count.

## Native editor validation

Generated OOXML manipulation does not prove identity stability. A GO requires
normal Microsoft Word round trips with exact product version, timestamps,
before/after SHA-256 hashes, and extracted paragraph identities for:

- inserting and deleting paragraphs before the target;
- editing target text and formatting;
- moving the target;
- deleting, splitting, and merging the target;
- save, close, reopen, and save again.

LibreOffice and Google Docs export evidence records whether the resulting DOCX
is reference-capable. Those producers may be read/search-only; the exploration
does not synthesize identities for them.

Microsoft Word 16.111.2 validation was completed on 2026-07-31. WPS Office
12.1.24031 was present as a possible supplementary producer, but further
producer testing could not change the NO-GO after the Microsoft Word native
identity contract failed.

## Stop condition

If neither candidate passes every hard correctness and safety gate, the result
is NO-GO. The exploration does not combine both renderers, introduce cloud
viewers, use Office or LibreOffice as a default conversion service, or weaken
the gates. A GO authorizes only a follow-up implementation proposal, not a
release.
