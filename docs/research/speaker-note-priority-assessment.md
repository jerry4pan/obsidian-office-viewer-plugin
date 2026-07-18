# Speaker-note capability priority assessment

- Status: Accepted
- Date: 2026-07-18
- Scope: prioritization after slide search, references, and embeds shipped

## Decision

Prioritize speaker-note viewing, copying, and current-presentation search ahead
of directly inserting a slide reference or embed into a Markdown editor.

Speaker notes are not merely additional metadata. Readers sometimes need them
to understand or recover presentation content; without an in-plugin surface,
they must leave Obsidian and open the default presentation application. Direct
insertion removes a copy-and-paste step, but the existing copy-reference and
copy-embed actions already let the reader complete the knowledge reference
loop.

This prioritization does not replace the open M4 requirement for real-reader
validation or commit the project to a release.

## Recommended scope

1. Show the current slide's speaker-note content in a collapsed-by-default
   panel. An explicit reader action or a note-search result opens the panel.
2. Search source-authored slide text and speaker-note content together by
   default when the reader invokes search in an open PPTX.
3. Keep one result per stable slide identity. Within that result, label and
   summarize slide-text and speaker-note matches separately, with optional
   All, Slide, and Notes scope filters.
4. Opening a speaker-note match navigates to the owning slide, expands the
   notes panel, and highlights the matching note text.
5. Allow speaker-note content to be copied with its source slide reference.
6. Exclude notes-master text, headers, footers, dates, and slide numbers.
7. Preserve the existing privacy boundary: current PPTX only, no persistent
   index, and no saved query, note text, or result set.

## Why direct insertion follows

"Current note" is ambiguous while the PPTX viewer is active, especially with
multiple Markdown leaves. A safe implementation must define destination
selection, cursor placement, undo behavior, pane changes, and the no-editor
case. Revisit it after real-reader evidence shows that repeated copy and paste
is a meaningful source of friction.
