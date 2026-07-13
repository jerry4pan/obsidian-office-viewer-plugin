# Ticket #4 Renderer Corpus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a legally distributable representative PPTX corpus through the installed Obsidian plugin, capture repeatable visual evidence, and report whether the first renderer meets the 80% readable-content M0 gate.

**Architecture:** Repository-authored PptxGenJS fixtures and a typed manifest define the corpus contract. A WebdriverIO suite opens every fixture through the same Vault → adapter → FileView path as Ticket #2, checks semantic markers, captures fixed-environment element screenshots, and compares them with approved PNG baselines. A pure report module turns observations into machine-readable JSON and Markdown summaries.

**Tech Stack:** TypeScript, Vitest, PptxGenJS, JSZip, WebdriverIO, wdio-obsidian-service, PNGJS, pixelmatch.

## Global Constraints

- All fixtures are repository-authored and MIT-distributable.
- Compatibility tests use the installed Obsidian plugin path and never call the renderer directly.
- Runs are local, read-only, and offline; source PPTX hashes must remain unchanged.
- Viewport is 1440 × 1000, light theme, 100% zoom, bundled/system Arial fallback.
- The M0 gate passes only when at least 80% of declared main-content markers are readable.
- Visual changes above the configured pixel threshold fail unless baselines are explicitly approved with a recorded reason.

---

### Task 1: Isolated test discovery and corpus contract

**Files:**
- Modify: `vitest.config.ts`
- Create: `tests/compatibility/corpus-manifest.ts`
- Create: `tests/compatibility/corpus-manifest.test.ts`

**Interfaces:**
- Produces: `corpusManifest`, `CorpusFixture`, `CORPUS_ENVIRONMENT`.

- [ ] **Step 1: Write failing manifest tests**

Assert unique fixture IDs and paths, coverage of every Ticket #4 feature, provenance, expected markers, classification, and baseline approval reasons.

- [ ] **Step 2: Verify RED**

Run `npm test -- tests/compatibility/corpus-manifest.test.ts`; expect failure because the manifest module is absent.

- [ ] **Step 3: Implement the typed manifest and exclude `.worktrees/**` from Vitest**

Define five focused fixtures covering text/theme/master/wide layout, images/transparency/standard layout, tables/charts, native grouped and rotated shapes, and a complex SVG drawing.

- [ ] **Step 4: Verify GREEN**

Run `npm test -- tests/compatibility/corpus-manifest.test.ts`; expect all manifest tests to pass.

- [ ] **Step 5: Commit**

Commit as `test: define representative PPTX corpus contract`.

### Task 2: Reproducible compatibility fixtures

**Files:**
- Create: `scripts/generate-compatibility-fixtures.mjs`
- Create: `tests/compatibility/fixture-generator.test.ts`
- Create: `tests/fixtures/compatibility/*.pptx`
- Create: `tests/vault/compatibility/*.pptx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/fixtures/README.md`

**Interfaces:**
- Consumes: filenames declared by `corpusManifest`.
- Produces: byte-identical fixture/vault pairs and stable normal-run hashes.

- [ ] **Step 1: Write failing generator tests**

Run the generator without `--force`, assert every declared PPTX exists in both locations, hashes stay stable, pairs are identical, and grouped-shapes XML contains `p:grpSp`.

- [ ] **Step 2: Verify RED**

Run `npm test -- tests/compatibility/fixture-generator.test.ts`; expect missing generator/fixtures.

- [ ] **Step 3: Implement minimal generation**

Generate repository-authored slides with explicit metadata and deterministic content. Patch the grouped fixture package with JSZip so it contains a native DrawingML group rather than a visual imitation.

- [ ] **Step 4: Verify GREEN and fixture stability**

Run the focused test twice; both runs must pass without changing committed PPTX files.

- [ ] **Step 5: Commit**

Commit as `test: add representative PPTX compatibility corpus`.

### Task 3: Compatibility observations and report model

**Files:**
- Create: `src/compatibility/compatibility-report.ts`
- Create: `tests/compatibility/compatibility-report.test.ts`

**Interfaces:**
- Produces: `summarizeCompatibility(observations, threshold)` returning counts, readable ratio, gate result, and per-fixture classifications; `renderCompatibilityMarkdown(summary)`.

- [ ] **Step 1: Write failing report tests**

Cover marker ratio calculation, supported/degraded/failed classification, 80% boundary behavior, and deterministic Markdown output.

- [ ] **Step 2: Verify RED**

Run `npm test -- tests/compatibility/compatibility-report.test.ts`; expect missing module.

- [ ] **Step 3: Implement pure report functions**

Use observed visible markers as the denominator and preserve documented visual-review classifications/reasons from the manifest.

- [ ] **Step 4: Verify GREEN**

Run the focused test and then `npm test`; expect all tests to pass.

- [ ] **Step 5: Commit**

Commit as `feat: summarize PPTX compatibility results`.

### Task 4: Installed-plugin visual compatibility run

**Files:**
- Create: `tests/e2e/pptx-compatibility.e2e.ts`
- Create: `tests/compatibility/visual-regression.ts`
- Create: `tests/compatibility/visual-regression.test.ts`
- Create: `tests/compatibility/baselines/*.png`
- Create: `docs/compatibility/aiden-pptx-renderer-1.2.4.md`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: corpus manifest, installed Obsidian plugin, approved PNG baselines.
- Produces: ignored `artifacts/compatibility/results.json`, current screenshots and Markdown; committed baselines and reviewed renderer report.

- [ ] **Step 1: Write failing visual/report tests**

Assert same-size PNG comparison, material-difference rejection, and required approval metadata.

- [ ] **Step 2: Verify RED**

Run the focused visual test; expect missing comparison module.

- [ ] **Step 3: Implement visual comparison and E2E corpus loop**

Set the fixed window/environment, open each vault path with `obsidianPage.openFile`, wait for ready, collect visible markers, save the slide element screenshot, compare or explicitly update baselines, verify source hashes, and write JSON/Markdown artifacts.

- [ ] **Step 4: Approve and visually inspect initial baselines**

Run `UPDATE_COMPATIBILITY_BASELINES=1 npm run test:compatibility`, inspect every PNG, record supported/degraded/failed outcomes and reasons, then rerun without the environment variable to prove unexplained drift fails.

- [ ] **Step 5: Verify the M0 gate and full suite**

Run `npm run verify`, `npm run test:e2e`, `npm run test:compatibility`, and `npm audit --omit=dev`. Require at least 80% readable main-content markers and no source fixture changes.

- [ ] **Step 6: Commit**

Commit as `test: add installed PPTX compatibility acceptance`.

## Self-Review

- Spec coverage: every Ticket #4 acceptance criterion maps to Tasks 1–4; screenshots use the Ticket #2 path and results include provenance, environment, classifications, readability and visual drift enforcement.
- Placeholder scan: no deferred implementation placeholders are present.
- Type consistency: `CorpusFixture`, compatibility observations, summary and visual comparison interfaces have one producer and named consumers.
