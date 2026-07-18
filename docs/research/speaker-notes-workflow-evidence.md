# Speaker notes and Presentation content search evidence

- Status: Technical evidence for Spec #35 / Issues #36–#40
- Date: 2026-07-18
- Scope: installed production-build verification only; does not close M4

## Commands and versions

- Node / npm: repository `package.json` scripts
- Obsidian installed protocol: `wdio-obsidian-service` against desktop Obsidian
- Plugin version under test: `0.1.9`

Primary verification commands:

```bash
npm test
npx wdio run wdio.conf.mts --spec tests/e2e/pptx-speaker-notes.e2e.ts
npx wdio run wdio.conf.mts --spec tests/e2e/open-pptx.e2e.ts --spec tests/e2e/pptx-m2.e2e.ts
```

## Retained evidence

- Structurally real fixture: `tests/fixtures/speaker-notes.pptx`
- Notes-rich stress fixture: `tests/fixtures/performance/stress-200-slides.pptx`
  (200 notes parts with `Notes-only marker NNN`)
- Package inspection associates author paragraphs with stable slide identities
  and excludes notes-master / header / footer / date / slide-number decoys
- Renderer-session metadata exposes optional `speakerNoteContent`
- Reading session: collapsed-by-default notes panel, copy-with-reference,
  Presentation content search scopes, notes-match expand + highlight
- Installed evidence covers source SHA-256 integrity, offline/network guard,
  no persisted query/note text, and two-leaf isolation

## Combined implementation authorization

Repository owner `@jerry4pan` explicitly authorized this branch on 2026-07-18
to implement the combined Spec #35 scope mapped by Issues #36–#40. This
supersedes the earlier sequential-ticket assumption for this branch; the
individual issues remain the acceptance and traceability map and are not
implicitly closed by this authorization.

## Known limitations

- Rich-text styling inside notes is intentionally out of contract
- Main rendered-slide search highlighting remains out of scope
- Direct Markdown insertion remains out of scope
- The repository owner approved the exact Simplified and Traditional Chinese
  catalog at reviewed commit `975ef9e`; the review matrix in
  `docs/globalization/m3-message-review.md` is the durable record

## Non-claims

This evidence does not close or modify M4, claim real-reader workflow
validation, establish pricing, or authorize a public release.
