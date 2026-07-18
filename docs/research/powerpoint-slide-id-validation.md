# PowerPoint slide identity validation protocol

This protocol supplies the one blocking item that cannot be produced on the
current development machine because Microsoft PowerPoint is not installed.
It tests normal PowerPoint editing, not OOXML manipulation by repository tools.

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
reordering, content editing, normal save, close, and reopen; moved to current
ordinal 3; and disappeared after deletion without disturbing the remaining
original identities. Attach the two PPTX files or the command's complete JSON
output to GitHub Issue #26. The go/no-go result remains pending until this
evidence exists.
