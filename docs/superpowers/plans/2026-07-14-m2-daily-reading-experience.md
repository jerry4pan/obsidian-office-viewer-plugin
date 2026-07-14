# M2 Daily Reading Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the complete PRD M2 so the installed desktop plugin provides virtualized thumbnails, zoom, keyboard/full-screen reading, independent leaves, optional restart-safe position recovery, bounded progressive rendering, cancellation, resource release, theme support, and basic accessibility.

**Architecture:** Keep `PptxViewSession` as the public product seam while extracting a candidate-neutral viewer controller, virtualized thumbnail rail, single-concurrency priority queue, and plugin-level reading-position store. Expand `PptxRendererSession` only with project-owned capabilities; the selected Aiden adapter implements them with lazy parsing and disposable slide handles, while product code remains free of candidate objects.

**Tech Stack:** TypeScript 7, Obsidian 1.13 API, `@aiden0z/pptx-renderer@1.2.4`, Vitest/jsdom, WebdriverIO with `wdio-obsidian-service`, PptxGenJS, esbuild.

## Global Constraints

- Support `.pptx` only on desktop Obsidian; never add `.ppt`, mobile, editing, conversion, cloud, telemetry, accounts, licensing, or M3 diagnostic/release work.
- Read source bytes only through `Vault.readBinary`; no production path may call a Vault write API for PPTX content.
- Keep all Aiden and `pptx-preview` objects, DOM, errors, and resource handles behind `PptxRendererAdapter`.
- The default path stays offline and must not execute or fetch active/external content.
- Current-slide rendering runs ahead of all background work; the background queue has concurrency one and is generation-cancellable.
- Persist only the approved setting and `{path,size,mtime,slideIndex,updatedAt}`; never persist document text, images, author metadata, absolute paths, or rendered DOM.
- Manual zoom is 25–400% in 25-point steps; `100%` is fit-to-window.
- Thumbnail DOM is bounded by the viewport plus one viewport of overscan on either side.
- Existing M1 atomic navigation rollback, safe errors, retry, fallback, and source immutability remain regression gates.
- Fixed performance gates remain first-readable p95 `<= 3000 ms` and rendered-page switch p95 `<= 100 ms`.
- Use TDD for every behavior change: add one focused failing test, observe the expected failure, implement the minimum, and rerun the focused test before broader verification.

---

### Task 1: Track the complete M2 vertical slice

**Files:**
- Reference: `docs/prd/v0.1-first-public-release.md`
- Reference: `docs/superpowers/specs/2026-07-14-m2-daily-reading-experience-design.md`

**Interfaces:**
- Consumes: GitHub milestone `3`, canonical label `ready-for-agent`, and the approved M2 design.
- Produces: one M2 implementation issue whose checklists exactly mirror all seven deliverables and five exit-condition proofs.

- [ ] **Step 1: Create the implementation issue**

Run `gh issue create` with milestone `v0.1 M2 — 日常可用阅读体验`, label `ready-for-agent`, title `[M2] 完成日常可用的 PPTX 阅读体验`, and this exact body. Capture the returned URL and derive its numeric suffix into the shell variable `M2_ISSUE` for every later issue command:

```markdown
## Authority

- PRD: `docs/prd/v0.1-first-public-release.md` — M2
- Design: `docs/superpowers/specs/2026-07-14-m2-daily-reading-experience-design.md`

## Deliverables

- [ ] Virtualized thumbnail rail
- [ ] Fit-to-window, manual zoom, and reset
- [ ] Keyboard navigation and full-screen reading
- [ ] Independent state across workspace leaves
- [ ] Optional per-file reading-position persistence
- [ ] Progressive rendering, adjacent prefetch, cancellation, and resource release
- [ ] Light/dark theme and basic accessibility support

## Exit conditions

- [ ] The repository-authored 50-slide benchmark meets the fixed latency budgets
- [ ] The 200-slide stress deck does not schedule or mount every slide at once
- [ ] Close and file switch stop background tasks and release resources
- [ ] A valid page restores after an Obsidian restart
- [ ] Keyboard-only operation completes the core reading loop

## Invariants

- Local, offline, read-only `.pptx` viewing
- No M3 diagnostics/release packaging or later product scope
- No renderer-specific object outside the adapter
```

- [ ] **Step 2: Read back the issue and milestone**

Run:

```bash
gh issue view "$M2_ISSUE" --comments
gh api 'repos/jerry4pan/obsidian-office-viewer-plugin/milestones/3'
```

Expected: the issue is open, has `ready-for-agent`, belongs to milestone 3, and the milestone reports one open issue.

---

### Task 2: Add restart-safe reading-position storage

**Files:**
- Create: `src/reading-position-store.ts`
- Create: `tests/reading-position-store.test.ts`

**Interfaces:**
- Consumes: `OfficeViewerDataAdapter.loadData(): Promise<unknown>` and `saveData(data: OfficeViewerData): Promise<void>`.
- Produces: `FileFingerprint`, `OfficeViewerSettings`, and `ReadingPositionStore` with `initialize`, `resolve`, `record`, `rename`, `delete`, `setRememberReadingPosition`, `flush`, and `dispose`.

- [ ] **Step 1: Write failing default, validation, and privacy tests**

Add tests that exercise the wished-for public API:

```ts
const adapter = makeDataAdapter();
const store = new ReadingPositionStore(adapter, { debounceMs: 0 });
await store.initialize();

expect(store.settings).toEqual({ rememberReadingPosition: true });
store.record({ path: "deck.pptx", size: 42, mtime: 10 }, 7);
await store.flush();
expect(store.resolve({ path: "deck.pptx", size: 42, mtime: 10 }, 12)).toBe(7);
expect(store.resolve({ path: "deck.pptx", size: 43, mtime: 10 }, 12)).toBe(0);
expect(JSON.stringify(adapter.saved.at(-1))).not.toMatch(/filename|text|image|author/i);
```

Add separate tests for an index beyond `slideCount`, rename, deletion, last-event-wins, disabled load/save, disable-and-clear, serialized concurrent `saveData`, and `dispose()` flushing the latest entry.

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
npx vitest run tests/reading-position-store.test.ts
```

Expected: FAIL because `src/reading-position-store.ts` does not exist.

- [ ] **Step 3: Implement the schema and store**

Create these exact exported types and class surface:

```ts
export interface FileFingerprint {
  readonly path: string;
  readonly size: number;
  readonly mtime: number;
}

export interface OfficeViewerSettings {
  readonly rememberReadingPosition: boolean;
}

export interface ReadingPositionEntry extends FileFingerprint {
  readonly slideIndex: number;
  readonly updatedAt: number;
}

export interface OfficeViewerData {
  readonly schemaVersion: 1;
  readonly settings: OfficeViewerSettings;
  readonly positions: Record<string, ReadingPositionEntry>;
}

export interface OfficeViewerDataAdapter {
  loadData(): Promise<unknown>;
  saveData(data: OfficeViewerData): Promise<void>;
}

export class ReadingPositionStore {
  get settings(): OfficeViewerSettings;
  initialize(): Promise<void>;
  resolve(file: FileFingerprint, slideCount: number): number;
  record(file: FileFingerprint, slideIndex: number): void;
  rename(oldPath: string, file: FileFingerprint): void;
  delete(path: string): void;
  setRememberReadingPosition(enabled: boolean): Promise<void>;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}
```

Normalize all untrusted loaded data into a fresh schema. `resolve` returns zero and removes an entry unless path, size, mtime, integer index, and range all match. Chain saves through one promise so a slow earlier write cannot overwrite a later state. Disabling replaces `positions` with `{}` before saving.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
npx vitest run tests/reading-position-store.test.ts && npm run typecheck
```

Expected: all store tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the persistence core**

```bash
git add src/reading-position-store.ts tests/reading-position-store.test.ts
git commit -m "feat: add M2 reading position store"
```

---

### Task 3: Expand the renderer contract for M2 capabilities

**Files:**
- Modify: `src/renderer/pptx-renderer-adapter.ts`
- Modify: `src/renderer/aiden-pptx-renderer-adapter.ts`
- Modify: `src/renderer/pptx-preview-renderer-adapter.ts`
- Modify: `tests/renderer/aiden-pptx-renderer-adapter.test.ts`
- Modify: `tests/renderer/pptx-preview-renderer-adapter.test.ts`
- Modify: `tests/renderer/preflight-pptx-renderer-adapter.test.ts`
- Modify: `tests/renderer/create-pptx-renderer-adapter.test.ts`

**Interfaces:**
- Consumes: immutable `ArrayBuffer`, main container, `AbortSignal`, and candidate-owned slide APIs.
- Produces: parsed sessions with M2 metadata/capabilities and disposable thumbnail resources; adapter `open` no longer renders a main slide.

- [ ] **Step 1: Write failing contract tests**

For the selected Aiden adapter, prove that `open` leaves the main container empty, reports dimensions/capabilities, and supports the following calls:

```ts
expect(session.capabilities).toEqual({
  thumbnails: true,
  prefetch: true,
  zoom: true,
});
expect(session.slideWidth).toBeGreaterThan(0);
expect(session.slideHeight).toBeGreaterThan(0);
expect(container.childElementCount).toBe(0);

const thumbnailContainer = document.createElement("div");
const thumbnail = session.renderThumbnail!(0, thumbnailContainer, signal);
await thumbnail.ready;
thumbnail.dispose();
await session.prefetchSlide!(1, signal);
await session.setZoomPercent!(150);
```

Assert abort-before-thumbnail creates no resource, abort-during-ready disposes the handle, prefetch always disposes its detached handle, and session disposal releases every undisposed external handle. For `pptx-preview`, assert capabilities are false and optional methods are absent while main rendering still works.

- [ ] **Step 2: Run both adapter suites and verify red**

```bash
npx vitest run tests/renderer/aiden-pptx-renderer-adapter.test.ts tests/renderer/pptx-preview-renderer-adapter.test.ts
```

Expected: FAIL because the M2 metadata and operations are absent and Aiden `open` currently renders slide 1.

- [ ] **Step 3: Define the candidate-neutral contract**

Replace the session interface with this additive surface:

```ts
export interface PptxRendererCapabilities {
  readonly thumbnails: boolean;
  readonly prefetch: boolean;
  readonly zoom: boolean;
}

export interface PptxRendererResource {
  readonly ready: Promise<void>;
  dispose(): void;
}

export interface PptxRendererSession {
  readonly slideCount: number;
  readonly slideWidth: number;
  readonly slideHeight: number;
  readonly capabilities: PptxRendererCapabilities;
  renderSlide(index: number): Promise<void>;
  renderThumbnail?(
    index: number,
    container: HTMLElement,
    signal: AbortSignal,
  ): PptxRendererResource;
  prefetchSlide?(index: number, signal: AbortSignal): Promise<void>;
  setZoomPercent?(percent: number): Promise<void>;
  dispose(): void;
}
```

- [ ] **Step 4: Implement parse-only Aiden open and owned handles**

Use `parseZipLazyMedia(buffer, PPTX_ZIP_LIMITS)`, then
`buildPresentation(files, { lazySlides: true })`, check `signal` between
phases, call `viewer.load(presentation)`, and return the session without a
main render. Track every external `SlideHandle` in a `Set` through an
idempotent wrapper:

```ts
const resource: PptxRendererResource = {
  ready: handle.ready.then(() => signal.throwIfAborted()),
  dispose: () => {
    if (!resources.delete(resource)) return;
    handle.dispose();
  },
};
signal.addEventListener("abort", resource.dispose, { once: true });
```

`renderThumbnail` uses `viewer.renderThumbnailToContainer(index, container,
{ width: 144 })`. `prefetchSlide` uses `renderSlideToContainer` in a detached
container, awaits readiness, and disposes in `finally`. `setZoomPercent`
delegates to `viewer.setZoom(percent)`. Session `dispose` releases the tracked
resources before `viewer.destroy()`.

- [ ] **Step 5: Implement safe fallback capabilities for `pptx-preview` and decorators**

Store the viewport returned by `resolveViewport` as slide dimensions, expose
all-false capabilities, leave optional M2 methods undefined, and preserve its
parse-only `load` behavior. Forward the new metadata and methods through
`PreflightPptxRendererAdapter` without importing candidate types.

- [ ] **Step 6: Run renderer suites, contract regressions, and typecheck**

```bash
npx vitest run tests/renderer && npm run typecheck
```

Expected: all renderer test files PASS for both candidates.

- [ ] **Step 7: Commit the renderer seam**

```bash
git add src/renderer tests/renderer
git commit -m "feat(renderer): expose M2 reading capabilities"
```

---

### Task 4: Build the bounded background queue and virtual-window math

**Files:**
- Create: `src/render-task-queue.ts`
- Create: `src/thumbnail-virtual-window.ts`
- Create: `tests/render-task-queue.test.ts`
- Create: `tests/thumbnail-virtual-window.test.ts`

**Interfaces:**
- Consumes: keyed async work with `AbortSignal`, numeric priority, and optional result disposal.
- Produces: `RenderTaskQueue` and `computeThumbnailWindow` for the rail/controller.

- [ ] **Step 1: Write failing queue tests**

Cover priority, FIFO within priority, concurrency one, key de-duplication,
cancel-by-key, cancel-matching, clear/dispose, and stale result disposal:

```ts
const queue = new RenderTaskQueue();
const order: string[] = [];
const gate = deferred<void>();
void queue.enqueue({ key: "running", priority: 2, run: async () => gate.promise });
void queue.enqueue({ key: "overscan", priority: 2, run: async () => order.push("overscan") });
void queue.enqueue({ key: "adjacent", priority: 0, run: async () => order.push("adjacent") });
gate.resolve();
await queue.whenIdle();
expect(order).toEqual(["adjacent", "overscan"]);
expect(queue.maxObservedConcurrency).toBe(1);
```

- [ ] **Step 2: Write failing virtual-window tests**

Use 100 and 200 items at the beginning, middle, and end:

```ts
expect(computeThumbnailWindow({
  itemCount: 200,
  itemHeight: 110,
  scrollTop: 110 * 80,
  viewportHeight: 550,
  overscanViewports: 1,
})).toEqual({
  start: 75,
  endExclusive: 90,
  offsetTop: 8250,
  totalHeight: 22000,
});
```

Assert `endExclusive - start` remains bounded by visible items plus two
overscan viewports and never equals the deck size for 100/200 slides.

- [ ] **Step 3: Run both tests and verify red**

```bash
npx vitest run tests/render-task-queue.test.ts tests/thumbnail-virtual-window.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement exact public surfaces**

```ts
export interface RenderTask<T> {
  readonly key: string;
  readonly priority: number;
  readonly run: (signal: AbortSignal) => Promise<T>;
  readonly disposeResult?: (result: T) => void;
}

export class RenderTaskQueue {
  get diagnostics(): Readonly<{
    pending: number;
    running: number;
    disposed: boolean;
  }>;
  readonly maxObservedConcurrency: number;
  enqueue<T>(task: RenderTask<T>): Promise<T>;
  cancel(key: string): void;
  cancelMatching(predicate: (key: string) => boolean): void;
  clear(): void;
  whenIdle(): Promise<void>;
  dispose(): void;
}

export interface ThumbnailWindow {
  readonly start: number;
  readonly endExclusive: number;
  readonly offsetTop: number;
  readonly totalHeight: number;
}

export function computeThumbnailWindow(options: {
  readonly itemCount: number;
  readonly itemHeight: number;
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly overscanViewports: number;
}): ThumbnailWindow;
```

The queue sorts pending tasks by `(priority, sequence)`, starts one task at a
time, and returns the existing promise for a duplicate key. If cancellation
wins after `run` resolves, call `disposeResult` before rejecting with an
`AbortError`. `whenIdle` resolves only when pending and running work are both
empty.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
npx vitest run tests/render-task-queue.test.ts tests/thumbnail-virtual-window.test.ts && npm run typecheck
```

Expected: both test files PASS.

- [ ] **Step 6: Commit scheduling primitives**

```bash
git add src/render-task-queue.ts src/thumbnail-virtual-window.ts tests/render-task-queue.test.ts tests/thumbnail-virtual-window.test.ts
git commit -m "feat: add bounded M2 render scheduling"
```

---

### Task 5: Add the virtualized thumbnail rail

**Files:**
- Create: `src/thumbnail-rail.ts`
- Create: `tests/thumbnail-rail.test.ts`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `PptxRendererSession`, `RenderTaskQueue`, current slide index, and `onNavigate(index)`.
- Produces: `ThumbnailRail.start`, `setCurrentSlide`, `refresh`, and `dispose` plus approved accessible DOM actions.

- [ ] **Step 1: Write failing rail behavior tests**

Create a 200-slide renderer double and a rail element with `clientHeight =
550`. Assert:

```ts
const rail = new ThumbnailRail(root, renderer, queue, {
  onNavigate: vi.fn(),
  thumbnailWidth: 144,
  overscanViewports: 1,
});
rail.start(0);

expect(root.getAttribute("aria-label")).toBe("Slide thumbnails");
expect(root.querySelectorAll('[data-action="thumbnail-slide"]').length)
  .toBeLessThan(200);
expect(root.querySelector('[aria-current="page"]')?.getAttribute("aria-label"))
  .toBe("Slide 1");
```

Add tests for scroll-window replacement, thumbnail click, selected slide
scrolling into the mounted window, single-item failure placeholder, retry on
remount, abort/disposal on unmount, and full disposal of observers/resources.

- [ ] **Step 2: Run the rail test and verify red**

```bash
npx vitest run tests/thumbnail-rail.test.ts
```

Expected: FAIL because `ThumbnailRail` is missing.

- [ ] **Step 3: Implement the rail surface and DOM contract**

```ts
export interface ThumbnailRailOptions {
  readonly onNavigate: (index: number) => void;
  readonly thumbnailWidth?: number;
  readonly overscanViewports?: number;
  readonly createResizeObserver?: (
    callback: ResizeObserverCallback,
  ) => Pick<ResizeObserver, "observe" | "disconnect">;
}

export class ThumbnailRail {
  get mountedCount(): number;
  start(currentSlideIndex: number): void;
  setCurrentSlide(index: number): void;
  refresh(): void;
  dispose(): void;
}
```

Build a scroll container with `role="navigation"` and
`aria-label="Slide thumbnails"`, one total-height spacer, and one absolutely
positioned mounted layer. Each item is a button with
`data-action="thumbnail-slide"`, `data-slide-index`, `aria-label="Slide N"`,
and `aria-current="page"` only for the selected item. Use a 480px fallback
viewport when layout measurement is zero in jsdom.

Queue visible items at priority `1` and overscan-only items at `2`. Catch an
individual task error and render `Slide N preview unavailable`; never mutate
the main viewer state. Unmount cancels `thumbnail:N` and disposes its resource.

- [ ] **Step 4: Add scoped responsive/theme styles**

Add only `.pptx-viewer ...` selectors. Use Obsidian variables for backgrounds,
borders, muted text, interactive accent, and focus. Keep the rail 168px wide,
collapse it through `[data-thumbnails-collapsed="true"]`, and use
`aspect-ratio: var(--pptx-slide-aspect-ratio)` without assuming 16:9.

- [ ] **Step 5: Run rail tests, session regressions, and typecheck**

```bash
npx vitest run tests/thumbnail-rail.test.ts tests/pptx-view-session.test.ts && npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the thumbnail slice**

```bash
git add src/thumbnail-rail.ts tests/thumbnail-rail.test.ts styles.css
git commit -m "feat: add virtualized PPTX thumbnails"
```

---

### Task 6: Add the view-local controller for navigation, zoom, and prefetch

**Files:**
- Create: `src/pptx-viewer-controller.ts`
- Create: `tests/pptx-viewer-controller.test.ts`

**Interfaces:**
- Consumes: parsed `PptxRendererSession`, `RenderTaskQueue`, initial slide index, and a UI sink.
- Produces: one serialized current-page path plus `navigate`, `zoomIn`, `zoomOut`, `resetToFit`, diagnostics, and deterministic disposal.

- [ ] **Step 1: Write failing controller tests**

Define a sink double and prove initial restored render, atomic navigation,
boundary no-op, zoom clamping/mode, adjacent-first scheduling, navigation
failure, stale completion, and disposal:

```ts
const controller = new PptxViewerController(renderer, queue, sink, {
  initialSlideIndex: 7,
});
await controller.start();
expect(renderer.renderSlide).toHaveBeenCalledTimes(1);
expect(renderer.renderSlide).toHaveBeenCalledWith(7);
expect(sink.commitSlide).toHaveBeenCalledWith(7);

await controller.zoomIn();
expect(renderer.setZoomPercent).toHaveBeenCalledWith(125);
expect(controller.state).toMatchObject({ zoomMode: "manual", zoomPercent: 125 });
```

Assert `prefetch:6` and `prefetch:8` enter the queue before thumbnail work is
started by the session. After navigating to 8, obsolete prefetch keys are
cancelled and 7/9 are enqueued nearest-first.

- [ ] **Step 2: Run the focused test and verify red**

```bash
npx vitest run tests/pptx-viewer-controller.test.ts
```

Expected: FAIL because the controller module is missing.

- [ ] **Step 3: Implement the controller API**

```ts
export type PptxZoomMode = "fit" | "manual";

export interface PptxViewerControllerState {
  readonly currentSlideIndex: number;
  readonly zoomMode: PptxZoomMode;
  readonly zoomPercent: number;
  readonly navigationPending: boolean;
  readonly disposed: boolean;
}

export interface PptxViewerControllerSink {
  setNavigationPending(pending: boolean): void;
  commitSlide(index: number): void;
  reportNavigationFailure(index: number): void;
  commitZoom(mode: PptxZoomMode, percent: number): void;
  reportActionFailure(message: string): void;
}

export class PptxViewerController {
  get state(): PptxViewerControllerState;
  start(): Promise<void>;
  navigate(index: number): Promise<void>;
  zoomIn(): Promise<void>;
  zoomOut(): Promise<void>;
  resetToFit(): Promise<void>;
  dispose(): void;
}
```

Serialize main navigation through one promise. Commit current index only after
`renderSlide` succeeds. Keep 100% as fit; zoom buttons clamp to 25–400. Use
capabilities to report a local failure rather than call an absent optional
method. Schedule adjacent prefetch with priority `0`, catch it locally, and
cancel only keys beginning `prefetch:` on a new navigation.

- [ ] **Step 4: Run controller tests and typecheck**

```bash
npx vitest run tests/pptx-viewer-controller.test.ts && npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the controller**

```bash
git add src/pptx-viewer-controller.ts tests/pptx-viewer-controller.test.ts
git commit -m "feat: orchestrate M2 PPTX reading state"
```

---

### Task 7: Integrate M2 interaction into `PptxViewSession`

**Files:**
- Modify: `src/pptx-view-session.ts`
- Modify: `tests/pptx-view-session.test.ts`
- Modify: `styles.css`

**Interfaces:**
- Consumes: controller, thumbnail rail, position callbacks, and injected full-screen actions.
- Produces: the complete approved installed DOM/actions while preserving M1 state/error behavior.

- [ ] **Step 1: Write failing restored-page and independent-session tests**

Extend session options with:

```ts
positions: {
  initialSlideFor(file, slideCount): number;
  record(file, slideIndex): void;
},
fullscreen: {
  isActive(root): boolean;
  enter(root): Promise<void>;
  exit(): Promise<void>;
  subscribe(listener): () => void;
},
```

Assert a saved index `7` causes exactly one initial `renderSlide(7)`, source
read remains once, and successful navigation records the new index. Open two
sessions on the same renderer double factory and assert page and zoom changes
do not cross roots.

- [ ] **Step 2: Write failing keyboard, zoom, thumbnail, and full-screen tests**

After open, dispatch `ArrowRight`, `PageDown`, `ArrowLeft`, and `PageUp` at the
focused root and assert expected indices. Dispatch the same keys from the page
input and assert no navigation. Click all new actions and assert:

```ts
expect(root.querySelector('[data-action="zoom-out"]')).not.toBeNull();
expect(root.querySelector('[data-action="zoom-in"]')).not.toBeNull();
expect(root.querySelector('[data-action="fit-slide"]')).not.toBeNull();
expect(root.querySelector('[data-action="toggle-fullscreen"]')).not.toBeNull();
expect(root.querySelector('[aria-label="Slide thumbnails"]')).not.toBeNull();
```

Assert focus, accessible names, tab order, live status, collapsed rail, zoom
failure, full-screen rejection, and dispose cleanup.

- [ ] **Step 3: Run the session suite and verify red**

```bash
npx vitest run tests/pptx-view-session.test.ts
```

Expected: FAIL because the M2 options and actions do not exist.

- [ ] **Step 4: Refactor ready-state creation around controller and rail**

After `adapter.open`, resolve the initial index from `slideCount`, create the
controller, call `start`, queue adjacent prefetch, then start the rail. Replace
the inline M1 `navigate` closure with `controller.navigate` and a sink that
updates page counter/input, controls, root state, status, thumbnail selection,
and position callback only after success.

Add actions with exact names:

```text
toggle-thumbnails
zoom-out
zoom-in
fit-slide
toggle-fullscreen
```

Set `data-zoom-mode`, `data-zoom-percent`, `data-fullscreen`, and
`data-mounted-thumbnail-count` for installed black-box assertions. Keep user
copy renderer-neutral.

Extend `PptxViewSessionDiagnostics` with `backgroundPending`,
`backgroundRunning`, `mountedThumbnails`, `zoomMode`, and `zoomPercent`, all
read from the project-owned controller/queue/rail rather than candidate DOM.

- [ ] **Step 5: Add scoped keyboard and full-screen behavior**

Use one root `keydown` listener and this guard:

```ts
function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "BUTTON", "SELECT", "TEXTAREA"].includes(target.tagName));
}
```

Call `preventDefault()` only when an in-range navigation is requested. The
injected default full-screen implementation wraps `root.requestFullscreen`,
`document.exitFullscreen`, `document.fullscreenElement`, and
`fullscreenchange`. Dispose its subscription with the session.

- [ ] **Step 6: Finish responsive, theme, focus, and full-screen CSS**

Keep every selector under `.pptx-viewer`. Use flex/min-size rules so split
panes do not overflow, visible `:focus-visible` outlines using
`--interactive-accent`, theme-variable backgrounds/borders, and a full-screen
layout that keeps toolbar and rail available.

- [ ] **Step 7: Run session, plugin-boundary, and accessibility-focused tests**

```bash
npx vitest run tests/pptx-view-session.test.ts tests/plugin-registration.test.ts && npm run typecheck
```

Expected: PASS with all M1 assertions retained.

- [ ] **Step 8: Commit the complete product seam**

```bash
git add src/pptx-view-session.ts tests/pptx-view-session.test.ts styles.css
git commit -m "feat(viewer): complete M2 reading interactions"
```

---

### Task 8: Wire persistence, settings, and Vault lifecycle into Obsidian

**Files:**
- Create: `src/office-viewer-setting-tab.ts`
- Modify: `src/pptx-file-view.ts`
- Modify: `src/main.ts`
- Modify: `tests/obsidian-test-double.ts`
- Modify: `tests/plugin-registration.test.ts`

**Interfaces:**
- Consumes: Obsidian `Plugin.loadData/saveData`, `TFile.stat`, Vault rename/delete events, and the position store.
- Produces: initialized settings, file fingerprints, lifecycle migration/removal, unload flush, and a minimal settings toggle.

- [ ] **Step 1: Write failing plugin lifecycle tests**

Expand the Obsidian test double with `loadData`, `saveData`, `addSettingTab`,
`registerEvent`, `PluginSettingTab`, and `Setting`. Test that `onload` awaits
store initialization before registering the view, passes `{path,size,mtime}`
to the session callbacks, registers rename/delete handlers, and `onunload`
flushes after disposing views.

Add a settings test that invokes the toggle callback with `false` and asserts
saved `positions` is `{}` and `rememberReadingPosition` is false.

- [ ] **Step 2: Run plugin tests and verify red**

```bash
npx vitest run tests/plugin-registration.test.ts
```

Expected: FAIL because plugin data, events, and settings are not wired.

- [ ] **Step 3: Implement the settings tab**

Create:

```ts
export class OfficeViewerSettingTab extends PluginSettingTab {
  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Remember reading position")
      .setDesc("Store only the last slide number and a local file-change fingerprint.")
      .addToggle((toggle) => toggle
        .setValue(this.store.settings.rememberReadingPosition)
        .onChange((value) => this.store.setRememberReadingPosition(value)));
  }
}
```

Do not add M3 diagnostics, compatibility, privacy, or release settings.

- [ ] **Step 4: Wire plugin and file view**

Make `onload` async, initialize one `ReadingPositionStore`, add the setting
tab, and register Vault events. Convert a `TFile` to:

```ts
function fingerprint(file: TFile): FileFingerprint {
  return { path: file.path, size: file.stat.size, mtime: file.stat.mtime };
}
```

On rename call `store.rename(oldPath, fingerprint(file))`; on delete of a
`TFile` call `store.delete(file.path)`. Inject `initialSlideFor` and `record`
into each `PptxFileView`. On unload dispose views, then `void store.dispose()`;
expose a promise only in test diagnostics if needed to await the flush.

- [ ] **Step 5: Run plugin/session tests and typecheck**

```bash
npx vitest run tests/plugin-registration.test.ts tests/pptx-view-session.test.ts tests/reading-position-store.test.ts && npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Obsidian integration**

```bash
git add src/main.ts src/pptx-file-view.ts src/office-viewer-setting-tab.ts tests/obsidian-test-double.ts tests/plugin-registration.test.ts
git commit -m "feat(plugin): persist M2 reading position"
```

---

### Task 9: Prove M2 in installed Obsidian

**Files:**
- Create: `tests/e2e/pptx-m2.e2e.ts`
- Modify: `tests/e2e/open-pptx.e2e.ts`
- Modify: `wdio.conf.mts`

**Interfaces:**
- Consumes: installed plugin actions, `browser.reloadObsidian`, `obsidianPage.setTheme`, real workspace leaves, and committed fixtures.
- Produces: black-box evidence for every interaction, restart, independence, theme, cancellation, and immutability requirement.

- [ ] **Step 1: Add a failing keyboard/thumbnail/zoom/full-screen installed test**

Open `performance/representative-12-slides.pptx`, hash it, focus the viewer,
and use Webdriver keys only for navigation. Assert page changes, then click a
thumbnail and zoom controls. Enter/exit full screen and assert
`data-fullscreen`. Check the bounded thumbnail count and final source hash:

```ts
await root.click();
await browser.keys(["ArrowRight"]);
await expect(root).toHaveText(expect.stringContaining("2 / 12"));
expect(Number(await root.getAttribute("data-mounted-thumbnail-count")))
  .toBeLessThan(12);
```

For a 12-slide deck the mounted count may equal 12 at a large viewport, so the
strict bounded-count assertion must use the 200-slide fixture while the
interaction assertion remains on the representative deck.

- [ ] **Step 2: Add failing multi-leaf and restart persistence tests**

Open the representative deck in two split leaves through
`app.workspace.getLeaf("split")`, navigate them to different pages and zooms,
and assert both DOM roots retain their own values. Navigate one leaf to page 9,
call:

```ts
await browser.reloadObsidian({ plugins: ["office-viewer"] });
await obsidianPage.openFile("performance/representative-12-slides.pptx");
```

Assert the first readable page is 9. Disable persistence through the installed
plugin store/settings seam, reload again, and assert page 1 plus an empty
positions object.

- [ ] **Step 3: Add failing theme and cleanup tests**

Use `obsidianPage.setTheme("default")` and the built-in dark/light CSS class
toggle through `executeObsidian`. Assert control contrast variables resolve,
every visible control has an accessible name, and focused controls have a
non-zero outline. Open the 200-slide deck, capture queue diagnostics, detach
the leaf, and assert pending/running/mounted counts reach zero without source
mutation or network requests.

- [ ] **Step 4: Run the installed M2 spec and verify red**

```bash
npm run build && npx wdio run wdio.conf.mts --spec tests/e2e/pptx-m2.e2e.ts
```

Expected: FAIL on the first missing M2 action/state.

- [ ] **Step 5: Make only installed-boundary corrections exposed by the tests**

Allowed corrections are selectors, focus timing, real Fullscreen API handling,
Obsidian reload persistence, active-leaf scoping, theme-variable CSS, and
bounded cleanup diagnostics. Do not weaken assertions or replace actual
installed behavior with session doubles.

- [ ] **Step 6: Run all installed product E2E tests**

```bash
npm run test:e2e
```

Expected: existing six production-adapter cases, degraded-navigation case,
and all M2 cases PASS; the runner restores the normal production bundle.

- [ ] **Step 7: Commit installed acceptance**

```bash
git add tests/e2e/pptx-m2.e2e.ts tests/e2e/open-pptx.e2e.ts wdio.conf.mts
git commit -m "test(e2e): verify the M2 reading experience"
```

---

### Task 10: Add the 50-slide benchmark and M2 performance evidence

**Files:**
- Modify: `scripts/generate-performance-fixtures.mjs`
- Modify: `tests/performance/performance-fixtures.ts`
- Modify: `tests/performance/performance-fixtures.test.ts`
- Create: `tests/fixtures/performance/m2-representative-50-slides.pptx`
- Create: `tests/vault/performance/m2-representative-50-slides.pptx`
- Modify: `tests/e2e/pptx-performance.performance.ts`
- Modify: `tests/performance/installed-performance-artifact.ts`
- Modify: `tests/performance/installed-performance-analysis.ts`
- Modify: `tests/performance/installed-performance-analysis.test.ts`
- Modify: `tests/performance/installed-performance-markdown.ts`
- Modify: `tests/performance/performance-baseline.test.ts`
- Modify: `tests/performance/baselines/aiden-pptx-renderer-1.2.4.json`
- Modify: `docs/performance/aiden-pptx-renderer-1.2.4.md`

**Interfaces:**
- Consumes: installed performance collector, 50-slide representative fixture, 200-slide stress fixture, fixed latency gates, and cleanup policy.
- Produces: complete raw evidence for first readable, switch, thumbnails, bounded mounting, cancellation, memory, and cleanup.

- [ ] **Step 1: Write failing fixture-manifest tests**

Add a third manifest entry:

```ts
expect.objectContaining({
  id: "m2-representative-50-slides",
  role: "representative",
  slideCount: 50,
  maxSlideCount: 50,
  maxBytes: 20 * 1024 * 1024,
})
```

Assert slide 50 contains `M2 representative benchmark slide 50`, includes
text/shapes/table/image content, copies byte-for-byte to the Vault, and normal
fixture mode refuses to synthesize a missing committed source.

- [ ] **Step 2: Run fixture tests and verify red**

```bash
npx vitest run tests/performance/performance-fixtures.test.ts
```

Expected: FAIL because the M2 fixture is absent.

- [ ] **Step 3: Generate and commit the exact 50-slide fixture**

Generalize `buildRepresentative(slideCount, markerPrefix)` without changing the
existing 12-slide bytes unless regeneration is explicitly requested. Add
`buildM2Representative()` with exactly 50 slides and target `12.5 MB` or less.
Run:

```bash
npm run fixtures:performance:regenerate
npx vitest run tests/performance/performance-fixtures.test.ts
```

Expected: fixture test PASS, source and Vault SHA-256 match, size is at most 20
MB.

- [ ] **Step 4: Write failing M2 artifact and analysis tests**

Extend the artifact schema with:

```ts
thumbnailReadinessMs: number[];
mountedThumbnailCounts: number[];
backgroundStopObservations: Array<{
  reason: "close" | "file-switch";
  elapsedMs: number;
  pending: number;
  running: number;
  mounted: number;
}>;
```

Require at least ten valid 50-slide first-readable samples, forty rendered
switch samples, ten thumbnail readiness observations, bounded mounted counts
strictly below 50, and successful close/file-switch observations. Existing
memory/cancellation evidence remains mandatory.

- [ ] **Step 5: Run analysis tests and verify red**

```bash
npx vitest run tests/performance/installed-performance-analysis.test.ts tests/performance/performance-baseline.test.ts
```

Expected: FAIL because the committed artifact lacks M2 evidence.

- [ ] **Step 6: Extend the installed collector without changing budgets**

Use `m2-representative-50-slides.pptx` for first-readable/switch sampling. After
ready, wait for the first visible thumbnail resource, capture its elapsed time
and mounted count, navigate among already rendered pages, and collect both
close and file-switch background-stop observations. Keep all attempt deadlines,
raw snapshots, failure recording, memory provenance, cleanup windows, sample
counts, and fixed thresholds explicit.

- [ ] **Step 7: Run the full protocol and promote only a valid artifact**

```bash
npm run test:performance
```

Expected: PASS with no recorded failure, 50-slide first-readable p95 <= 3000
ms, rendered switch p95 <= 100 ms, mounted count < 50, and all background-stop
observations at zero pending/running/mounted.

Only after the validator accepts the generated result, copy byte-for-byte:

```bash
cp artifacts/performance/aiden-pptx-renderer-1.2.4/results.json tests/performance/baselines/aiden-pptx-renderer-1.2.4.json
cp artifacts/performance/aiden-pptx-renderer-1.2.4/summary.md docs/performance/aiden-pptx-renderer-1.2.4.md
npm run test:performance:baseline
```

Expected: baseline validator PASS. Never edit measurements, thresholds, or
sample counts to manufacture a pass.

- [ ] **Step 8: Commit fixture and performance evidence**

```bash
git add scripts/generate-performance-fixtures.mjs tests/fixtures/performance/m2-representative-50-slides.pptx tests/vault/performance/m2-representative-50-slides.pptx tests/performance tests/e2e/pptx-performance.performance.ts docs/performance/aiden-pptx-renderer-1.2.4.md
git commit -m "test(performance): establish M2 reading baseline"
```

---

### Task 11: Document, review, and close M2

**Files:**
- Modify: `README.md`
- Create: `docs/m2-technical-report.md`
- Modify only for confirmed review findings: any in-scope M2 file

**Interfaces:**
- Consumes: complete diff from `10caf4a...HEAD`, M2 issue, approved design, PRD, and fresh verification artifacts.
- Produces: user/developer documentation, a requirement-to-evidence matrix, reviewed commits, and the correct GitHub handoff state.

- [ ] **Step 1: Update README behavior and limits**

Document thumbnails, zoom range, fit semantics, keyboard keys, full screen,
position setting/default/privacy, multi-leaf behavior, progressive rendering,
and current M3 deferrals. Keep installation instructions and offline/read-only
claims accurate.

- [ ] **Step 2: Write the M2 technical report**

For every M2 deliverable and exit condition, record exact implementation files,
focused tests, installed tests, performance evidence, and status. Include the
review baseline `10caf4a`, integrated local branch, command results, fixture
sizes/hashes, bundle size, latency distributions, mounted-window maximum, and
cleanup outcomes. State that remote issue/milestone closure waits for published
integration if local `main` is still ahead of `origin/main`.

- [ ] **Step 3: Run the complete fresh verification matrix**

```bash
npm run verify
npm run test:e2e
npm run test:compatibility
npm run test:performance
npm run test:performance:baseline
git diff --check
```

Expected: every command exits 0; compatibility preserves explained baselines;
performance produces complete M2 evidence rather than only M1 metrics.

- [ ] **Step 4: Run `code-review` against the fixed baseline**

Review `10caf4a...HEAD` along both required axes. Standards review checks
repository instructions, ADR isolation, lifecycle cleanup, accessibility,
privacy, duplication, and test quality. Spec review maps every approved design
and PRD M2 item to direct evidence. Fix each confirmed in-scope finding through
a red-green cycle and rerun its focused test.

- [ ] **Step 5: Run final verification and commit review fixes/docs**

```bash
git diff --check
npm run verify
npm run test:e2e
npm run test:compatibility
npm run test:performance:baseline
git add README.md docs/m2-technical-report.md
git add -u src tests scripts styles.css package.json tsconfig.json wdio.conf.mts
git commit -m "fix: address M2 review findings"
```

Expected: clean working tree and no remaining actionable review finding.

- [ ] **Step 6: Update GitHub issue and milestone only when published evidence exists**

If the final commits are present on the remote integration branch, post the
requirement matrix and verification summary, replace `ready-for-agent` with
`ready-for-human`, close the M2 issue as completed, and close milestone 3 only
when it has zero open issues. If local `main` is ahead and no push was
authorized, keep both open and add no false completion claim; report the exact
local commit and required publish step to the user.

---

## Plan self-review result

- Every approved M2 deliverable maps to Tasks 3–9.
- Every M2 exit condition maps to installed or performance evidence in Tasks 9–10.
- Restart persistence, disable-and-clear, rename/delete, external modification,
  per-leaf independence, current-slide-first restore, 50-slide latency, 200-slide
  bounded mounting, file-switch cancellation, theme, focus, and source hashes
  have explicit tests.
- Renderer-specific imports remain confined to candidate adapter files.
- M3/M4 and later product features remain explicitly deferred.
- Public interfaces use the same names and signatures in every consuming task.
