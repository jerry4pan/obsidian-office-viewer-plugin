# PPTX knowledge reference loop technical exploration

- Status: Implementation evidence complete; PowerPoint identity gate pending
- Started: 2026-07-18
- Scope: the first bounded exploration after the v0.1 reading experience

## Decision log

### D1: Explore without declaring M4 complete or committing v0.2

M4 remains open and does not claim real-user validation that has not occurred.
In parallel, the project may run a bounded knowledge reference loop technical
exploration to reduce technical risk. This exploration is not approval to build
or release the complete v0.2 scope and does not claim real-reader workflow
validation.

### D2: Start with a slide reference and exact return

The first exploration scenario is:

1. A reader manually finds a slide in an open PPTX.
2. The reader copies a source-preserving slide reference such as
   `[[folder/deck.pptx#slide-id=256|deck — Slide 12]]` into a Markdown note.
3. Following the reference opens the source PPTX at the exact slide.

The first slice excludes full-Vault text search, slide embedding, companion
notes, and reference backlinks. Those remain possible later branches rather
than hidden prerequisites of the first experiment.

### D3: Bind a slide reference to slide identity, not ordinal position

A slide reference records both the PPTX-native slide identity and the ordinal
position seen when the reference was created. Resolution follows the stable
identity when slides are inserted or reordered. If that identity no longer
exists, the viewer reports a stale reference and may offer to open the source
presentation, but it must not silently redirect to whatever now occupies the
old ordinal position.

The committed corpus exposes native `p:sldId` values. The exploration must
still verify how those values behave across representative PowerPoint editing
operations before treating them as a durable external contract.

### D4: Include a slide embed as the second experiment

The same exploration includes a second, sequential slice in which an Obsidian
embed such as `![[deck.pptx#...]]` renders the slide identified by the same
slide-reference contract inside a Markdown note. Following the embed returns to
the source PPTX and exact slide.

This slice starts only after the slide-reference identity and resolution path
works. It does not add full-Vault search, multi-slide or full-deck embeds,
static image export, companion notes, or backlinks to the exploration scope.

### D5: Treat a slide embed as a live source view, not a snapshot

The current local PPTX remains authoritative. Reopening a note renders the
latest content associated with the referenced stable slide identity; the
exploration does not generate or persist a PNG snapshot. A missing source,
deleted slide, or rendering failure produces an explicit placeholder with a
source-opening recovery action instead of stale or misleading content.

### D6: Require rendering in Reading View, not Live Preview

The exploration must render a slide embed in Markdown Reading View. Live
Preview and Source mode preserve editable canonical embed syntax, but inline
editor rendering is not a completion condition. Editor decorations, cursor
behavior, and CodeMirror-specific lifecycle work remain a later feasibility
branch if the source-backed embed proves valuable.

### D7: Use standard Obsidian wikilinks as the public contract

A slide reference uses a standard Vault wikilink with a fragment that carries
the stable slide identity and an alias that can show the source name and
creation-time ordinal, for example:

```md
[[deck.pptx#slide-id=256|deck — Slide 12]]
![[deck.pptx#slide-id=256|deck — Slide 12]]
```

The exact fragment encoding remains subject to an Obsidian API feasibility
check, but references and embeds must share one canonical encoding and differ
only by the standard embed marker. A plugin-specific URI is not the primary
format; it may exist only as an internal or compatibility fallback.

### D8: Create markup through explicit copy actions

The active PPTX viewer exposes separate “Copy slide reference” and “Copy slide
embed” actions for the current slide. Each action writes canonical wikilink
markup to the clipboard for the reader to paste into any note. The exploration
does not directly edit an active Markdown editor and does not add thumbnail
context-menu actions; editor selection, cursor, pane choice, and undo behavior
are outside the hypothesis being tested.

### D9: Complete the exploration on technical evidence

The exploration has one completion gate: technical evidence. Maintainer-run
testing may exceed the committed corpus and must cover stable identity across
representative edits, exact reference return, Reading View embedding, honest
missing-target behavior, offline and source-integrity guarantees, and bounded
resource cleanup.

Scarce real-user feedback does not block this technical exploration. Technical
completion does not claim workflow validation, does not close M4, and does not
by itself authorize a complete v0.2 release scope.

### D10: Keep creation-time labels and disclose ordinal changes

Canonical markup carries both stable slide identity and the ordinal seen when
the reference was created. Its human-readable Markdown alias remains static;
the plugin does not rewrite user notes when a presentation is reordered. When
resolution finds the target at a different ordinal, the source viewer presents
a non-blocking “created as / currently” notice and a slide embed identifies the
current ordinal. Stable identity remains authoritative.

### D11: Validate a representative multi-embed note

The technical gate includes one Markdown note with ten slide embeds sourced
from up to three PPTX files. Rendering is viewport-aware, runs no more than two
embed render tasks concurrently, and releases resources outside the rendering
window. The first visible embed must become readable within the existing
three-second first-readable budget. Larger cases are measured and recorded but
do not block completion of this exploration.

### D12: Preserve native Obsidian link navigation

Following a slide reference or slide embed uses Obsidian's normal leaf,
modifier-key, context-menu, and split-view behavior. The plugin resolves the
target slide but does not force a new pane, search for and commandeer an
existing PPTX view, or replace the user's configured navigation semantics.

### D13: Gate stable identity on normal PowerPoint editing

Stable slide identity must survive inserting, reordering, editing, and normally
saving the presentation in Microsoft PowerPoint. Keynote and LibreOffice PPTX
round trips are measured and documented but do not block this exploration; if
an editor regenerates native identities, affected references fail honestly
rather than guessing by ordinal. A Save As copy is distinct Knowledge material,
so existing references continue to address the original Vault file and are not
automatically migrated to the copy.

### D14: Allow references to successfully rendered degraded slides

A loaded slide with a stable identity may be referenced or embedded after that
target slide renders successfully, even when non-blocking compatibility risks
are detected. A slide embed follows the existing diagnostic-summary setting for
the visibility of detectable font and unsupported-content warnings and always
retains a path to open the source presentation. Copy actions are unavailable
when target rendering fails or stable identity cannot be resolved; the plugin
must never create markup for a previous slide left visible after a failed
navigation.

### D15: Keep incomplete exploration out of public releases

Implementation proceeds on a dedicated development branch without a public
experimental-feature setting. Both slices and the technical gate must pass
before the work is merged into `main`. A merge means the code meets the
project's production-quality bar; versioning and public release remain a
separate maintainer decision.

### D16: Encode the normalized Vault-relative source path

Canonical slide-reference markup uses the full normalized Vault-relative PPTX
path instead of the shortest link form. This avoids ambiguous resolution when
multiple folders contain the same filename or a same-named file is added later;
the human-readable alias hides path verbosity. File-rename updates remain
governed by Obsidian's native link-update behavior.

## Technical shape

### Shared identity and link contract

- Extend the existing safety preflight result to expose the ordered, unique
  native slide identities already parsed from `ppt/presentation.xml`; do not
  introduce a second OOXML inspection path.
- Keep one project-owned parser and formatter for canonical slide-reference
  fragments. It validates the Vault-relative path, stable identity, and
  creation-time ordinal before either the viewer or Markdown integration uses
  them.
- Add ordered slide identities to the project-owned renderer-session boundary
  after confirming that the renderer's slide order matches the inspected
  presentation order. Candidate-specific objects remain isolated behind the
  existing adapter.

### Slice 1: reference and exact return

- Pass an explicit transient slide target through public Obsidian file-view
  state or ephemeral state. A valid link target takes precedence over saved
  reading position for that navigation without becoming a second persistent
  position store.
- Resolve stable identity to the current zero-based renderer index only after
  package inspection. Report missing identity and ordinal movement explicitly.
- Add current-slide copy actions only after a successful target render; use the
  existing clipboard and translated-message seams.
- Verify the standard link path in installed Obsidian, including navigation
  history, modifier-key behavior, duplicate basenames, rename behavior, and
  plugin restart.

### Slice 2: Reading View slide embed

- Register a Markdown Reading View postprocessor and attach each live embed to
  a public `MarkdownRenderChild` lifecycle. Resolve source files with Obsidian's
  metadata cache instead of filesystem guesses.
- Reuse the same package preflight, identity resolver, renderer adapter,
  warnings, external-open fallback, and failure categories as the source
  viewer. No parallel raw parser or relaxed embed-only safety path is allowed.
- Coordinate all embeds in a note through a viewport-aware scheduler capped at
  two concurrent render tasks. An embed owns and disposes its renderer session;
  sharing parsed renderer internals is not a prerequisite for this exploration.
- Exercise the representative ten-embed, three-source note in installed
  Obsidian and retain timing, cancellation, cleanup, source-integrity, and
  offline evidence.

## Work order

1. Feasibility gate: stable-ID editing evidence plus installed Obsidian link and
   embed API proof.
2. Slice 1: slide reference, exact return, copy actions, and stale handling.
3. Slice 2: Reading View slide embed, bounded scheduling, and performance.
4. Integrated technical report and maintainer merge decision.

The work is intentionally sequential. The later slices depend on the public
contract and lifecycle evidence from the feasibility gate, so they are not
independent delegation candidates.

## Implementation evidence (2026-07-18)

### Stable identity and canonical links

- The existing package preflight now exposes ordered, unique `p:sldId` values;
  the project-owned adapter rejects a renderer whose slide count disagrees with
  inspected identity order.
- One parser/formatter owns the canonical
  `#slide-id=<id>&slide=<creation-ordinal>` contract for references and embeds.
- Installed Obsidian 1.12.7 proves that a normal Reading View wikilink passes the
  custom subpath to `FileView.setEphemeralState` and opens the current ordinal of
  the stable identity through public APIs. The same target works after plugin
  restart and in a split leaf without commandeering the original note leaf.
- Missing identities render an explicit stale-reference state with no ordinal
  fallback. A moved identity discloses both creation-time and current ordinals.
- Copy-reference and copy-embed actions remain disabled until a current slide
  has rendered successfully and always emit the full normalized Vault path.
  Installed clipboard-seam evidence verifies both exact strings.
- A duplicate-basename probe still resolves the encoded full path. Obsidian's
  native rename updater preserves the custom fragment and exact target but may
  shorten the updated path relative to the note; the plugin does not intercept
  or rewrite that native behavior.

### Reading View embed

- A Markdown postprocessor recognizes the same canonical contract and attaches
  each renderer to `MarkdownRenderChild` lifecycle management.
- Source resolution uses `MetadataCache.getFirstLinkpathDest`; rendering reuses
  the same package preflight and renderer adapter as the source viewer.
- Obsidian asynchronously rebuilds native generic-embed nodes and virtualizes
  Markdown sections. The integration therefore keeps the canonical native node
  as a hidden fallback and mounts an independently lifecycle-owned slide host;
  it does not depend on replacing a node before Obsidian's core embed work.
- A shared viewport scheduler caps active embed work at two. Leaving the render
  window or note lifecycle unload aborts queued work and disposes active
  renderer sessions. A plugin-level active-child registry also unloads completed
  embed sessions when the plugin is disabled; installed evidence confirms the
  custom host disappears and the native fallback is restored.
- Installed evidence walks ten unique embeds across three presentations. Every
  embed becomes readable within three seconds of its render task, observed
  concurrent loading never exceeds two, source SHA-256 values are unchanged,
  and the network guard records no application requests.
- Missing source, stale identity, protected package, resource-limit failure,
  in-flight cancellation, and renderer failure have bounded placeholders or
  waiting states with source recovery. Existing sources also retain the desktop
  default-application fallback.
- Installed locale smoke tests cover the new reference controls and embed source
  labels in English, Simplified Chinese, Traditional Chinese, and English
  fallback. Embed theme variables and accessible group/status/link names are
  exercised in the installed reference spec.

### Verification

| Command | Result |
| --- | --- |
| `git diff --check` | PASS |
| `npm test` | PASS — 40 files, 423 tests, including the PowerPoint evidence verifier CLI |
| `npm run test:e2e` | PASS — normal, degraded, multilingual, reference, failure-embed, lifecycle, and ten-embed installed cases |
| Focused installed reference/embed spec | PASS — 9 cases on Obsidian 1.12.7 |
| `npm run test:compatibility` | PASS — unchanged reviewed visual baselines and readability gate; no baseline update |
| `npm run test:performance:baseline` | PASS — bundle/evidence policy checks |
| Two consecutive `npm run test:performance` runs | PASS — accepted current-bundle run IDs `4dd67e5e-c70a-4dcd-8579-1c01e2275655` and `23892a70-34f5-4141-907e-e678be9d9a4e`; first-readable p95 113.8/112.2 ms, switch p95 2.4/2.4 ms, bundle 1,228,293 bytes |
| `npm audit --omit=dev` | PASS — 0 production vulnerabilities |

The retained performance history also records one non-promoted current-bundle
attempt (`a1639f06-4c0b-40fa-956b-d5b041e1d693`) whose later samples missed the
cleanup deadline and raised first-readable p95 to 916.6 ms. That attempt reset
the consecutive-clean counter; the two accepted runs above were collected only
afterward. It is preserved as environmental-variance evidence rather than
discarded or treated as a passing run.

### Acceptance audit

| Gate | Current evidence | Status |
| --- | --- | --- |
| PowerPoint insert/reorder/edit/normal-save preserves the target identity | Manual protocol and deterministic verifier are ready; PowerPoint is absent on this machine and no maintainer artifacts have been supplied | **PENDING — blocking** |
| Deleted/regenerated identity never falls back to ordinal | Preflight uniqueness, stale viewer/embed unit tests, installed stale reference and embed cases | PASS |
| One shared canonical fragment contract | Formatter/parser malformed and encoded-path tests; installed reference and embed share it | PASS |
| Native Obsidian current/split/restart/rename navigation | Installed current leaf, split leaf, restart, duplicate basename, and native rename-update probes | PASS |
| Reading View public lifecycle | Markdown postprocessor + `MarkdownRenderChild`; viewport, note unload, plugin disable, and native fallback evidence | PASS |
| Reference copy and exact return | Unit failure/degraded tests plus installed exact clipboard, moved, stale, duplicate-path, split, restart, and rename cases | PASS, conditional on PowerPoint identity gate |
| Source-backed single-slide embed | Supported/degraded diagnostics, abnormal inputs, external fallback, ten-embed scheduling, locale/theme/accessibility, offline and integrity evidence | PASS, conditional on PowerPoint identity gate |
| Merge/release decision | D15 forbids merge or release while the blocking identity row is pending | NO-GO pending PowerPoint evidence |

The current machine has no Microsoft PowerPoint installation. The exact manual
round-trip and a deterministic evidence verifier are committed in
`docs/research/powerpoint-slide-id-validation.md`. Until that protocol passes,
Issue #26 remains a no-go/pending gate and the branch must not merge or ship.
This pending external evidence does not alter M4 #23 or claim user-workflow
validation.
