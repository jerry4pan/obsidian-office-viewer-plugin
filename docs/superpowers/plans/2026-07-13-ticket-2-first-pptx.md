# Ticket #2 First Local PPTX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first complete tracer bullet in which an installed Obsidian desktop plugin opens a local `.pptx` from a Vault and renders slide 1 through a replaceable renderer adapter without modifying the source file or using the network.

**Architecture:** Obsidian integration is a thin `FileView` and plugin registration layer. A `PptxViewSession` owns the asynchronous open/ready/error lifecycle and depends only on `VaultBinaryReader` plus `PptxRendererAdapter`; the first adapter wraps `@aiden0z/pptx-renderer` 1.2.4. Tests exercise the adapter with a generated real PPTX, the session with a fake adapter, plugin registration with an Obsidian API test double, and the packaged plugin in a sandboxed Obsidian instance.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild, Vitest + happy-dom, `@aiden0z/pptx-renderer` 1.2.4, PptxGenJS fixture generation, WebdriverIO 9 + `wdio-obsidian-service` 3.1.1.

## Global Constraints

- Desktop-only Obsidian community plugin.
- Support `.pptx` only; do not handle legacy `.ppt`.
- Read source bytes through the Vault abstraction and never write to the source file.
- Keep all `@aiden0z/pptx-renderer` types and objects inside its adapter.
- Use `RECOMMENDED_ZIP_LIMITS`, disable optional PDF.js fallback, and perform no network requests.
- Do not call Office, LibreOffice, PDF conversion, cloud viewers, or document servers.
- Dispose renderer resources on file replacement, view close, and plugin unload.
- Use Conventional Commits with a concrete subject.

---

### Task 1: Bootstrap a buildable plugin and reproducible PPTX fixture

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `manifest.json`
- Create: `versions.json`
- Create: `styles.css`
- Create: `scripts/generate-minimal-fixture.mjs`
- Create: `tests/fixtures/README.md`
- Generate: `tests/fixtures/minimal.pptx`
- Create: `tests/vault/minimal.pptx`

**Interfaces:**
- Produces: build/test commands, the plugin manifest, and one deterministic PPTX whose first slide contains `Obsidian PPTX smoke test`.

- [ ] **Step 1: Add the project manifest and tool configuration**

Define scripts for `fixtures`, `typecheck`, `build`, `test`, `test:e2e`, and `verify`. Pin the first candidate at `@aiden0z/pptx-renderer` 1.2.4. Mark `obsidian` and Electron/Node built-ins external in esbuild; bundle the renderer and its browser dependencies into `main.js`.

- [ ] **Step 2: Add the deterministic fixture generator**

Use PptxGenJS to create a 16:9 single-slide presentation with a white background and one text box reading `Obsidian PPTX smoke test`. Set fixed author, company, subject, title, language, layout, font, font size, color, position, and output filename.

- [ ] **Step 3: Generate and copy the fixture**

Run: `npm install && npm run fixtures`

Expected: `tests/fixtures/minimal.pptx` and the identical `tests/vault/minimal.pptx` exist; a second generation produces identical logical content and both copies have matching SHA-256 hashes.

- [ ] **Step 4: Verify the empty production entry still fails the build for the expected reason**

Run: `npm run build`

Expected: FAIL because `src/main.ts` does not exist. This confirms the build is pointed at the intended production entry before implementation.

- [ ] **Step 5: Commit the bootstrap**

```bash
git add package.json package-lock.json tsconfig.json esbuild.config.mjs manifest.json versions.json styles.css scripts tests/fixtures tests/vault
git commit -m "chore: bootstrap Obsidian plugin toolchain"
```

### Task 2: Define and implement the real renderer adapter with TDD

**Files:**
- Create: `src/renderer/pptx-renderer-adapter.ts`
- Create: `src/renderer/aiden-pptx-renderer-adapter.ts`
- Create: `tests/renderer/aiden-pptx-renderer-adapter.test.ts`
- Create: `tests/setup-dom.ts`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `PptxRendererAdapter.open(buffer, container, signal): Promise<PptxRendererSession>`.
- Produces: `PptxRendererSession.slideCount`, `renderSlide(index)`, and `dispose()`.

- [ ] **Step 1: Write the failing real-fixture adapter test**

The test reads `minimal.pptx`, opens it through `AidenPptxRendererAdapter`, and asserts `slideCount === 1`, slide 0 produces visible DOM containing `Obsidian PPTX smoke test`, and `dispose()` empties/releases the owned view. It also asserts an already-aborted signal rejects with an abort error.

- [ ] **Step 2: Run the adapter test and verify RED**

Run: `npm test -- tests/renderer/aiden-pptx-renderer-adapter.test.ts`

Expected: FAIL because the adapter modules do not exist.

- [ ] **Step 3: Add the renderer-neutral contract**

```ts
export interface PptxRendererSession {
  readonly slideCount: number;
  renderSlide(index: number): Promise<void>;
  dispose(): void;
}

export interface PptxRendererAdapter {
  open(
    buffer: ArrayBuffer,
    container: HTMLElement,
    signal: AbortSignal,
  ): Promise<PptxRendererSession>;
}
```

- [ ] **Step 4: Implement the first adapter minimally**

Wrap `PptxViewer.open` with `RECOMMENDED_ZIP_LIMITS`, slide render mode, fit mode `contain`, `pdfjs: false`, and the caller's abort signal. Return a small wrapper exposing only slide count, `renderSlide`, and idempotent `dispose`; call the library's `destroy()` during disposal.

- [ ] **Step 5: Run GREEN and typecheck**

Run: `npm test -- tests/renderer/aiden-pptx-renderer-adapter.test.ts && npm run typecheck`

Expected: PASS with no warnings or unhandled async work.

- [ ] **Step 6: Commit the adapter**

```bash
git add src/renderer tests/renderer tests/setup-dom.ts vitest.config.ts
git commit -m "feat: add replaceable PPTX renderer adapter"
```

### Task 3: Drive the viewer lifecycle through a renderer-neutral session

**Files:**
- Create: `src/pptx-view-session.ts`
- Create: `tests/pptx-view-session.test.ts`

**Interfaces:**
- Consumes: `PptxRendererAdapter`.
- Produces: `VaultBinaryReader.readBinary(file): Promise<ArrayBuffer>`.
- Produces: `PptxViewSession.open(file)`, `dispose()`, and user-visible `data-state` values `loading`, `ready`, or `error`.

- [ ] **Step 1: Write failing session tests**

Cover: loading → ready after binary read and slide 0 render; exactly one binary read; renderer-neutral slide count display; old work aborted/disposed on reopen; resources disposed on close; and source bytes never passed to a writer because the session accepts only a read interface.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/pptx-view-session.test.ts`

Expected: FAIL because `PptxViewSession` does not exist.

- [ ] **Step 3: Implement the minimal lifecycle**

Create a root with status and slide containers. On `open`, abort/dispose the previous run, set `loading`, read binary, open the adapter, render slide 0, set `1 / <slideCount>`, then set `ready`. Ignore stale completions after abort. On non-abort failures set `error` with a stable message. `dispose()` is idempotent.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- tests/pptx-view-session.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the lifecycle**

```bash
git add src/pptx-view-session.ts tests/pptx-view-session.test.ts
git commit -m "feat: add PPTX view loading lifecycle"
```

### Task 4: Register the Obsidian PPTX file view

**Files:**
- Create: `src/pptx-file-view.ts`
- Create: `src/main.ts`
- Create: `tests/plugin-registration.test.ts`
- Create: `tests/obsidian-test-double.ts`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `PptxViewSession` and `AidenPptxRendererAdapter`.
- Produces: view type `pptx-viewer`, extension registration for `pptx`, and a `FileView` that reads via `app.vault.readBinary`.

- [ ] **Step 1: Write the failing plugin registration test**

Load the plugin with an Obsidian API test double and assert `registerView("pptx-viewer", factory)` and `registerExtensions(["pptx"], "pptx-viewer")` are called. Instantiate the view factory, attach a fake `TFile`, invoke file-open lifecycle, and assert the session receives the Vault binary reader path. Unload and assert open resources are disposed.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/plugin-registration.test.ts`

Expected: FAIL because the plugin entry and file view do not exist.

- [ ] **Step 3: Implement the thin Obsidian integration**

The default plugin class registers the view and `.pptx` extension in `onload`. `PptxFileView` extends `FileView`, creates one session per view, opens the assigned file through `app.vault.readBinary`, and disposes the session in `onClose`. No `@aiden0z/pptx-renderer` import is permitted outside its adapter.

- [ ] **Step 4: Add scoped presentation styles**

Style only descendants of `.pptx-viewer`: full-size root, centered slide viewport, loading/error status, white slide surface, and contained overflow. Add `data-state` hooks used by the e2e test.

- [ ] **Step 5: Run GREEN and build**

Run: `npm test -- tests/plugin-registration.test.ts && npm run build`

Expected: tests PASS and root `main.js` is produced.

- [ ] **Step 6: Commit the Obsidian slice**

```bash
git add src tests/plugin-registration.test.ts tests/obsidian-test-double.ts styles.css main.js
git commit -m "feat: open PPTX files in a dedicated view"
```

### Task 5: Prove the packaged plugin in a sandboxed Obsidian instance

**Files:**
- Create: `wdio.conf.mts`
- Create: `tests/e2e/open-pptx.e2e.ts`
- Create: `tests/vault/.obsidian/app.json`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: packaged `main.js`, `manifest.json`, `styles.css`, and `tests/vault/minimal.pptx`.
- Produces: one automated smoke test from a sandboxed Obsidian Vault file open to visible ready slide.

- [ ] **Step 1: Write the failing e2e test and config**

Configure one latest stable desktop Obsidian instance, the local plugin, and `tests/vault`. The test opens `minimal.pptx`, waits for `.pptx-viewer[data-state="ready"]`, asserts text `Obsidian PPTX smoke test` is visible, and verifies the page counter is `1 / 1`.

- [ ] **Step 2: Verify the e2e test detects a missing render**

Temporarily target a nonexistent ready selector and run `npm run test:e2e`; confirm the test fails by timeout/assertion, then restore the intended selector. This is the RED proof for the highest test seam.

- [ ] **Step 3: Run the real e2e test**

Run: `npm run test:e2e`

Expected: PASS in the sandboxed Obsidian instance without touching the user's normal Vault or configuration.

- [ ] **Step 4: Commit the installed-plugin smoke test**

```bash
git add package.json package-lock.json wdio.conf.mts tests/e2e tests/vault/.obsidian
git commit -m "test: cover installed PPTX open flow"
```

### Task 6: Record candidate provenance and verify the ticket

**Files:**
- Create: `docs/research/first-renderer-candidate.md`
- Create: `NOTICE`
- Modify: `README.md` if it exists; otherwise create it.

**Interfaces:**
- Consumes: verified implementation and package metadata.
- Produces: candidate provenance, license notice, exact verification commands, current limitations, and installation instructions.

- [ ] **Step 1: Document facts and provisional recommendation**

Record `@aiden0z/pptx-renderer` 1.2.4, Apache-2.0, its browser-native `PptxViewer`, ZIP limits, cleanup API, optional PDF.js being disabled, unpacked npm size, and its very recent release history. Label it explicitly as the first M0 candidate, not the final renderer decision. Link the official npm and GitHub sources.

- [ ] **Step 2: Run complete verification**

Run: `npm run verify && npm run test:e2e`

Expected: typecheck, unit/integration tests, production build, and installed-plugin smoke test all PASS with no warnings.

- [ ] **Step 3: Verify source immutability and offline behavior**

Compare SHA-256 of `tests/vault/minimal.pptx` before and after the e2e run. Inspect the e2e/browser network log and assert no application request is made by the plugin during open.

- [ ] **Step 4: Self-review against Ticket #2**

Check every acceptance criterion in #2, inspect `git diff --check`, and confirm `@aiden0z/pptx-renderer` is imported only in its adapter.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md NOTICE docs/research
git commit -m "docs: record first PPTX renderer candidate"
```
