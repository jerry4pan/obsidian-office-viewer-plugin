# M2 Daily Reading Experience Design

## Status and authority

This design narrows the accepted M2 requirements in
`docs/prd/v0.1-first-public-release.md` into an implementation boundary. The
M1 reading loop is integrated on local `main`. ADR-0001 remains authoritative:
`@aiden0z/pptx-renderer@1.2.4` stays behind the project-owned renderer adapter,
and no product component may depend on candidate-specific objects or DOM.

The design was approved on 2026-07-14 and amended on 2026-07-15 after installed
testing. The amendment removes manual main-slide zoom in favor of automatic
fit-to-window rendering and a resizable thumbnail rail. It covers the complete
M2 milestone and does not claim M3 compatibility diagnostics, release
packaging, or public submission work.

## Scope and completion boundary

M2 ends when an installed desktop Obsidian plugin provides all of the
following for a local, read-only `.pptx`:

- a virtualized, progressively rendered thumbnail rail whose width can be
  adjusted and persisted;
- automatic fit-to-window rendering without manual main-slide zoom controls;
- Arrow, Page Up, and Page Down navigation plus full-screen reading;
- independent current page, thumbnail scroll, and full-screen state per
  workspace leaf;
- optional per-file reading-position persistence that survives Obsidian
  restart and invalidates stale state;
- current-slide-first rendering, adjacent-slide prefetch, a bounded background
  queue, cancellation, and deterministic resource release;
- usable light/dark theme styling, accessible names, visible focus, and a
  logical keyboard order.

M2 retains the M1 invariants: Vault binary input, no source writes, local and
offline rendering, safe degradation, retry, external-open fallback, and error
isolation between leaves.

## Approaches considered

### 1. Product-owned orchestration over an expanded adapter (selected)

Extend the candidate-neutral renderer session with thumbnail, prefetch,
slide-size, cancellation, and disposable-resource capabilities. Implement
virtualization, priorities, persistence, and interaction in project-owned
modules. This preserves the renderer replacement boundary while giving the
product exact control over scheduling and lifecycle.

### 2. Use the selected renderer's windowed list as the product UI

The selected renderer already has windowed list rendering. Using it directly
would reduce initial code, but would couple product navigation, mounted-window
semantics, and DOM behavior to Aiden. It would also make a second candidate
implement a renderer-specific list contract rather than the project contract.
This is rejected.

### 3. Allocate an independent renderer for each thumbnail

This would isolate thumbnail failures, but it would parse the same package
repeatedly and multiply media, chart, and observer lifecycles. It is
incompatible with the 100-page stress requirement and is rejected.

## Module boundaries

### Viewer controller and DOM

`PptxViewSession` remains the public product session but delegates growing M2
responsibilities to focused modules:

- `PptxViewerController` owns current page, navigation transitions,
  full-screen state, and the per-open generation.
- `ThumbnailRail` owns the scroll surface, virtual window, mounted thumbnail
  buttons, selection, and thumbnail resource handles.
- `ThumbnailRailResizer` owns pointer/keyboard resizing and actual-width
  clamping; pure sizing helpers keep policy separate from DOM events.
- `RenderTaskQueue` owns bounded background work, priority, cancellation, and
  settlement. Current-page rendering is not placed behind background work.
- `ReadingPositionStore` owns settings, fingerprint validation, migration,
  deletion, debounced persistence, and unload flushing.

The session coordinates these modules and renders the approved DOM seam. Each
module exposes a candidate-neutral interface and can be tested without an
Obsidian application process.

### Renderer contract

`PptxRendererSession` continues to own one parsed presentation and gains:

- intrinsic slide width and height metadata;
- `renderThumbnail(index, container, signal, width?)` returning a disposable resource
  whose readiness can be awaited;
- `prefetchSlide(index, signal)` that warms candidate-owned lazy state without
  leaving visible DOM or caller-owned resources behind;

`PptxRendererAdapter.open` establishes a parsed, cancellable session without
committing a main slide. Once `slideCount` is known, the product validates the
saved index and calls `renderSlide` exactly once for the initial current page.
This makes a restored page the current-slide-first path instead of briefly
rendering slide 1 and replacing it.

The adapter remains responsible for translating candidate handles and errors,
checking abort state, and disposing all candidate resources. Product code must
not import `PptxViewer`, `SlideHandle`, or renderer CSS/DOM types.

The Aiden implementation uses its existing lazy slide/media parsing,
`renderThumbnailToContainer`, `SlideHandle.ready`, `SlideHandle.dispose`,
adaptive resize, and `destroy`. The rejected candidate must still
compile against the shared contract; unsupported optional operations must be
implemented safely rather than leaking candidate details.

## Layout and interaction

The ready view has a toolbar above a reading body containing a thumbnail rail,
an accessible vertical separator, and the main slide viewport. The preferred
rail width defaults to 168 CSS pixels, is constrained to 120–480 pixels, and is
shared across the Vault. The actual width is additionally capped at 45% of the
current reading body without overwriting the saved preference, so narrow split
panes remain useful. The rail can collapse and restores its preferred width
when reopened. A committed preference change propagates to every currently
open viewer in the Vault; automatic narrow-pane clamping does not propagate or
persist a smaller value.

The toolbar contains, in logical tab order:

1. Previous, current/total page, and Next;
2. one-based page input and Go;
3. Full screen;
4. Open in default application.

The main slide always uses automatic fit-to-window rendering. No manual zoom
buttons, percentage state, or reset action are exposed. The external-open
fallback remains visible in the ready and error states for cases where the
preview is not sufficient.

Dragging the separator updates the rail and main-slide layout live. Thumbnail
work is suspended during that transient layout change; releasing the pointer
commits the preferred width and rerenders mounted visible thumbnails at the
final resolution. Double-click resets the preference to 168 pixels. When the
separator has focus, Left/Right Arrow changes the preference by 16 pixels and
Shift+Arrow changes it by 48 pixels. Its ARIA value reports the actual width.

The viewer root is focusable and receives focus after a successful open.
`ArrowLeft` and `PageUp` request the previous slide; `ArrowRight` and
`PageDown` request the next slide. Keyboard navigation is ignored when the
event originates from an input, button, select, textarea, or editable content,
so controls retain native behavior. Boundaries do not call the renderer.

Full screen uses the viewer root's Fullscreen API. The button enters and exits,
the document `fullscreenchange` event is authoritative, and Escape follows the
platform behavior. A rejected request shows a local action status and does not
change the readable slide or viewer state.

## Thumbnail virtualization

The rail represents every slide but mounts only the calculated viewport plus
one viewport of overscan above and below. It uses intrinsic slide dimensions
to preserve the presentation aspect ratio. A spacer preserves total scroll
height while mounted buttons are positioned inside the active window.

Each mounted item is a real button with `aria-label="Slide N"`; the current
item also has `aria-current="page"`. Selecting a thumbnail routes through the
same zero-based navigation function as all other controls. Successful
navigation updates the current marker and scrolls it into the virtual window
without rendering every preceding thumbnail.

Unmounting an item aborts pending work and disposes its renderer resource.
Failure produces one stable thumbnail placeholder with the slide number; it
does not degrade the main slide, stop the queue, or remove navigation access.
Retry occurs when the item leaves and later re-enters the mounted window or
when the deck is reopened.

## Progressive scheduling and cancellation

Current-slide work always has priority and runs directly through the atomic
main-slide adapter path. After a successful current render, the session queues
background work in this order:

1. previous and next adjacent-slide prefetch, nearest first;
2. visible thumbnail renders;
3. overscan thumbnail renders.

The background queue has concurrency one. This prevents a large deck from
creating simultaneous DOM-heavy renders on Electron's renderer thread. Queue
entries are de-duplicated by kind and slide index.

Every open has a generation-scoped `AbortController`. New navigation cancels
obsolete adjacent prefetch but retains still-visible thumbnail work. File
switch, view close, plugin unload, or a superseding open cancels the complete
generation, disconnects observers, clears queued tasks, waits only for bounded
settlement, and disposes every acquired resource. A completed stale task may
dispose its result but may not mutate the new view.

Prefetch failure is non-blocking and is not shown as a main-slide error.
Navigation failure retains M1 atomic rollback and the last readable page.

## Reading-position persistence and file lifecycle

Reading-position persistence is enabled by default. The plugin data schema
contains only:

- a schema version;
- `rememberReadingPosition: boolean`;
- `thumbnailRailWidth: number`, containing only the Vault-wide preferred width;
- entries keyed by Vault-relative path with `size`, `mtime`, zero-based
  `slideIndex`, and a persistence timestamp.

It never stores file system paths, presentation text, images, author metadata,
or rendered DOM.

On open, a saved position is used only when path, size, and mtime match the
current `TFile` and the index is within the renderer's slide count. Otherwise
the stale entry is removed and slide 1 is used. A restored page is the first
main slide rendered after metadata becomes available; slide 1 is not rendered
first merely to be replaced.

Every successful navigation updates the shared in-memory entry. Disk writes
are serialized and briefly debounced; plugin unload flushes the latest state.
Two leaves viewing the same file remain locally independent, while the last
successful navigation event becomes the future resume position.

A Vault rename migrates the key without changing the fingerprint. Deletion
removes the entry. External modification changes size or mtime and therefore
invalidates the old position on the next open. Switching files disposes the
old renderer and queue before reading new bytes.

A minimal M2 setting exposes `Remember reading position`. Turning it off
immediately clears all saved entries and prevents subsequent load/save.
Turning it on starts with no history. Broader privacy, diagnostics, and
compatibility settings remain M3.

## State and failure behavior

M1 `empty`, `loading`, `ready`, `degraded`, and `error` product states remain.
M2 background work never moves a readable main view back to loading.

- Main navigation failure: retain the prior page and enter `degraded`.
- Thumbnail failure: show an item placeholder and keep the main state.
- Prefetch failure: release temporary resources and keep the main state.
- Full-screen failure: retain windowed mode and show a local action status.
- Persistence failure: continue reading without exposing private storage
  details; do not overwrite known-good in-memory state with a partial write.

All async callbacks verify their open generation and disposed state before
touching DOM or persisted position.

## Theme and accessibility

All plugin styles stay beneath `.pptx-viewer` and use Obsidian theme variables.
No global selector changes unrelated content. The thumbnail selection,
controls, status text, disabled states, and focus ring remain visible in light
and dark themes.

Controls use native buttons/inputs, accessible names, and logical DOM order.
The rail has an accessible navigation label, current thumbnails expose
`aria-current`, page and action statuses use polite live regions, and blocking
errors retain focusable retry and external-open actions. The resize divider is
a focusable vertical separator with current/minimum/maximum ARIA values,
keyboard steps, visible focus, and a discoverable reset title. Full-screen mode
does not hide the controls required to exit or navigate.

## Test seams and acceptance evidence

### Fast deterministic seams

- virtual-window calculations prove bounded mounted indices at the beginning,
  middle, and end of 100- and 200-slide decks;
- task-queue tests prove priority, de-duplication, cancellation, stale-result
  disposal, and concurrency one;
- reading-position tests prove default enablement, fingerprint validation,
  invalid index rejection, rename, deletion, disable-and-clear, serialization,
  last-event-wins behavior, and normalized Vault-wide rail-width persistence;
- session DOM tests prove thumbnail selection, automatic fit behavior,
  thumbnail-rail pointer/keyboard resize semantics,
  keyboard boundaries, full-screen state, per-leaf independence, background
  failure isolation, and disposal;
- renderer conformance tests prove thumbnails and prefetch return no leaked
  resources and honor cancellation.

### Installed Obsidian seams

The sandboxed installed suite proves:

- file-explorer open followed by keyboard-only core navigation;
- thumbnail selection and bounded mounted thumbnail count;
- automatic fit on pane resize, resizable thumbnail rail, and full-screen
  enter/exit;
- two leaves maintain independent page, thumbnail scroll, and full-screen
  state; the preferred rail width is intentionally Vault-wide;
- a successful page restores after an Obsidian session restart when enabled;
- disabled persistence starts at slide 1 and leaves no saved positions;
- file switch and leaf close stop background work and release resources;
- light and dark themes keep controls and focus visible;
- source SHA-256 remains unchanged throughout.

### Performance and stress evidence

Add a repository-authored 50-slide representative benchmark constrained to
20 MB and retain the existing 200-slide stress deck, which is stronger than
the PRD's 100-slide stress floor. The installed performance protocol records
metadata, restored/current first readable, thumbnail readiness, rendered-page
switches, mounted thumbnail bounds, cancellation, memory, and cleanup.

The fixed gates remain:

- 50-slide first-readable p95 at or below 3,000 ms;
- previously rendered page switch p95 at or below 100 ms;
- no one-shot render of the full 100/200-slide deck;
- background adapter work stops after close or file switch;
- existing cleanup and resource-return policy passes.

Completion requires `npm run verify`, `npm run test:e2e`,
`npm run test:compatibility`, the full installed performance protocol, and the
committed performance-baseline validator to pass on the integrated branch.
The final M2 report maps every deliverable and exit condition to current source
and fresh command evidence.

## Deferred work

M3 retains compatibility warning surfaces, stable diagnostic export, the
complete settings/privacy/security documentation set, CI and release asset
generation, and packaged upgrade/uninstall validation. M4 retains Beta and
Community Plugins submission. Search, page links, embeds, notes, editing,
animations, legacy `.ppt`, mobile support, telemetry, accounts, licensing, and
cloud services remain outside v0.1 or later milestones as assigned by the PRD.
