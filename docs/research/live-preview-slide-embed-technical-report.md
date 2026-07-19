# Live Preview slide embed technical report

- Status: GO FOR TECHNICAL CANDIDATE
- Date: 2026-07-19
- Branch: `codex/live-preview-feasibility`
- Parent Spec: #42
- Tickets: #43 → #44 (GO) → #45 / #47 / #46 → #48

## Verdict

The bounded technical exploration produced a mergeable-quality candidate that
passes focused CodeMirror coverage and installed Obsidian evidence for Live
Preview rendering, syntax revelation, trusted failure states, and
viewport-bounded concurrency shared with Reading View. Production bundle growth
was re-measured under the installed performance protocol and promoted with a
reviewed provenance lock.

This is **not** productization authorization, a release, a version bump, a
merge to `main`, closure of M4, or **Real-reader workflow validation**.

## Environment

| Item | Value |
|---|---|
| Obsidian under test | v1.12.7 (installer v1.12.7, darwin) |
| Declared minimum (`manifest.json`) | 1.8.10 — unchanged |
| Plugin version | 0.1.10 — unchanged |
| Renderer ADR | `@aiden0z/pptx-renderer@1.2.4` — unchanged |
| Machine (performance promotion) | oulongdeMac-mini.local (Apple M2, 16 GiB) |
| Production bundle (promoted) | 1,264,110 bytes |

## Architecture delivered

1. **Shared core** (`src/slide-embed-core.ts`): host-agnostic chrome, scheduler
   work, stable identity, diagnostics, cancel/dispose.
2. **Reading View adapter** (`src/pptx-slide-embed.ts`): MarkdownRenderChild +
   native embed hide/restore + IntersectionObserver visibility.
3. **Live Preview extension** (`src/live-preview-slide-embed.ts`): public
   `registerEditorExtension`, `editorLivePreviewField`, `StateField` +
   `Prec.highest` block replace widgets, IntersectionObserver visibility,
   surface monitor that clears widgets when Reading View hides the source
   editor. Explicit source navigation is wired on the widget DOM.
4. **Standalone-line matcher** (`matchStandaloneSlideEmbedLine` in
   `src/slide-reference.ts`): sole parser seam for LP line recognition; still
   delegates identity to `parseSlideReferenceLink`.

## Gate evidence

### Unit / focused

```bash
npm test
npm run release:check
npm audit --omit=dev
npm run test:performance:baseline
```

Live Preview focused suites:

- `tests/slide-embed-core.test.ts`
- `tests/slide-embed-line.test.ts`
- `tests/live-preview-slide-embed.test.ts`
- `tests/live-preview-slide-embed-editing.test.ts`
- `tests/live-preview-slide-embed-failures.test.ts`
- `tests/live-preview-slide-embed-lifecycle.test.ts`

### Installed Obsidian

```bash
npx wdio run wdio.conf.mts --spec tests/e2e/pptx-live-preview-embed.e2e.ts
# render/reveal/source action, syntax matrix + mode trips,
# trusted failures, ten-embed concurrency (maxLoading ≤ 2)

npx wdio run wdio.conf.mts --spec tests/e2e/pptx-reference.e2e.ts \
  --mochaOpts.grep 'renders a source-backed single slide in Reading View'
```

Cross-cutting installed suites retained for #48 (locales, keyboard/theme, split):

- `tests/e2e/multilingual.e2e.ts`
- `tests/e2e/pptx-m2.e2e.ts` (keyboard focus / theme variables)
- `tests/e2e/pptx-reference.e2e.ts` (split-leaf reference navigation)

### Performance baseline promotion

Bundle exceeded the prior 1,200,758-byte +5% allowance. Per
`docs/performance/README.md`, the installed protocol was re-run twice with
identical `bundleBytes=1264110` and promoted byte-for-byte:

| Field | Value |
|---|---|
| Accepted run IDs | `a788bc9d-…`, `8fe83b4c-…` |
| First-readable p95 | 120.8 ms (budget ≤ 3,000 ms) |
| Slide-switch p95 | 2.8 ms (budget ≤ 100 ms) |
| Promoted JSON | `tests/performance/baselines/aiden-pptx-renderer-1.2.4.json` |
| Provenance lock | `tests/performance/baselines/aiden-pptx-renderer-1.2.4.lock.json` |
| Report | `docs/performance/aiden-pptx-renderer-1.2.4.md` |

```bash
npm run test:performance   # run 1 — retained, not yet eligible
npm run test:performance   # run 2 — eligibleForPromotion=true
npm run test:performance:baseline  # PASS after promotion
```

### Integrity / offline

Ten-embed Live Preview run recorded unchanged PPTX SHA-256 values and zero
application network requests via the existing network guard. Persistent plugin
data remains settings-only (no slide content / renderer state).

### Known limits retained (not weakened)

- No public experimental flag
- No disk snapshot / persistent embed cache
- No minimum Obsidian version change
- Mobile out of scope
- Plain `![[deck.pptx]]` remains native Obsidian behavior
- IME coverage relies on Obsidian editing surface; focused CM matrix covers
  selection/doc invariants rather than every IME engine
- Pop-out window coverage remains the existing Obsidian leaf/window contracts
  used by prior M2/reference suites; no LP-specific pop-out harness was added

## Failed attempts retained

1. Initial ViewPlugin-only replace decorations lost to Obsidian's native
   `file-embed` block widget. Resolved with `StateField` + `Prec.highest` +
   `block: true`.
2. Hidden Live Preview widgets remained after switching to Reading View and
   poisoned Reading View selectors. Resolved by monitoring
   `.markdown-source-view` visibility and clearing decorations when the source
   surface is hidden.
3. Source-only size trimming (~3 KB) was insufficient to stay inside the prior
   bundle budget; the correct remedy was a two-consecutive-clean-run performance
   promotion, not a silent budget raise.

## Productization request

**GO for maintainer review of productization** on
`codex/live-preview-feasibility`. Recommended next maintainer decisions
(outside this Spec):

1. Whether to merge the candidate
2. Whether README / help copy should ship as user-facing v0.1.x behavior
3. Whether any follow-up is needed before closing broader milestone work

Do not treat this report as **Real-reader workflow validation**.
