# Installed DOCX compatibility result

- Status: PASS
- Captured: 2026-07-31
- Environment: macOS arm64, Obsidian 1.12.7, installer 1.12.7
- Renderer: `docx-preview@0.3.6` with project-owned semantic inspection
- Result: 4 of 4 fixed body-led documents readable (100%)
- Required gate: at least 90%

The installed corpus covers headings, body paragraphs, lists, tables, inline
images, external and bookmark links, paragraphs without native identities,
final revision text, hidden/deleted text exclusion, and visible placeholders
for detected unrepresentable content. Every extracted paragraph mapped to one
rendered location. The installed run blocked network APIs and observed no
requests.

Layout view is an optional session-local mode on the same corpus. It uses the
pinned renderer’s page-break and section geometry evidence and does not claim
live Word pagination or print-identical fidelity. Compatibility runs should
toggle layout for rich-preview documents and keep at least 90% layout-readable
while preserving body markers and paragraph mapping.

The corresponding acceptance spec is
`tests/e2e/docx-compatibility.compatibility.ts`; the same committed corpus is
also checked by `tests/docx/docx-candidate-corpus.test.ts` and exact semantic
mapping tests.
