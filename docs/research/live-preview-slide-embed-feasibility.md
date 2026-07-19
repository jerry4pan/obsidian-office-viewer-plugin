# Live Preview slide embed feasibility

- Status: ACCEPTED FOR BOUNDED TECHNICAL EXPLORATION — implementation evidence pending
- Date: 2026-07-19
- Scope: render the existing canonical single-slide PPTX embed in Obsidian Live Preview

## Answer

A Live Preview slide embed would show the current source-backed PPTX slide
inside a Markdown note while that note remains in its editing view. It would
replace the canonical embed syntax visually when the reader is not editing that
syntax, and reveal the original syntax when the cursor or selection enters it.

It would not edit the PPTX, make the rendered slide content editable, or add an
editing mode to the PPTX source viewer. Source mode would continue to show only
the canonical Markdown syntax, and Reading View would continue to use the
existing renderer.

The recommendation is **go for a technical exploration, not yet for a product
implementation**. The renderer, package-safety, stable-identity, and canonical
link contracts are already proven. The remaining uncertainty is whether a
CodeMirror editor widget can preserve trustworthy editing and cleanup behavior
under installed Obsidian.

## Product shape

Given this source:

```md
![[folder/deck.pptx#slide-id=256&slide=12|deck — Slide 12]]
```

Only this existing canonical single-slide contract is in scope. A plain
`![[deck.pptx]]` remains native Obsidian syntax and must not be interpreted as
the first slide, the last-read slide, or a full-deck embed.

Live Preview renders the canonical embed only when it is the sole non-whitespace
content on its line. An embed mixed with surrounding prose remains editable
Markdown syntax; a full slide must not inflate an inline text run or destabilize
cursor and selection behavior.

the intended behavior is:

- Live Preview, cursor outside the embed: show the source-backed slide and its
  source action in place of the syntax;
- Live Preview, cursor or selection touching the embed: show editable canonical
  syntax rather than trapping the selection inside a widget;
- Live Preview, slide-canvas click: activate the embed and reveal its canonical
  syntax; only the explicit source action navigates to the PPTX target;
- Source mode: always show editable canonical syntax;
- Reading View: preserve the current source-backed slide embed behavior;
- Live Preview: preserve the same source action, external-open fallback,
  diagnostics setting, compatibility disclosure, and bounded failure states as
  Reading View;
- every mode: the Markdown source remains authoritative and byte-compatible
  with the existing public contract.

Obsidian describes Live Preview as an editing mode that previews a note in the
same view in which it is written and displays Markdown syntax around the cursor.
That supports the interaction above, but it does not provide PPTX editing.

## Existing foundation

The project already has the expensive document-side capabilities:

- one canonical slide-reference parser and formatter;
- stable slide identity and honest stale-reference behavior;
- project-owned PPTX preflight and renderer-adapter boundaries;
- source-backed single-slide rendering with no persisted snapshot;
- offline and source-integrity evidence;
- viewport-aware work scheduling capped at two concurrent embed tasks;
- Reading View lifecycle cleanup through `MarkdownRenderChild`;
- localized loading, failure, compatibility, and source-opening surfaces.

The current plugin registers only `registerMarkdownPostProcessor`, whose public
API contract is to change how a document looks in Reading View. Live Preview
therefore needs an editor extension; the current postprocessor cannot simply be
reused as-is.

## Supported technical seam

Obsidian's public API exposes `registerEditorExtension` for CodeMirror 6
extensions and `editorLivePreviewField` to determine whether Live Preview is
active. Its editor documentation recommends decorations when an extension
needs to insert, replace, or style content in the editor.

A minimal exploration should use a CodeMirror view plugin that:

1. runs only when `editorLivePreviewField` is true;
2. scans syntax nodes only in visible editor ranges;
3. recognizes only a standalone-line instance of the existing canonical PPTX
   single-slide embed contract with the shared parser rather than a second
   regular-expression contract;
4. leaves the syntax visible whenever any editor selection overlaps the embed;
5. otherwise replaces the complete embed range with a block widget;
6. resolves the source relative to the edited Markdown file;
7. gives each widget explicit async cancellation and renderer disposal;
8. reuses the plugin-wide two-task scheduler across Reading View and Live
   Preview, so changing modes does not multiply document work;
9. destroys the widget on viewport exit, document change, mode switch, editor
   destruction, file switch, and plugin unload.

CodeMirror replace decorations and `WidgetType` provide the supported drawing
mechanism. View plugins are the preferred fit when decorations can be derived
from the viewport; Obsidian and CodeMirror both document viewport-based
rendering as the performance boundary for large documents.

The widget should not subclass the existing `MarkdownRenderChild`. The two
hosts have different owners: Reading View owns a render child through
`MarkdownPostProcessorContext.addChild`, while CodeMirror owns and may recreate
an editor widget. Shared parsing, source resolution, scheduling, error mapping,
diagnostics, recovery actions, and a renderer controller should be extracted
without pretending the lifecycle is the same.

## Risks that the exploration must resolve

### Editing semantics

- Arrow keys, click, drag selection, Shift-selection, multi-cursor selection,
  Backspace, Delete, cut, copy, paste, and select-all must never trap the cursor
  or mutate a different range.
- Entering or touching the embed range must reveal the exact Markdown source.
- Removing and restoring a visual widget must not create editor history entries;
  undo and redo must operate only on Markdown document changes.
- An invalid or partially typed embed must remain ordinary editable text.

### Lifecycle and stale work

- CodeMirror may recreate widgets as the viewport or document changes. Every
  discarded widget must cancel queued reads and dispose any renderer session.
- A render completion from an old document version, old file, or old widget
  must not mount into the current editor.
- Switching between Live Preview, Source mode, and Reading View must not leave
  duplicate sessions, hidden syntax, detached DOM, or native embed work behind.

### Performance and layout

- A large slide is a block widget whose height affects editor layout. Rendering
  or disposing it must not create intolerable scroll jumps.
- A note containing ten canonical embeds must still mount work only near the
  viewport and observe no more than two active render tasks across all hosts.
- Repeated cursor movement around an embed must not repeatedly parse and open
  the same PPTX without a bounded reuse or debounce policy. Start without a
  new cache and measure installed behavior first. If evidence requires reuse,
  allow only short-lived view-local memory that is cleared on file change,
  note switch, view destruction, or plugin unload; never add disk snapshots,
  persistent indexes, or cross-view document-content caches in this scope.
- Pop-out windows need document-local DOM creation and teardown; the project is
  desktop-only, so mobile support remains outside this exploration.

### Trust boundary

- Live Preview must reuse the same preflight, safety limits, error categories,
  compatibility disclosure, offline behavior, and default-application fallback
  as Reading View.
- The feature must not persist a slide image, extracted document content,
  queries, or renderer state.
- Markdown edits and PPTX rendering remain separate: the widget may edit or
  remove only its canonical Markdown embed syntax and never write the PPTX.

## Technical exploration gate

Build a mergeable-quality candidate on a dedicated development branch, not a
throwaway proof and not a public experimental setting. Make no release/version
change. Do not merge the branch until the gate below passes and the maintainer
separately accepts productization. A go result requires installed Obsidian
evidence for all of the following:

1. one canonical embed renders in Live Preview and reveals exact source when
   the cursor or any selection touches it;
2. Source mode and Reading View retain their current public behavior;
3. typing, partial syntax, delete, cut, paste, select-all, undo, redo, mouse
   selection, keyboard selection, and multiple selections preserve the note;
4. clicking the slide canvas reveals the exact canonical syntax without
   navigation, while the explicit source action opens the exact PPTX target;
5. source rename, missing source, stale slide identity, malformed/protected
   package, renderer failure, and cancellation fail honestly;
6. ten embeds from up to three PPTX files stay viewport-bounded and never run
   more than two tasks concurrently across Reading View and Live Preview;
7. scrolling away, closing the note, switching files or modes, opening a second
   leaf, moving to a pop-out window, disabling the plugin, and closing Obsidian
   release all renderer, observer, listener, widget, and queued-task resources;
8. PPTX SHA-256 values are unchanged and the application network guard records
   no requests;
9. English, Simplified Chinese, Traditional Chinese, keyboard, screen-reader,
   light-theme, and dark-theme behavior remain usable;
10. both the declared minimum supported Obsidian version and the current test
   version pass. If correctness requires a newer minimum, stop with evidence
   and request a separate maintainer decision; do not change `manifest.json`
   as part of the exploration.

The installed syntax matrix must include leading/trailing whitespace, adjacent
paragraphs, multiple standalone embeds, a canonical embed mixed with prose,
two embeds on one line, malformed and partially typed syntax, and ordinary
non-PPTX embeds. Only the standalone canonical PPTX case may become a widget.

A no-go result is appropriate if correct syntax revelation conflicts with
selection/editing semantics, lifecycle cleanup cannot be made deterministic,
or a representative multi-embed note causes unstable layout or unbounded
renderer churn. Reading View remains the complete supported fallback.

## Sources

- [Obsidian Help: Live Preview update](https://help.obsidian.md/Live+preview+update)
- [Obsidian Developer Docs: Decorations](https://docs.obsidian.md/Plugins/Editor/Decorations)
- [Obsidian Developer Docs: Viewport](https://docs.obsidian.md/Plugins/Editor/Viewport)
- [Obsidian API type definitions](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)
- [CodeMirror 6 reference manual](https://codemirror.net/docs/ref/)
- Existing project decision and evidence:
  [`knowledge-reference-loop-technical-exploration.md`](./knowledge-reference-loop-technical-exploration.md)
