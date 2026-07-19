# Live Preview slide embed technical report

- Status: PRODUCTIZED in 0.1.11
- Date: 2026-07-19
- Branch: `codex/live-preview-feasibility`
- Parent Spec: #42
- Tickets: #43 → #44 (GO) → #45 / #47 / #46 → #48

## Verdict

The bounded technical exploration produced a candidate that passes focused
CodeMirror coverage and installed Obsidian evidence for Live Preview rendering,
syntax revelation, trusted failure states, viewport-bounded concurrency, and
the declared minimum Obsidian version. Production bundle growth was re-measured
under the installed performance protocol and promoted with a reviewed,
separately versioned provenance lock.

A post-implementation review noted that real IME and the complete
editing-operation matrix, plus Live Preview-specific
split/pop-out/plugin-disable/note-close/application-close lifecycle paths, were
not fully recorded as separate installed matrices. The maintainer still
approved productization after local Vault verification and shipped the
candidate in **0.1.11**. Remaining matrix gaps stay as follow-up hardening, not
as blockers for the shipped standalone-line Live Preview contract.

This report is **not** **Real-reader workflow validation** and does not close
M4.

## Environment

| Item | Value |
|---|---|
| Obsidian under test | v1.12.7 (installer v1.12.7, darwin) |
| Declared minimum (`manifest.json`) | v1.8.10 (installer v1.5.8, darwin) — core LP suite 5/5 passed |
| Plugin version | 0.1.11 |
| Renderer ADR | `@aiden0z/pptx-renderer@1.2.4` — unchanged |
| Machine (performance promotion) | oulongdeMac-mini.local (Apple M2, 16 GiB) |
| Production bundle (promoted) | 1,264,110 bytes |

## Architecture delivered

1. **Shared core** (`src/slide-embed-core.ts`): host-agnostic chrome, scheduler
   work, stable identity, diagnostics, cancel/dispose.
2. **Reading View adapter** (`src/pptx-slide-embed.ts`): MarkdownRenderChild +
   native embed hide/restore + IntersectionObserver visibility.
3. **Live Preview extension** (`src/live-preview-slide-embed.ts`): public
   `registerEditorExtension`, `editorLivePreviewField`, viewport-derived
   `StateField` + `Prec.highest` block replace widgets, semantic code-block
   exclusion, document-local observers/DOM, and a surface monitor that clears
   widgets when Reading View hides the source editor. Explicit source navigation
   is wired on the widget DOM.
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

npm run test:e2e:live-preview:min
# same five core LP scenarios on Obsidian 1.8.10 / installer 1.5.8

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
| Promoted JSON | `tests/performance/baselines/aiden-pptx-renderer-1.2.4-2026-07-19.json` |
| Provenance lock | `tests/performance/baselines/aiden-pptx-renderer-1.2.4-2026-07-19.lock.json` |
| Report | `docs/performance/aiden-pptx-renderer-1.2.4-2026-07-19.md` |

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
- Real installed IME and the full keyboard/mouse editing matrix remain required.
- A focused cross-window realm test now covers document-local DOM, event and
  observer ownership, but an installed LP-specific pop-out/split/disable/close
  lifecycle matrix remains required.

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
4. Post-implementation review found whole-document scanning, main-window DOM
   constructors, code-block false positives, duplicate source resolution, and
   overwritten performance evidence. These were corrected with viewport-bound
   syntax-aware decoration discovery, document-local DOM/observers, one source
   resolver, and a dated performance evidence ID that preserves the prior run.

## Productization gate

Maintainer productization approval for **0.1.11** is recorded. The shipped
contract is standalone-line canonical Live Preview slide embeds with shared
Reading View failure and concurrency bounds. Remaining installed IME and
LP-specific lifecycle matrices are follow-up hardening, not release blockers for
this contract.

Do not treat this report as **Real-reader workflow validation**.
