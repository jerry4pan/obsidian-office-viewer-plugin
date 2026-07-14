# M1 Basic Reading Loop Design

## Status and authority

This design narrows the accepted `docs/prd/v0.1-first-public-release.md` M1
requirements into an implementation boundary. The PRD is already marked
Ready for implementation, ADR-0001 authorizes M1 on the selected Aiden
renderer, and the requested outcome is to complete M1 without pulling M2 work
forward.

## Scope

M1 ends when an installed desktop Obsidian plugin can open a local `.pptx`
from the Vault, render it without writing the source, navigate with previous,
next, and a validated page-number jump, retry a failed open, and offer the
operating-system default application as a fallback. The view has explicit
empty, loading, ready, degraded navigation, and blocking error states.

M1 does not add thumbnails, zoom, keyboard shortcuts, full-screen mode,
reading-position persistence, prefetching, or general compatibility warnings.
Those remain in M2 or M3 as assigned by the PRD.

## Approaches considered

### 1. Increment the existing `PptxViewSession` (selected)

Keep the M0 renderer, preflight decorator, `FileView`, and session lifecycle.
Add the missing controls and states at the existing product seam, then expand
the installed Obsidian acceptance test. This preserves the M0 safety and
performance evidence and limits changes to M1 behavior.

### 2. Extract a new controller and view model now

Moving navigation and lifecycle state into a new controller would make later
M2 work easier to extend, but it would turn M1 into an architectural rewrite.
The existing session remains small enough to review, and the current product
seam already has focused tests, so this is deferred until M2 state growth
justifies it.

### 3. Replace the DOM view with a component framework

A framework could make richer future UI easier, but it adds a dependency and
bundle cost without solving an M1 requirement. It would also invalidate more
of the current visual and performance evidence. This approach is rejected.

## Architecture and data flow

`PptxFileView` remains the Obsidian boundary. It creates one
`PptxViewSession`, reads through `Vault.readBinary`, and injects the desktop
external-open action. `PptxViewSession` owns only the DOM and view-local
lifecycle. It passes the immutable `ArrayBuffer` into `PptxRendererAdapter`,
which continues to hide renderer-specific APIs.

The ready toolbar contains previous and next buttons, a one-based numeric page
input, a total-page label, a jump button, and an external-open button when the
desktop action is available. All navigation routes call one zero-based
`navigate(targetIndex)` function. A navigation begins only for an integer in
range, disables navigation while rendering, and commits the current page only
after the adapter reports that the render completed without a slide-level
error.

## State and failure behavior

- `empty`: the view exists but no file has been supplied yet.
- `loading`: Vault reading, adapter opening, or first-slide rendering is in
  progress.
- `ready`: the current slide rendered and navigation is available.
- `degraded`: a later slide failed to render; the last successfully committed
  page number remains current, a non-blocking message is shown, and navigation
  is restored. The selected renderer may replace the slide canvas with its own
  error placeholder, so the viewer does not claim that old pixels remain.
- `error`: initial read/open/render failed; stable safe copy, retry, and the
  external fallback replace the viewer content.

Invalid page input never calls the renderer and never changes the current
page. It shows `Enter a slide number from 1 to N.` and returns focus to the
input. A slide-level renderer error shows an honest page-specific failure and
leaves the last successful page number committed. A successful navigation
clears that validation or degraded message.
External-open failures are reported locally and do not replace a readable
slide or reveal filesystem details.

## Test seams

The accepted PRD already fixes the seams:

1. `PptxViewSession` public DOM behavior for fast red-green cycles covering
   navigation boundaries, page jump validation, empty/loading/ready/degraded
   states, retry, fallback, stale work, and disposal.
2. The installed plugin in a sandboxed Obsidian Vault for the full path from
   file selection through Vault binary read, adapter rendering, navigation,
   no source mutation, bad-file isolation, retry, and fallback availability.
3. The existing renderer-contract, compatibility, safety, and performance
   suites remain regression gates; M1 does not couple product tests to Aiden
   internals.

## Acceptance evidence

M1 completion requires `npm run verify`, `npm run test:e2e`,
`npm run test:compatibility`, and `npm run test:performance:baseline` to pass.
The final report maps each M1 deliverable and exit condition to a source file,
test, or command result. The M1 GitHub milestone is closed only after that
evidence exists on the committed branch.
