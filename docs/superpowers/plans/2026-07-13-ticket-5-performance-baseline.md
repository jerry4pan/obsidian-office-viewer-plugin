# Installed PPTX Performance Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable installed-Obsidian benchmark that measures the current PPTX adapter against M0 latency, memory, cancellation, cleanup, and bundle-size budgets.

**Architecture:** The product view exposes candidate-independent timing data and real next/previous controls. A dedicated WebdriverIO suite opens committed representative and stress PPTX fixtures through the installed plugin, samples Electron renderer memory, exercises navigation and cancellation, then writes one typed JSON result and deterministic Markdown summary. Report math is isolated from WebdriverIO and unit tested.

**Tech Stack:** TypeScript 7, Vitest, WebdriverIO 9, wdio-obsidian-service, Electron/Obsidian, PptxGenJS, Node.js.

## Global Constraints

- Run through the installed Obsidian plugin and `PptxRendererAdapter`; do not call the renderer library directly.
- Representative input must remain at most 20 MB and 50 slides; include a separate cancellation/memory stress input.
- Record device, OS, Obsidian/Electron, renderer, cold/warm definitions, warmups, and samples.
- Report p50, p95, and failures; preserve raw observations.
- M0 budgets are first readable slide p95 <= 3,000 ms and rendered page switch p95 <= 100 ms.
- Closing/unloading must stop unfinished work and release related resources inside the documented observation window.
- A failed budget remains a recorded FAIL; samples and thresholds must not be reduced to obtain PASS.

---

### Task 1: Product timing and navigation contract

**Files:**
- Modify: `src/pptx-view-session.ts`
- Modify: `styles.css`
- Modify: `tests/pptx-view-session.test.ts`

**Interfaces:**
- Consumes: `PptxRendererSession.renderSlide(index)` and `slideCount`.
- Produces: root datasets `metadataMs`, `firstReadableMs`, `lastSlideSwitchMs`; buttons `[data-action="previous-slide"]` and `[data-action="next-slide"]`.

- [x] **Step 1: Write failing timing/navigation tests**

```ts
expect(root.dataset.metadataMs).toMatch(/^\d/);
expect(root.dataset.firstReadableMs).toMatch(/^\d/);
root.querySelector<HTMLButtonElement>('[data-action="next-slide"]')?.click();
await vi.waitFor(() => expect(rendererSession.renderSlide).toHaveBeenLastCalledWith(1));
expect(root.textContent).toContain("2 / 3");
expect(root.dataset.lastSlideSwitchMs).toMatch(/^\d/);
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/pptx-view-session.test.ts`
Expected: FAIL because timing datasets and navigation controls do not exist.

- [x] **Step 3: Implement candidate-independent timings and controls**

```ts
const openedAt = performance.now();
const buffer = await this.reader.readBinary(file);
const rendererSession = await this.renderer.open(buffer, slideContainer, controller.signal);
this.root.dataset.metadataMs = (performance.now() - openedAt).toFixed(3);
await rendererSession.renderSlide(0);
this.root.dataset.firstReadableMs = (performance.now() - openedAt).toFixed(3);
```

Create previous/next buttons outside the renderer container. On navigation, measure only `renderSlide(index)`, guard against stale generations, update the counter, and restore button state. Clear all timing datasets on a new open and disposal.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- --run tests/pptx-view-session.test.ts`
Expected: PASS, including disposal and reopen coverage.

### Task 2: Deterministic benchmark fixtures and report math

**Files:**
- Create: `scripts/generate-performance-fixtures.mjs`
- Create: `tests/performance/performance-fixtures.ts`
- Create: `tests/fixtures/performance/representative-12-slides.pptx`
- Create: `tests/fixtures/performance/stress-200-slides.pptx`
- Create: `tests/vault/performance/representative-12-slides.pptx`
- Create: `tests/vault/performance/stress-200-slides.pptx`
- Create: `src/performance/performance-report.ts`
- Create: `tests/performance/performance-report.test.ts`
- Modify: `tests/fixtures/README.md`

**Interfaces:**
- Produces: `summarizePerformance(input): PerformanceSummary`, `renderPerformanceMarkdown(summary): string`, stable `performanceFixtureManifest`.
- Consumes: raw sample arrays in milliseconds/bytes and the fixed M0 budgets.

- [x] **Step 1: Write failing percentile and gate tests**

```ts
const summary = summarizePerformance({
  firstReadableMs: [1000, 2000, 3100],
  slideSwitchMs: [40, 80, 120],
  failures: [],
  // environment and resource fields supplied by the fixture factory
});
expect(summary.firstReadable.p95).toBe(3100);
expect(summary.gates.firstReadable.passed).toBe(false);
expect(summary.gates.slideSwitch.passed).toBe(false);
```

- [x] **Step 2: Run report tests and verify RED**

Run: `npm test -- --run tests/performance/performance-report.test.ts`
Expected: FAIL because the report module does not exist.

- [x] **Step 3: Implement fixture generation and report functions**

Use nearest-rank percentile (`ceil(p * n) - 1`) on sorted finite samples. Generate 12 representative slides with text, shapes, table/image content, and 200 stress slides with unique text/shapes. Assert the representative file size and slide count in generator tests; normal fixture commands copy committed bytes and `:regenerate` intentionally rewrites them.

- [x] **Step 4: Run fixture/report tests and verify GREEN**

Run: `npm run fixtures:performance && npm test -- --run tests/performance`
Expected: PASS with stable copied fixture hashes and deterministic report text.

### Task 3: Installed Electron benchmark collector

**Files:**
- Create: `tests/e2e/pptx-performance.performance.ts`
- Create: `tests/performance/electron-memory.ts`
- Create: `wdio.performance.conf.mts`
- Modify: `package.json`

**Interfaces:**
- Consumes: view timing datasets, navigation buttons, fixture manifest, report functions.
- Produces: `artifacts/performance/results.json` and `artifacts/performance/summary.md` with raw observations, p50/p95, failure samples, environment, memory, cancellation, cleanup, and `main.js` bytes.

- [x] **Step 1: Add an installed-path test that initially fails on missing collector data**

```ts
await obsidianPage.openFile("performance/representative-12-slides.pptx");
const root = await browser.$('.workspace-leaf.mod-active .pptx-viewer[data-state="ready"]');
expect(Number(await root.getAttribute("data-first-readable-ms"))).toBeGreaterThan(0);
await root.$('[data-action="next-slide"]').click();
expect(Number(await root.getAttribute("data-last-slide-switch-ms"))).toBeGreaterThanOrEqual(0);
```

- [x] **Step 2: Run installed benchmark and verify RED**

Run: `npm run test:performance`
Expected: FAIL before the collector/configuration is complete.

- [x] **Step 3: Implement repeated sampling, memory, cancellation, and cleanup**

Run one documented cold observation, two warmups, and ten measured warm opens on the representative deck. Sample Electron renderer `heapUsed`/`rss` during open, after ready, and after close plus garbage collection in a 2,000 ms observation window. Measure five stress cancellations from loading state to detached/no-viewer state. Record bundle bytes from the production `main.js`; never discard failed observations.

- [x] **Step 4: Run installed benchmark and verify GREEN or an honest budget FAIL report**

Run: `npm run test:performance`
Expected: collector completes, artifacts are structurally valid, cleanup/cancellation invariants pass; latency gates are reported from raw data even if a budget is missed.

### Task 4: Commit the reference baseline and document the verdict

**Files:**
- Create: `tests/performance/baselines/aiden-pptx-renderer-1.2.4.json`
- Create: `docs/performance/aiden-pptx-renderer-1.2.4.md`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: the exact `artifacts/performance/results.json` and `summary.md` produced by Task 3.
- Produces: committed evidence for Ticket #6 and Ticket #7, plus a repeat command.

- [x] **Step 1: Run the production benchmark on the reference machine**

Run: `npm run test:performance`
Expected: JSON and Markdown artifacts include device/OS/runtime/candidate versions, raw observations, p50/p95, failures, and gate verdicts.

- [x] **Step 2: Promote artifacts without editing measurements**

Copy the generated JSON byte-for-byte to `tests/performance/baselines/aiden-pptx-renderer-1.2.4.json` and Markdown to `docs/performance/aiden-pptx-renderer-1.2.4.md`. Add provenance and repeat instructions outside measured fields only.

- [x] **Step 3: Run all verification**

Run: `git diff --check && npm run verify && npm run test:e2e && npm run test:compatibility && npm run test:performance && npm audit --omit=dev`
Expected: all correctness/resource checks pass; performance budget outcomes in the report match the raw p95 measurements.

- [x] **Step 4: Commit**

```bash
git add README.md package.json package-lock.json src styles.css scripts tests docs wdio.performance.conf.mts
git commit -m "perf: establish installed PPTX baseline"
```

## Self-Review

- Spec coverage: installed path, environment, representative/stress corpus, all requested timings, memory, cancellation, cleanup, bundle, p50/p95, failures, budgets, and comparable output each map to Tasks 1-4.
- Placeholder scan: no deferred implementation or silent threshold adjustment remains.
- Type consistency: view dataset names and report/fixture interfaces are identical in producer and consumer tasks.
