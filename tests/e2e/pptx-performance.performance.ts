import { mkdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { browser, expect } from "@wdio/globals";
import {
  PERFORMANCE_BUDGETS,
  renderPerformanceMarkdown,
  summarizePerformance,
  type CancellationObservation,
  type CleanupObservation,
  type PerformanceFailure,
  type PerformanceInput,
} from "../../src/performance/performance-report";
import { performanceFixtureManifest } from "../performance/performance-fixtures";
import {
  probeElectronMemoryRuntime,
  requestElectronGarbageCollection,
  type ElectronMemoryBrowser,
  type ElectronMemoryRuntimeProbe,
  type GarbageCollectionObservation,
} from "../performance/electron-memory";
import {
  evaluateResourceReturn,
  stringifyJsonEvidence,
  summarizeInstalledPerformance,
  type MemoryRunInput,
} from "../performance/installed-performance-analysis";

const ARTIFACT_DIR = path.resolve("artifacts/performance");
const ACTIVE_ROOT = ".workspace-leaf.mod-active .pptx-viewer";
const OBSERVATION_WINDOW_MS = 2_000;
const POST_CLOSE_SAMPLE_TARGET_MS = 1_850;
const MAX_RETAINED_HEAP_FRACTION = 0.5;
const WARMUP_RUNS = 2;
const MEASURED_RUNS = 10;
const CANCELLATION_RUNS = 5;
const SWITCH_SEQUENCE = ["next", "next", "previous", "previous"] as const;

type OpenKind = "cold" | "warmup" | "measured";
type AttemptStatus = "pending" | "passed" | "failed";

interface SessionDiagnostics {
  generation: number;
  openPending: boolean;
  rendererActive: boolean;
  disposed: boolean;
}

interface RendererMemorySnapshot {
  sequence: number;
  label: string;
  state: string;
  rendererTimestampMs: number;
  elapsedSinceOpenMs: number;
  elapsedSinceCloseMs: number | null;
  heapUsedBytes: number;
  rssBytes: number;
  heapSource: "process.memoryUsage().heapUsed";
  rssSource: "process.memoryUsage().rss";
}

interface RegisteredRun {
  leaf: {
    detach(): void;
    view?: {
      containerEl?: HTMLElement;
      getPerformanceDiagnostics?: () => SessionDiagnostics;
    };
  };
  view: RegisteredRun["leaf"]["view"] | null;
  openStartedAt: number;
  settled: boolean;
  settledAt: number | null;
  error: string | null;
  sawLoading: boolean;
  memorySnapshots: RendererMemorySnapshot[];
  samplingError: string | null;
  closeStartedAt: number | null;
  cleanupSatisfiedAt: number | null;
  postCloseSnapshot: RendererMemorySnapshot | null;
  beginClose: (postCloseTargetMs: number) => void;
  sample: (label: string) => RendererMemorySnapshot | null;
  refreshCleanup: () => void;
}

interface RunRegistryWindow {
  __pptxPerformanceRuns?: Record<string, RegisteredRun>;
}

interface RunStatus {
  exists: boolean;
  settled: boolean;
  error: string | null;
  sawLoading: boolean;
  detached: boolean;
  viewerAbsent: boolean;
  diagnostics: SessionDiagnostics | null;
  snapshots: RendererMemorySnapshot[];
  samplingError: string | null;
  closeStarted: boolean;
  closeElapsedMs: number | null;
  cleanupElapsedMs: number | null;
  postCloseSnapshot: RendererMemorySnapshot | null;
}

interface RawSlideSwitch {
  action: "next" | "previous";
  from: string;
  to: string;
  elapsedMs: number;
}

interface RawOpenAttempt {
  kind: OpenKind;
  sampleIndex: number;
  token: string;
  status: AttemptStatus;
  metadataMs: number | null;
  firstReadableMs: number | null;
  slideSwitches: RawSlideSwitch[];
  error: string | null;
}

interface ResourceReturnResult {
  passed: boolean;
  deadlinePassed: boolean;
  adapterStopped: boolean;
  heapIncrementBytes: number;
  retainedHeapBytes: number;
  retainedHeapFraction: number | null;
  allowedRetainedHeapBytes: number;
  postCloseAtOrBelowSteady: boolean;
}

interface RawMemoryAttempt {
  sampleIndex: number;
  token: string;
  status: AttemptStatus;
  snapshots: RendererMemorySnapshot[];
  loadingSnapshotCount: number;
  peakDefinition: "actual snapshot with maximum heapUsedBytes between open start and steady capture";
  preOpen: RendererMemorySnapshot | null;
  peak: RendererMemorySnapshot | null;
  steady: RendererMemorySnapshot | null;
  postClose: RendererMemorySnapshot | null;
  closeStartedAtRendererMs: number | null;
  cleanupElapsedMs: number | null;
  gcCompletedElapsedMs: number | null;
  garbageCollection: GarbageCollectionObservation | null;
  diagnosticsAfterClose: SessionDiagnostics | null;
  resourceReturn: ResourceReturnResult | null;
  error: string | null;
}

interface RawCancellationAttempt {
  sampleIndex: number;
  token: string;
  status: AttemptStatus;
  sawLoading: boolean;
  elapsedMs: number | null;
  detached: boolean | null;
  viewerAbsent: boolean | null;
  openSettled: boolean | null;
  adapterDisposed: boolean | null;
  error: string | null;
}

interface RuntimeVersions {
  electron: string;
  chromium: string;
  node: string;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseTiming(value: string | null, label: string): number {
  const parsed = Number(value);
  if (value === null || !Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} was not a finite non-negative measurement: ${value}`);
  }
  return parsed;
}

async function startInstalledRun(
  vaultPath: string,
  token: string,
  options: { sampleMemory: boolean; cancelOnLoading: boolean },
) {
  await browser.executeObsidian(
    ({ app, obsidian }, filePath, runToken, runOptions) => {
      const file = app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof obsidian.TFile)) {
        throw new Error(`Performance fixture not found: ${filePath}`);
      }
      const leaf = app.workspace.getLeaf("tab");
      app.workspace.setActiveLeaf(leaf, { focus: true });
      const registry = ((window as unknown as RunRegistryWindow)
        .__pptxPerformanceRuns ??= {});
      const rendererProcess = globalThis.process as unknown as {
        memoryUsage?: () => { heapUsed?: number; rss?: number };
      };
      let interval: ReturnType<typeof setInterval> | null = null;
      let observer: MutationObserver | null = null;
      const run = {
        leaf,
        view: null,
        openStartedAt: performance.now(),
        settled: false,
        settledAt: null,
        error: null,
        sawLoading: false,
        memorySnapshots: [],
        samplingError: null,
        closeStartedAt: null,
        cleanupSatisfiedAt: null,
        postCloseSnapshot: null,
      } as unknown as RegisteredRun;
      const diagnostics = () =>
        run.view?.getPerformanceDiagnostics?.() ?? null;
      const sample = (label: string) => {
        if (!runOptions.sampleMemory) return null;
        if (typeof rendererProcess.memoryUsage !== "function") {
          run.samplingError = "renderer process.memoryUsage is unavailable";
          return null;
        }
        const current = rendererProcess.memoryUsage();
        if (!Number.isFinite(current.heapUsed) || !Number.isFinite(current.rss)) {
          run.samplingError = "renderer process.memoryUsage returned non-finite values";
          return null;
        }
        const root = leaf.view?.containerEl?.querySelector<HTMLElement>(
          ".pptx-viewer",
        );
        const timestamp = performance.now();
        const snapshot: RendererMemorySnapshot = {
          sequence: run.memorySnapshots.length + 1,
          label,
          state: root?.dataset.state ?? (run.closeStartedAt === null ? "not-mounted" : "detached"),
          rendererTimestampMs: timestamp,
          elapsedSinceOpenMs: timestamp - run.openStartedAt,
          elapsedSinceCloseMs:
            run.closeStartedAt === null ? null : timestamp - run.closeStartedAt,
          heapUsedBytes: current.heapUsed!,
          rssBytes: current.rss!,
          heapSource: "process.memoryUsage().heapUsed",
          rssSource: "process.memoryUsage().rss",
        };
        run.memorySnapshots.push(snapshot);
        return snapshot;
      };
      const refreshCleanup = () => {
        if (run.closeStartedAt === null || run.cleanupSatisfiedAt !== null) return;
        const state = diagnostics();
        const container = run.view?.containerEl;
        const stopped =
          run.settled &&
          state?.disposed === true &&
          state.openPending === false &&
          state.rendererActive === false;
        if (
          stopped &&
          !container?.isConnected &&
          run.view?.containerEl?.querySelector(".pptx-viewer") === null
        ) {
          run.cleanupSatisfiedAt = performance.now();
        }
      };
      const beginClose = (postCloseTargetMs: number) => {
        if (run.closeStartedAt !== null) return;
        run.view = leaf.view as RegisteredRun["view"];
        sample("pre-close");
        run.closeStartedAt = performance.now();
        leaf.detach();
        refreshCleanup();
        if (interval !== null) clearInterval(interval);
        observer?.disconnect();
        setTimeout(() => {
          run.postCloseSnapshot = sample("post-close");
          refreshCleanup();
        }, postCloseTargetMs);
      };
      run.sample = sample;
      run.refreshCleanup = refreshCleanup;
      run.beginClose = beginClose;
      registry[runToken] = run;
      sample("pre-open");
      if (runOptions.sampleMemory) {
        interval = setInterval(() => sample("open-interval"), 5);
      }
      const observeLoading = () => {
        const loading = leaf.view?.containerEl?.querySelector<HTMLElement>(
          '.pptx-viewer[data-state="loading"]',
        );
        if (!loading || run.sawLoading) return;
        run.sawLoading = true;
        sample("loading-transition");
        if (runOptions.cancelOnLoading) beginClose(0);
      };
      observer = new MutationObserver(observeLoading);
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-state"],
        childList: true,
        subtree: true,
      });
      const opening = leaf.openFile(file);
      observeLoading();
      void opening.then(
        () => {
          if (run.closeStartedAt === null) {
            run.view = leaf.view as RegisteredRun["view"];
          }
          run.settled = true;
          run.settledAt = performance.now();
          sample("open-settled");
          if (!runOptions.cancelOnLoading) {
            if (interval !== null) clearInterval(interval);
            observer?.disconnect();
          }
          refreshCleanup();
        },
        (error: unknown) => {
          if (run.closeStartedAt === null) {
            run.view = leaf.view as RegisteredRun["view"];
          }
          run.settled = true;
          run.settledAt = performance.now();
          run.error = error instanceof Error ? error.message : String(error);
          if (interval !== null) clearInterval(interval);
          observer?.disconnect();
          refreshCleanup();
        },
      );
    },
    vaultPath,
    token,
    options,
  );
}

async function captureRunSnapshot(
  token: string,
  label: string,
): Promise<RendererMemorySnapshot | null> {
  return browser.executeObsidian((_context, runToken, snapshotLabel) => {
    return (window as unknown as RunRegistryWindow)
      .__pptxPerformanceRuns?.[runToken]?.sample(snapshotLabel) ?? null;
  }, token, label);
}

async function beginClose(token: string, postCloseTargetMs: number) {
  await browser.executeObsidian((_context, runToken, targetMs) => {
    (window as unknown as RunRegistryWindow)
      .__pptxPerformanceRuns?.[runToken]?.beginClose(targetMs);
  }, token, postCloseTargetMs);
}

async function getRunStatus(token: string): Promise<RunStatus> {
  return browser.executeObsidian((_context, runToken) => {
    const run = (window as unknown as RunRegistryWindow)
      .__pptxPerformanceRuns?.[runToken];
    run?.refreshCleanup();
    const diagnostics = run?.view?.getPerformanceDiagnostics?.() ?? null;
    const now = performance.now();
    return {
      exists: run !== undefined,
      settled: run?.settled ?? false,
      error: run?.error ?? null,
      sawLoading: run?.sawLoading ?? false,
      detached: run === undefined || !run.view?.containerEl?.isConnected,
      viewerAbsent:
        run === undefined ||
        run.view?.containerEl?.querySelector(".pptx-viewer") === null,
      diagnostics,
      snapshots: run?.memorySnapshots.map((snapshot) => ({ ...snapshot })) ?? [],
      samplingError: run?.samplingError ?? null,
      closeStarted: run?.closeStartedAt !== null && run?.closeStartedAt !== undefined,
      closeElapsedMs:
        run?.closeStartedAt === null || run?.closeStartedAt === undefined
          ? null
          : now - run.closeStartedAt,
      cleanupElapsedMs:
        run?.closeStartedAt === null ||
        run?.closeStartedAt === undefined ||
        run.cleanupSatisfiedAt === null
          ? null
          : run.cleanupSatisfiedAt - run.closeStartedAt,
      postCloseSnapshot: run?.postCloseSnapshot
        ? { ...run.postCloseSnapshot }
        : null,
    };
  }, token);
}

async function releaseRunEvidence(token: string): Promise<void> {
  await browser.executeObsidian((_context, runToken) => {
    const registry = (window as unknown as RunRegistryWindow)
      .__pptxPerformanceRuns;
    if (registry) delete registry[runToken];
  }, token);
}

async function waitForStatus(
  token: string,
  predicate: (status: RunStatus) => boolean,
): Promise<RunStatus> {
  let status = await getRunStatus(token);
  while (!predicate(status)) {
    if (
      status.closeElapsedMs !== null &&
      status.closeElapsedMs > OBSERVATION_WINDOW_MS
    ) {
      return status;
    }
    await browser.pause(10);
    status = await getRunStatus(token);
  }
  return status;
}

function actualPeakSnapshot(
  snapshots: readonly RendererMemorySnapshot[],
  steady: RendererMemorySnapshot,
): RendererMemorySnapshot | null {
  const candidates = snapshots.filter(
    (snapshot) =>
      snapshot.label !== "pre-open" &&
      snapshot.label !== "pre-close" &&
      snapshot.label !== "post-close" &&
      snapshot.rendererTimestampMs <= steady.rendererTimestampMs,
  );
  return (
    candidates.reduce<RendererMemorySnapshot | null>(
      (peak, snapshot) =>
        peak === null || snapshot.heapUsedBytes > peak.heapUsedBytes
          ? snapshot
          : peak,
      null,
    ) ?? null
  );
}

function metricRow(label: string, summary: { p50: number | null; p95: number | null; sampleCount: number; expectedSampleCount: number }) {
  return `| ${label} | ${summary.sampleCount}/${summary.expectedSampleCount} | ${summary.p50 ?? "n/a"} | ${summary.p95 ?? "n/a"} |`;
}

function renderInstalledAnalysis(
  analysis: ReturnType<typeof summarizeInstalledPerformance>,
  rawMemoryAttempts: readonly RawMemoryAttempt[],
  rawCancellationAttempts: readonly RawCancellationAttempt[],
  memoryRuntime: ElectronMemoryRuntimeProbe,
): string {
  const lines = [
    "## Expanded statistical summaries",
    "",
    "| Metric | Samples | p50 | p95 |",
    "| --- | ---: | ---: | ---: |",
    metricRow("Metadata/open", analysis.metadata),
    metricRow("First readable", analysis.firstReadable),
    metricRow("Slide switch", analysis.slideSwitch),
    metricRow("Cancellation elapsed", analysis.cancellationElapsedMs),
    metricRow("Cleanup/resource return elapsed", analysis.cleanupElapsedMs),
    "",
    "| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...(["peak", "steady", "postClose"] as const).map((phase) =>
      `| ${phase} | ${analysis.memory[phase].heapUsedBytes.p50 ?? "n/a"} | ${analysis.memory[phase].heapUsedBytes.p95 ?? "n/a"} | ${analysis.memory[phase].rssBytes.p50 ?? "n/a"} | ${analysis.memory[phase].rssBytes.p95 ?? "n/a"} |`,
    ),
    "",
    "### Budget misses and bottlenecks",
    "",
    ...(analysis.budgetMisses.length === 0
      ? ["None."]
      : analysis.budgetMisses.map(
          (miss) =>
            `- ${miss.metric}: p95 ${miss.observedP95Ms} ms > ${miss.budgetMs} ms; bottleneck=${miss.bottleneck}`,
        )),
    "",
    "### Failure summary",
    "",
    ...(analysis.failureSummary.length === 0
      ? ["None."]
      : analysis.failureSummary.map(
          (failure) =>
            `- ${failure.phase}: ${failure.count} failure(s), samples=${failure.sampleIndexes.join(", ") || "n/a"}; ${failure.messages.join("; ")}`,
        )),
    "",
    "### Memory provenance and resource-return policy",
    "",
    "- Every measured run starts a renderer-side 5 ms sampler before `leaf.openFile`; a MutationObserver adds an immediate snapshot at the real loading transition.",
    "- Peak means the single actual snapshot with maximum heap used between open start and the explicit steady capture. Its RSS is from that same instant; independent maxima are not combined.",
    `- Post-close capture target: ${POST_CLOSE_SAMPLE_TARGET_MS} ms from the renderer timestamp immediately before detach; hard deadline: ${OBSERVATION_WINDOW_MS} ms, including detach, CDP GC, adapter settlement, and post-close sampling.`,
    `- Heap release passes only when post-close heap is at or below steady heap and retained incremental heap is no greater than ${MAX_RETAINED_HEAP_FRACTION * 100}% of the observed positive pre-open-to-steady workload increment. The allowance is capped by that measured increment; no uncalibrated floor is used. RSS is reported but not gated because Electron/Chromium allocators retain and share resident pages noisily.`,
    `- Memory attempts: ${rawMemoryAttempts.length}; all have loading snapshot: ${rawMemoryAttempts.every(({ loadingSnapshotCount }) => loadingSnapshotCount > 0) ? "yes" : "no"}.`,
    `- Cancellation attempts: ${rawCancellationAttempts.length}; all met deadline: ${rawCancellationAttempts.every(({ elapsedMs }) => elapsedMs !== null && elapsedMs <= OBSERVATION_WINDOW_MS) ? "yes" : "no"}.`,
    `- Renderer memory source: ${memoryRuntime.selectedHeapSource ?? "none"}; RSS source: ${memoryRuntime.selectedRssSource ?? "none"}.`,
  ];
  return `${lines.join("\n")}\n`;
}

describe("installed PPTX performance collector", () => {
  it("collects synchronized installed Electron evidence without hiding attempts", async () => {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    const representative = performanceFixtureManifest[0]!;
    const stress = performanceFixtureManifest[1]!;
    const memoryBrowser = browser as unknown as ElectronMemoryBrowser;
    const runtimeVersions = (await browser.execute(() => ({
      electron: globalThis.process?.versions.electron ?? "unavailable",
      chromium: globalThis.process?.versions.chrome ?? "unavailable",
      node: globalThis.process?.versions.node ?? "unavailable",
    }))) as RuntimeVersions;
    const memoryRuntime = await probeElectronMemoryRuntime(memoryBrowser);
    const environment = {
      device: `${os.hostname()} (${os.cpus()[0]?.model ?? "unknown CPU"}, ${Math.round(os.totalmem() / 1024 ** 3)} GiB)`,
      os: `${os.type()} ${os.release()} ${os.arch()}`,
      obsidianVersion: browser.getObsidianVersion(),
      installerVersion: browser.getObsidianInstallerVersion(),
      electronVersion: runtimeVersions.electron,
      chromiumVersion: runtimeVersions.chromium,
      nodeVersion: runtimeVersions.node,
      renderer: "@aiden0z/pptx-renderer@1.2.4",
      coldDefinition: "First representative open after installed Obsidian launch; excluded from gates.",
      warmDefinition: "Same-process opens after closing the prior leaf; two warmups excluded, ten measured.",
      warmupRuns: WARMUP_RUNS,
      measuredRuns: MEASURED_RUNS,
      slideSwitchesPerRun: SWITCH_SEQUENCE.length,
    };
    const metadataMs: number[] = [];
    const firstReadableMs: number[] = [];
    const slideSwitchMs: number[] = [];
    const memoryRuns: MemoryRunInput[] = [];
    const cancellation: CancellationObservation[] = [];
    const cleanup: CleanupObservation[] = [];
    const failures: PerformanceFailure[] = [];
    const invariantFailures: string[] = [];
    const rawOpens: RawOpenAttempt[] = [];
    const rawMemoryAttempts: RawMemoryAttempt[] = [];
    const rawCancellationAttempts: RawCancellationAttempt[] = [];

    const recordFailure = (phase: string, failureMessage: string, sampleIndex?: number) => {
      failures.push({ phase, message: failureMessage, ...(sampleIndex === undefined ? {} : { sampleIndex }) });
      invariantFailures.push(`${phase}${sampleIndex === undefined ? "" : ` sample ${sampleIndex}`}: ${failureMessage}`);
    };

    const collectOpen = async (kind: OpenKind, sampleIndex: number, measured: boolean) => {
      const token = `${kind}-${sampleIndex}-${Date.now()}`;
      const openAttempt: RawOpenAttempt = {
        kind,
        sampleIndex,
        token,
        status: "pending",
        metadataMs: null,
        firstReadableMs: null,
        slideSwitches: [],
        error: null,
      };
      const memoryAttempt: RawMemoryAttempt | null = measured
        ? {
            sampleIndex,
            token,
            status: "pending",
            snapshots: [],
            loadingSnapshotCount: 0,
            peakDefinition: "actual snapshot with maximum heapUsedBytes between open start and steady capture",
            preOpen: null,
            peak: null,
            steady: null,
            postClose: null,
            closeStartedAtRendererMs: null,
            cleanupElapsedMs: null,
            gcCompletedElapsedMs: null,
            garbageCollection: null,
            diagnosticsAfterClose: null,
            resourceReturn: null,
            error: null,
          }
        : null;
      try {
        await startInstalledRun(representative.vaultPath, token, {
          sampleMemory: measured,
          cancelOnLoading: false,
        });
        const root = await browser.$(ACTIVE_ROOT);
        await root.waitForExist({ timeout: 30_000 });
        await browser.waitUntil(async () => {
          const state = await root.getAttribute("data-state");
          return state === "ready" || state === "error";
        }, { timeout: 30_000, timeoutMsg: `${token} did not finish opening` });
        if ((await root.getAttribute("data-state")) !== "ready") {
          throw new Error("installed PPTX view reached error state");
        }
        openAttempt.metadataMs = parseTiming(await root.getAttribute("data-metadata-ms"), "metadata");
        openAttempt.firstReadableMs = parseTiming(await root.getAttribute("data-first-readable-ms"), "first readable");
        expect(openAttempt.firstReadableMs).toBeGreaterThan(0);
        if (measured) {
          metadataMs.push(openAttempt.metadataMs);
          firstReadableMs.push(openAttempt.firstReadableMs);
          const counter = await root.$(".pptx-viewer__page-counter");
          for (const action of SWITCH_SEQUENCE) {
            const from = await counter.getText();
            await root.$(`[data-action="${action}-slide"]`).click();
            await browser.waitUntil(async () => (await counter.getText()) !== from, {
              timeout: 5_000,
              timeoutMsg: `${token} ${action} switch did not complete`,
            });
            const to = await counter.getText();
            const elapsedMs = parseTiming(
              await root.getAttribute("data-last-slide-switch-ms"),
              "slide switch",
            );
            openAttempt.slideSwitches.push({ action, from, to, elapsedMs });
            slideSwitchMs.push(elapsedMs);
          }
          await browser.pause(250);
          memoryAttempt!.steady = await captureRunSnapshot(token, "steady");
          if (!memoryAttempt!.steady) throw new Error("steady memory snapshot unavailable");
        }
        openAttempt.status = "passed";
      } catch (error) {
        openAttempt.status = "failed";
        openAttempt.error = message(error);
        if (memoryAttempt) memoryAttempt.error = openAttempt.error;
        recordFailure(`${kind}-open`, openAttempt.error, sampleIndex);
      } finally {
        try {
          await beginClose(token, measured ? POST_CLOSE_SAMPLE_TARGET_MS : 0);
          if (measured) {
            let status = await waitForStatus(token, (candidate) => candidate.closeStarted);
            memoryAttempt!.garbageCollection = await requestElectronGarbageCollection(memoryBrowser);
            status = await getRunStatus(token);
            memoryAttempt!.gcCompletedElapsedMs = status.closeElapsedMs;
            if (!status.postCloseSnapshot && (status.closeElapsedMs ?? 0) <= OBSERVATION_WINDOW_MS) {
              status = await waitForStatus(token, (candidate) => candidate.postCloseSnapshot !== null);
            }
            memoryAttempt!.snapshots = status.snapshots;
            memoryAttempt!.loadingSnapshotCount = status.snapshots.filter(({ state }) => state === "loading").length;
            memoryAttempt!.preOpen = status.snapshots.find(({ label }) => label === "pre-open") ?? null;
            memoryAttempt!.postClose = status.postCloseSnapshot;
            memoryAttempt!.diagnosticsAfterClose = status.diagnostics;
            memoryAttempt!.cleanupElapsedMs = status.cleanupElapsedMs;
            memoryAttempt!.closeStartedAtRendererMs =
              status.postCloseSnapshot === null || status.postCloseSnapshot.elapsedSinceCloseMs === null
                ? null
                : status.postCloseSnapshot.rendererTimestampMs - status.postCloseSnapshot.elapsedSinceCloseMs;
            if (memoryAttempt!.steady) {
              memoryAttempt!.peak = actualPeakSnapshot(status.snapshots, memoryAttempt!.steady);
            }
            const preOpen = memoryAttempt!.preOpen;
            const peak = memoryAttempt!.peak;
            const steady = memoryAttempt!.steady;
            const postClose = memoryAttempt!.postClose;
            if (!status.sawLoading || memoryAttempt!.loadingSnapshotCount < 1) {
              recordFailure("memory", "no renderer-provenance loading memory snapshot", sampleIndex);
            }
            if (!preOpen || !peak || !steady || !postClose || postClose.elapsedSinceCloseMs === null) {
              recordFailure("memory", "required pre-open/peak/steady/post-close snapshot missing", sampleIndex);
            } else {
              memoryAttempt!.resourceReturn = evaluateResourceReturn({
                preOpenHeapBytes: preOpen.heapUsedBytes,
                steadyHeapBytes: steady.heapUsedBytes,
                postCloseHeapBytes: postClose.heapUsedBytes,
                postCloseElapsedMs: postClose.elapsedSinceCloseMs,
                openSettled: status.settled,
                adapterDisposed:
                  status.diagnostics?.disposed === true &&
                  status.diagnostics.openPending === false &&
                  status.diagnostics.rendererActive === false,
                maxRetainedHeapFraction: MAX_RETAINED_HEAP_FRACTION,
                deadlineMs: OBSERVATION_WINDOW_MS,
              });
              const completionElapsed =
                status.cleanupElapsedMs === null ||
                memoryAttempt!.gcCompletedElapsedMs === null
                  ? null
                  : Math.max(
                      status.cleanupElapsedMs,
                      postClose.elapsedSinceCloseMs,
                      memoryAttempt!.gcCompletedElapsedMs,
                    );
              const resourcePassed =
                memoryAttempt!.resourceReturn.passed &&
                completionElapsed !== null &&
                completionElapsed <= OBSERVATION_WINDOW_MS;
              if (completionElapsed !== null) {
                cleanup.push({
                  elapsedMs: completionElapsed,
                  unfinishedWorkStopped: memoryAttempt!.resourceReturn.adapterStopped,
                  resourcesReleased: resourcePassed,
                });
              }
              memoryRuns.push({ peak, steady, postClose });
              if (!resourcePassed) {
                recordFailure(
                  "cleanup",
                  `adapter/deadline/heap return criterion failed; retained=${memoryAttempt!.resourceReturn.retainedHeapFraction}, elapsed=${completionElapsed}`,
                  sampleIndex,
                );
                memoryAttempt!.error =
                  `adapter/deadline/heap return criterion failed; retained=${memoryAttempt!.resourceReturn.retainedHeapFraction}, elapsed=${completionElapsed}`;
              }
            }
            if (
              (memoryAttempt!.gcCompletedElapsedMs ?? Number.POSITIVE_INFINITY) > OBSERVATION_WINDOW_MS ||
              (postClose?.elapsedSinceCloseMs ?? Number.POSITIVE_INFINITY) > OBSERVATION_WINDOW_MS ||
              (status.cleanupElapsedMs ?? Number.POSITIVE_INFINITY) > OBSERVATION_WINDOW_MS
            ) {
              recordFailure("cleanup-deadline", `close work exceeded ${OBSERVATION_WINDOW_MS} ms absolute renderer deadline`, sampleIndex);
            }
            if (status.samplingError) recordFailure("memory", status.samplingError, sampleIndex);
            memoryAttempt!.status = failures.some(
              ({ sampleIndex: failedIndex, phase }) =>
                failedIndex === sampleIndex && (phase === "memory" || phase.startsWith("cleanup")),
            )
              ? "failed"
              : "passed";
            if (memoryAttempt!.status === "failed" && memoryAttempt!.error === null) {
              memoryAttempt!.error = "memory or cleanup invariant failed; see failure summary";
            }
          } else {
            await waitForStatus(token, (status) => status.cleanupElapsedMs !== null);
          }
        } catch (error) {
          const failureMessage = message(error);
          recordFailure("cleanup", failureMessage, sampleIndex);
          if (memoryAttempt) {
            memoryAttempt.status = "failed";
            memoryAttempt.error = failureMessage;
          }
        } finally {
          try {
            await releaseRunEvidence(token);
          } catch (error) {
            recordFailure("collector-cleanup", message(error), sampleIndex);
          }
          rawOpens.push(openAttempt);
          if (memoryAttempt) rawMemoryAttempts.push(memoryAttempt);
        }
      }
    };

    await collectOpen("cold", 1, false);
    for (let index = 1; index <= WARMUP_RUNS; index += 1) await collectOpen("warmup", index, false);
    for (let index = 1; index <= MEASURED_RUNS; index += 1) await collectOpen("measured", index, true);

    for (let index = 1; index <= CANCELLATION_RUNS; index += 1) {
      const token = `cancellation-${index}-${Date.now()}`;
      const attempt: RawCancellationAttempt = {
        sampleIndex: index,
        token,
        status: "pending",
        sawLoading: false,
        elapsedMs: null,
        detached: null,
        viewerAbsent: null,
        openSettled: null,
        adapterDisposed: null,
        error: null,
      };
      try {
        await startInstalledRun(stress.vaultPath, token, {
          sampleMemory: false,
          cancelOnLoading: true,
        });
        const status = await waitForStatus(
          token,
          (candidate) => candidate.closeStarted && candidate.cleanupElapsedMs !== null,
        );
        attempt.sawLoading = status.sawLoading;
        attempt.elapsedMs = status.cleanupElapsedMs;
        attempt.detached = status.detached;
        attempt.viewerAbsent = status.viewerAbsent;
        attempt.openSettled = status.settled;
        attempt.adapterDisposed =
          status.diagnostics?.disposed === true &&
          status.diagnostics.openPending === false &&
          status.diagnostics.rendererActive === false;
        const passed =
          attempt.sawLoading &&
          attempt.elapsedMs !== null &&
          attempt.elapsedMs <= OBSERVATION_WINDOW_MS &&
          attempt.detached &&
          attempt.viewerAbsent &&
          attempt.openSettled &&
          attempt.adapterDisposed;
        attempt.status = passed ? "passed" : "failed";
        if (attempt.elapsedMs !== null) {
          cancellation.push({
            elapsedMs: attempt.elapsedMs,
            detached: attempt.detached ?? false,
            viewerAbsent: attempt.viewerAbsent ?? false,
          });
          cleanup.push({
            elapsedMs: attempt.elapsedMs,
            unfinishedWorkStopped: Boolean(attempt.openSettled && attempt.adapterDisposed),
            resourcesReleased: Boolean(passed),
          });
        }
        if (!passed) {
          attempt.error = `loading cancellation missed adapter/resource ${OBSERVATION_WINDOW_MS} ms deadline`;
          recordFailure("cancellation", attempt.error, index);
        }
      } catch (error) {
        attempt.status = "failed";
        attempt.error = message(error);
        recordFailure("cancellation", attempt.error, index);
        try {
          await beginClose(token, 0);
        } catch {
          // The attempt retains the original failure.
        }
      } finally {
        try {
          await releaseRunEvidence(token);
        } catch (error) {
          attempt.status = "failed";
          attempt.error ??= message(error);
          recordFailure("collector-cleanup", message(error), index);
        }
        rawCancellationAttempts.push(attempt);
      }
    }

    if (rawMemoryAttempts.length !== MEASURED_RUNS) {
      recordFailure("collector", `expected ${MEASURED_RUNS} memory attempts, received ${rawMemoryAttempts.length}`);
    }
    if (rawCancellationAttempts.length !== CANCELLATION_RUNS) {
      recordFailure("collector", `expected ${CANCELLATION_RUNS} cancellation attempts, received ${rawCancellationAttempts.length}`);
    }
    const input: PerformanceInput = {
      environment,
      firstReadableMs,
      slideSwitchMs,
      resources: {
        memory: rawMemoryAttempts.flatMap(({ peak, steady, postClose, sampleIndex }) =>
          peak && steady && postClose
            ? [
                { label: `measured-${sampleIndex}-peak-actual-snapshot-${peak.sequence}`, heapUsedBytes: peak.heapUsedBytes, rssBytes: peak.rssBytes },
                { label: `measured-${sampleIndex}-steady`, heapUsedBytes: steady.heapUsedBytes, rssBytes: steady.rssBytes },
                { label: `measured-${sampleIndex}-post-close`, heapUsedBytes: postClose.heapUsedBytes, rssBytes: postClose.rssBytes },
              ]
            : [],
        ),
        cancellation,
        cleanup,
        bundleBytes: (await stat(path.resolve("main.js"))).size,
        observationWindowMs: OBSERVATION_WINDOW_MS,
      },
      failures,
    };
    const summary = summarizePerformance(input);
    const analysis = summarizeInstalledPerformance({
      expectedMeasuredRuns: MEASURED_RUNS,
      expectedCancellationRuns: CANCELLATION_RUNS,
      switchesPerRun: SWITCH_SEQUENCE.length,
      metadataMs,
      firstReadableMs,
      slideSwitchMs,
      memory: memoryRuns,
      cancellationElapsedMs: rawCancellationAttempts.flatMap(({ elapsedMs }) =>
        elapsedMs === null ? [] : [elapsedMs],
      ),
      cleanupElapsedMs: rawMemoryAttempts.flatMap(({ cleanupElapsedMs, postClose }) =>
        cleanupElapsedMs === null ||
        postClose === null ||
        postClose.elapsedSinceCloseMs === null
          ? []
          : [Math.max(cleanupElapsedMs, postClose.elapsedSinceCloseMs)],
      ),
      failures: summary.failures,
      budgets: PERFORMANCE_BUDGETS,
    });
    const protocol = {
      coldRuns: 1,
      warmupRuns: WARMUP_RUNS,
      measuredRuns: MEASURED_RUNS,
      slideSwitchesPerMeasuredRun: SWITCH_SEQUENCE.length,
      cancellationRuns: CANCELLATION_RUNS,
      observationWindowMs: OBSERVATION_WINDOW_MS,
      postCloseSampleTargetMs: POST_CLOSE_SAMPLE_TARGET_MS,
      maxRetainedHeapFraction: MAX_RETAINED_HEAP_FRACTION,
      rssPolicy: "observed-only: allocator/shared resident-page noise makes short-window RSS return unsuitable as a hard invariant",
    };
    await writeFile(
      path.join(ARTIFACT_DIR, "results.json"),
      `${stringifyJsonEvidence({ protocol, memoryRuntime, rawOpens, rawMemoryAttempts, rawCancellationAttempts, analysis, ...summary }, 2)}\n`,
    );
    await writeFile(
      path.join(ARTIFACT_DIR, "summary.md"),
      `${renderPerformanceMarkdown(summary)}\n${renderInstalledAnalysis(analysis, rawMemoryAttempts, rawCancellationAttempts, memoryRuntime)}`,
    );
    if (invariantFailures.length > 0) throw new Error(invariantFailures.join("\n"));
  });
});
