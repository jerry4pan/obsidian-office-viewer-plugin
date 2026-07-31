# DOCX Reading and Search Release

- Status: Accepted
- Date: 2026-07-31
- Scope: first public `.docx` support

## Outcome

Desktop Obsidian users can open local body-led `.docx` files, read their
main-body content in a continuous view, search the current document, and jump
to a matching paragraph without modifying or uploading the source.

## Included behavior

- Register `.docx` with a dedicated file view alongside the existing PPTX
  view. Legacy `.doc` and macro-enabled `.docm` remain unsupported.
- Present final-view main-body headings, paragraphs, lists, tables, embedded
  images, and hyperlinks in document order. Include inserted changes; exclude
  deleted changes, hidden text, headers, footers, notes, comments, and text
  boxes.
- Rasterize common placeable Windows metafiles and Office charts that carry
  usable cached series data into local PNG previews before display. Exact Word
  print layout and unsupported chart types remain outside fidelity claims.
- Search all visible main-body text in the current open document through the
  same toggleable search panel interaction as PPTX slide search. Return one
  result per matching paragraph with a match count and readable excerpt.
- Activate, reveal, and visibly highlight a result in the current session.
  `Cmd+F`/`Ctrl+F` opens the document search panel and focuses its field;
  `Escape` closes it.
- Preserve explicit `http`, `https`, and `mailto` hyperlinks and unique
  main-body bookmark jumps. Never prefetch or automatically open them.
- Mark every detected unrepresentable main-body unit with an in-flow
  placeholder and a visible document-level notice.
- Offer **Open in default application** as the fidelity fallback.
- Localize all DOCX-owned interface text in English, Simplified Chinese, and
  Traditional Chinese.

## Explicit exclusions

- Stable DOCX paragraph references, sourced paragraph copy, and DOCX embeds.
- Persistent DOCX reading position, companion notes, and Vault-wide search.
- Word pagination, print-layout fidelity, editing, conversion, OCR, and cloud
  viewers.

## Safety and correctness gates

- The source file remains byte-for-byte unchanged after open, search,
  navigation, error, cancellation, close, and plugin unload.
- Normal open and search make zero network requests.
- Malformed, encrypted, active-content, external-resource, ZIP-limit, and
  XML-limit fixtures fail safely with stable user-facing categories.
- Every extracted in-scope paragraph is searchable and maps to exactly one
  rendered or virtualized paragraph location.
- At least 90% of the fixed body-led compatibility corpus opens with readable
  main-body content; detected omissions are never silent.

## Installed performance gates

On the fixed installed-Obsidian reference environment:

- representative first-readable p95 is at most 3,000 ms;
- full-document search-ready p95 is at most 3,000 ms;
- indexed-query p95 is at most 100 ms;
- cancellation and cleanup complete within 2,000 ms;
- the 5,000-paragraph stress document never creates more than 1,200 rendered
  document-body DOM elements during open or after ready, and records a bounded
  memory baseline.

## Release gates

- The normal production entry owns DOCX registration; no exploration-only
  entry or candidate switch is required at runtime.
- `release-contract.json`, manifest/package descriptions, README files,
  privacy/security copy, licenses, and release packaging describe the same
  supported scope.
- Unit, integration, full regression, installed E2E, compatibility,
  performance, release packaging, and production dependency audit checks pass.
