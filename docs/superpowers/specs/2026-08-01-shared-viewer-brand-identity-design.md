# Shared Office Viewer Brand Identity Design

## Status and authority

This design was approved by the product owner on 2026-08-01. It defines the
in-product brand identity shared by the PPTX and DOCX file-view shells. It is
an implementation design, not an authorization to broaden either format's
reading workflow.

`CONTEXT.md` and the accepted ADRs remain authoritative for format behavior.
In particular,
`docs/adr/0005-limit-first-docx-release-to-reading-and-search.md` continues to
limit the first DOCX release to local read-only body reading, current-document
search, and session-local result navigation.

`docs/brand.md` continues to forbid creator attribution in the task-oriented
interface. The shared file-view identity is product-only: mark, product name,
and format badge. A later owner decision removed the previously considered
`· Jerry Pan` signature from the shell.

The screenshot audit that motivated the shared-shell work is available at:

`/Users/oulong/.codex/visualizations/2026/08/01/019fbd56-751d-7770-ba15-679ed921a62d/docx-pptx-consistency-audit/audit.md`

The audit is evidence, not a substitute for this contract.

## User outcome

A reader moving between a DOCX and a PPTX should immediately recognize both
views as Office Viewer. The same quiet identity appears at the same shell
location, while the reading surface and format-specific controls remain
appropriate to the source material.

The identity must read in this order:

1. Office Viewer is the product.
2. DOCX or PPTX is the current source format.

It must never look like a watermark, a claim of authorship over the open
document, or a control that edits or uploads the source.

## Selected expression

The standard-width identity is:

```text
[Office Viewer mark] Office Viewer [DOCX|PPTX]
```

Use the existing Office Viewer product mark:

`assets/brand/office-viewer-mark.svg`

Do not invent a JP monogram, reuse the Jerry Pan portrait or wordmark, derive a
new logo, put Microsoft Office colors or format letters inside the mark, or add
creator attribution to the file-view toolbar.

The identity is non-interactive. It does not link to a profile, funding page,
website, or settings screen. A future link would be a separate product
decision because it would add an external action to the core reading shell.

## Scope

This design covers the primary installed Obsidian file views:

- the PPTX reading view;
- the DOCX reading view;
- their loading, ready, degraded, search-open, and blocking-error states;
- windowed desktop panes and PPTX full-screen reading;
- supported light and dark Obsidian themes;
- English, Simplified Chinese, and Traditional Chinese message locales.

It does not cover:

- slide embeds or Live Preview embeds;
- Markdown notes, companion-note content, or source-authored document content;
- settings, donation, diagnostics, README, or release-page branding;
- a new brand preference or visibility toggle;
- DOCX thumbnails, references, embeds, companion notes, full screen, or any
  other PPTX-only capability;
- a broader toolbar redesign beyond the common shell contract already being
  established.

## Shell layout contract

Both file views use one shared top toolbar with identical horizontal insets,
height policy, spacing tokens, and DOM order:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Identity  Search                     shared/file actions on right │
└──────────────────────────────────────────────────────────────────┘
│ Format-specific controls, when required                           │
└──────────────────────────────────────────────────────────────────┘
│ Reading body                                                      │
```

The toolbar start contains the identity followed by the search action. The
toolbar end contains common file actions such as Open in default application
and any approved PPTX-only source actions. The PPTX page counter, previous/next
navigation, jump input, full screen, thumbnails, and speaker-note controls
remain in a second format-specific row. DOCX does not render an empty second
row.

The brand identity is anchored by normal layout, never by viewport-absolute
positioning. “Same position” means the same shared toolbar slot and spacing,
not a fragile pixel offset relative to the document canvas.

The identity must remain present and stable when:

- a file moves from loading to ready;
- search opens or closes;
- the current slide or paragraph changes;
- a readable view enters degraded state;
- a blocking open error replaces the reading body.

The identity must not be recreated during these transitions. Rebuilding it
would create layout shift, duplicate accessible text, and unnecessary asset
work.

## Responsive and full-screen behavior

Obsidian panes resize independently of the application viewport, so responsive
behavior must follow the file-view container rather than global viewport media
queries.

Use these progressive states:

1. **Standard pane:** mark, `Office Viewer`, and format badge are visible.
2. **Narrow pane:** keep only the mark; its accessible context remains
   available through the surrounding view title and visible file tab.

The initial container threshold for narrow mode is 380 CSS pixels. It may move
during installed visual verification if the toolbar wraps or clips, but both
formats must use the same final tokens and thresholds. Prefer CSS container
queries rooted at the file-view shell. If the minimum supported Electron
version cannot implement them reliably, use one shared measurement
implementation rather than separate DOCX and PPTX logic.

PPTX full screen hides the complete identity, including the mark. Navigation
and the control required to leave full screen remain visible. Hiding the
identity in full screen protects the presentation reading task from permanent
branding and matches the approved “product signature, not watermark” intent.

## Module and seam design

The shared identity belongs behind the existing project-owned Office Viewer
chrome seam. At design time the working tree contains an uncommitted
`src/office-viewer-chrome.ts`; an implementer must inspect the current branch
and preserve any pre-existing user changes instead of assuming that module is
already integrated.

The module should expose one small interface that renders the identity itself
and returns only action slots callers need:

```ts
export type OfficeViewerFormat = "DOCX" | "PPTX";

export interface OfficeViewerToolbarOptions {
  readonly format: OfficeViewerFormat;
  readonly extraClassName?: string;
}

export interface OfficeViewerToolbar {
  readonly root: HTMLElement;
  readonly primary: HTMLElement;
  readonly secondary: HTMLElement;
}

export function createOfficeViewerToolbar(
  options: OfficeViewerToolbarOptions,
): OfficeViewerToolbar;
```

The implementation owns:

- creation of the identity DOM;
- product and format text;
- the bundled asset reference;
- stable class names and data attributes;
- decorative-image accessibility;
- identity ordering before the primary action slot.

Callers own only the actions placed into `primary` and `secondary`. Do not add
arbitrary `productName`, `creatorName`, `markUrl`, `showCreator`, or layout
parameters. Those would turn one product contract into per-format
configuration and allow the two views to drift again.

Use stable implementation selectors:

```text
.office-viewer-brand
.office-viewer-brand__mark
.office-viewer-brand__product
.office-viewer-brand__format
[data-office-viewer-brand]
[data-office-format="DOCX"|"PPTX"]
```

Tests and styling may use these selectors. Product behavior must not depend on
the SVG's internal element IDs or geometry.

## Asset delivery

The mark must remain local and offline. Rendering it must not fetch a network
URL, read an arbitrary Vault file, depend on the user's theme assets, or create
a temporary file.

Bundle the existing SVG into `main.js` as a data URL or an equivalent
build-time string derived from the source asset. Do not duplicate the SVG
markup by hand in TypeScript or CSS. If the implementation instead ships the
SVG as a release file, it must update the release file list, packaged-release
checks, archive tests, and plugin-relative resource resolution. The bundled
data-URL approach is preferred because the current release archive does not
include `assets/brand/`.

The built production artifact must contain exactly one source of the mark and
must pass the existing no-network and release-package checks.

## Visual treatment

- Mark: 20 CSS pixels square in standard and compact modes; never stretch or
  crop it.
- Product name: Obsidian UI font, normal or medium weight, `--text-normal`.
- Format badge: `--font-ui-smaller`, muted surface, small radius; use the
  literal uppercase `DOCX` or `PPTX`.
- Spacing: Obsidian spacing variables only; no hard-coded margin that differs
  by format.
- Background: the toolbar keeps the Obsidian shell background. Do not place a
  branded color band behind the complete toolbar.
- Effects: no gradient, glow, decorative shadow, animation, pulsing, or hover
  treatment on the non-interactive identity.

The SVG's authored brand colors remain intact in light and dark themes. Do not
apply the DOCX dark-theme inversion filter or renderer transforms to the mark.

## Accessibility and localization

The SVG is decorative because the adjacent text already names the product. It
must use an empty text alternative or `aria-hidden="true"` and must not expose
the SVG's internal title and description as duplicate announcements.

The identity is not a button, link, heading, landmark, or live region. It does
not receive a `tabindex`, hover cursor, pressed state, tooltip-only meaning, or
focus ring. Search remains the first interactive control in the shared
toolbar.

`Office Viewer`, `DOCX`, and `PPTX` are locked proper names and do not vary by
message locale. Do not add creator attribution or a translated sentence such as
“A Jerry Pan project” to the toolbar.

At 200% zoom and in narrow split panes, the identity may progressively hide as
specified, but it must never overlap, clip, or push Search and Open in default
application outside the usable toolbar.

## State and failure behavior

- **Empty/loading:** show the identity once the file-view shell exists. Loading
  status remains separate and live.
- **Ready:** show the standard responsive identity.
- **Search open:** keep the identity unchanged; the search rail must not move
  or replace it.
- **Degraded:** keep the identity unchanged; warnings remain content/status
  surfaces.
- **Blocking error:** keep the same toolbar and identity while replacing only
  the reading body with the shared recovery card. Search may be disabled when
  no searchable model exists.
- **Retry:** reuse the existing identity and toolbar. Do not append a second
  toolbar after recovery.
- **PPTX full screen:** hide the identity without removing required navigation
  or exit controls.
- **Dispose/file switch:** release the view as usual. The data URL needs no
  separate resource cleanup.

The PPTX implementation currently rebuilds its root for some errors. It must
be reshaped so the persistent shell remains outside the replaceable content
surface, matching the DOCX shell contract. This is a shell-local refactor; it
must not move PPTX renderer lifecycle or document semantics into the shared
chrome module.

## Implementation sequence

1. Keep `docs/brand.md` aligned with this product-only identity and continue
   forbidding creator attribution in task-oriented controls.
2. Add the real SVG asset to the production bundle without introducing a
   runtime network or filesystem dependency.
3. Deepen the Office Viewer chrome module so toolbar creation owns the brand
   identity and callers receive only action slots.
4. Integrate DOCX and PPTX with the same toolbar interface, preserving current
   action behavior and keyboard order.
5. Make the PPTX toolbar persistent across loading, ready, degraded, and error
   states; keep format rendering and lifecycle outside the shared module.
6. Add shared responsive, theme, and full-screen styles.
7. Add fast DOM tests, installed Obsidian acceptance coverage, multilingual
   assertions, and packaged-release evidence.
8. Re-capture DOCX and PPTX reading, search, and error screenshots at matching
   pane sizes and compare the brand anchor before handoff.

The implementer must begin by inspecting `git status` and the current diff.
There are pre-existing uncommitted shared-chrome changes in the working tree at
the time this design was written. They belong to the user or another agent and
must not be discarded, reset, or overwritten.

## Fast deterministic acceptance

Add or extend tests proving:

- `createOfficeViewerToolbar({ format: "DOCX" })` and the PPTX variant each
  render exactly one identity before the primary action slot;
- both variants use the same product text and differ only in the format badge;
- neither variant renders creator attribution in the toolbar;
- the mark is decorative, non-focusable, and not wrapped in a link or button;
- search is the first interactive toolbar item in both formats;
- no arbitrary brand configuration is exposed through the module interface;
- error-to-retry transitions retain one toolbar and one identity;
- switching files does not duplicate the identity;
- PPTX full-screen state hides the identity and restores it on exit;
- shared responsive classes preserve the action slots at standard, compact,
  and narrow container widths;
- the production bundle contains the real mark without requiring a separate
  network request.

## Installed Obsidian acceptance

At one matching pane size, capture and inspect these states in both light and
dark themes:

1. PPTX ready reading;
2. DOCX ready reading;
3. PPTX search open;
4. DOCX search open;
5. PPTX blocking error;
6. DOCX blocking error.

The installed evidence must show:

- the mark's leading edge and toolbar inset match between DOCX and PPTX;
- the same identity typography, asset size, spacing, and format badge are used;
- the identity never overlaps or wraps common actions at the approved standard
  width;
- only the mark remains in a narrow pane;
- the identity is absent in PPTX full screen and returns after exit;
- search and error actions retain visible focus and logical keyboard order;
- the source PPTX and DOCX hashes remain unchanged;
- no network request occurs during open, search, error, retry, or asset render.

Run focused unit tests, `npm run build`, relevant installed DOCX/PPTX suites,
the multilingual suite, release artifact tests, and `git diff --check` before
handoff. Do not claim completion from unit DOM snapshots alone.

## Completion boundary

This design is complete when both primary file views share one persistent,
responsive, non-interactive brand identity at the same shell seam; the existing
Office Viewer mark with product name and format badge are visible according to
the responsive rules; full-screen presentation reading remains unbranded; all
format behavior and source-safety invariants are unchanged; `docs/brand.md`
matches the implemented policy; and fresh installed screenshots and tests
verify the result.

It does not authorize a new personal logo, broader creator promotion, clickable
branding, embedded-view branding, or additional DOCX features.
