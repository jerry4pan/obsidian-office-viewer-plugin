# PowerPoint slide identity validation protocol

This reusable protocol tests normal Microsoft PowerPoint editing, not OOXML
manipulation by repository tools. It was completed on 2026-07-18 with
PowerPoint for Mac 16.111 (26071325); the portable result is recorded in
`powerpoint-slide-id-validation-16.111.json`.

## Environment to record

- Microsoft PowerPoint product and full version number.
- macOS or Windows version.
- Whether AutoSave is enabled. Either state is acceptable, but record it.

## Prepare the edited fixture

1. In Finder or Explorer, duplicate
   `tests/fixtures/performance/representative-12-slides.pptx` as
   `powerpoint-edited.pptx`. Do not use PowerPoint Save As for this initial copy.
2. Open `powerpoint-edited.pptx` in Microsoft PowerPoint.
3. Confirm the original slide 6 contains the marker
   `Representative benchmark slide 6`.
4. Insert one new blank slide before slide 1.
5. Move the marked target slide to position 3.
6. Edit its title by appending ` — PowerPoint round-trip`.
7. Use the normal Save command, close PowerPoint, reopen the file, confirm the
   inserted slide, position, and edited title, then close it again.

## Prepare the deletion fixture

1. In Finder or Explorer, duplicate `powerpoint-edited.pptx` as
   `powerpoint-deleted.pptx`.
2. Open the duplicate in PowerPoint, delete slide 3 (the marked target), use the
   normal Save command, close, reopen, confirm the deletion, and close it.

## Verify

From the repository root, run:

```sh
node scripts/verify-powerpoint-slide-id-evidence.mjs \
  --edited /absolute/path/to/powerpoint-edited.pptx \
  --deleted /absolute/path/to/powerpoint-deleted.pptx \
  --powerpoint-version "record the exact version here"
```

A passing report proves that native slide ID `261` survived insertion,
reordering, the required title edit, normal save, close, and reopen; moved to
current ordinal 3; and disappeared after deletion. It also requires the
deleted identity sequence to equal the edited sequence with only `261`
removed. Retain the two maintainer-supplied PPTX files outside the repository
and commit only portable metadata, hashes, identity sequences, and check
results. GitHub Issue #26 records the completed gate.
