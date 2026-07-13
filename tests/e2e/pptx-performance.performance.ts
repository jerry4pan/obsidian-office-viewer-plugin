import { mkdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { browser, expect } from "@wdio/globals";
import {
  renderPerformanceMarkdown,
  summarizePerformance,
  type CancellationObservation,
  type CleanupObservation,
  type PerformanceFailure,
  type PerformanceInput,
} from "../../src/performance/performance-report";
import { performanceFixtureManifest } from "../performance/performance-fixtures";
import {
  collectElectronMemory,
  probeElectronMemoryRuntime,
  requestElectronGarbageCollection,
  type ElectronMemoryBrowser,
  type ElectronMemoryObservation,
  type ElectronMemoryRuntimeProbe,
  type GarbageCollectionObservation,
} from "../performance/electron-memory";

const ARTIFACT_DIR = path.resolve("artifacts/performance");
const ACTIVE_ROOT = ".workspace-leaf.mod-active .pptx-viewer";
const OBSERVATION_WINDOW_MS = 2_000;
const WARMUP_RUNS = 2;
const MEASURED_RUNS = 10;
const CANCELLATION_RUNS = 5;

type OpenKind = "cold" | "warmup" | "measured";

interface RawOpenObservation {
  kind: OpenKind;
  sampleIndex: number;
  token: string;
  success: boolean;
  metadataMs: number | null;
  firstReadableMs: number | null;
  slideSwitchMs: number | null;
  openingState: string | null;
  error?: string;
}

interface RawCancellationObservation extends CancellationObservation {
  sampleIndex: number;
  sawLoading: boolean;
  openSettled: boolean;
  openError: string | null;
}

interface RuntimeVersions {
  electron: string;
  chromium: string;
  node: string;
}

interface RunStatus {
  exists: boolean;
  settled: boolean;
  error: string | null;
  detached: boolean;
  viewerAbsent: boolean;
  sawLoading: boolean;
  cancellationElapsedMs: number | null;
}

interface RegisteredRun {
  leaf: {
    detach(): void;
    view?: { containerEl?: HTMLElement };
  };
  settled: boolean;
  error: string | null;
  sawLoading?: boolean;
  cancellationStartedAt?: number;
}

interface RunRegistryWindow {
  __pptxPerformanceRuns?: Record<string, RegisteredRun>;
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

async function startInstalledOpen(vaultPath: string, token: string) {
  await browser.executeObsidian(({ app, obsidian }, filePath, runToken) => {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof obsidian.TFile)) {
      throw new Error(`Performance fixture not found: ${filePath}`);
    }
    const leaf = app.workspace.getLeaf("tab");
    app.workspace.setActiveLeaf(leaf, { focus: true });
    const benchmarkWindow = window as unknown as RunRegistryWindow;
    const registry = (benchmarkWindow.__pptxPerformanceRuns ??= {});
    const run: RegisteredRun = { leaf, settled: false, error: null };
    registry[runToken] = run;
    void leaf.openFile(file).then(
      () => {
        run.settled = true;
      },
      (error: unknown) => {
        run.settled = true;
        run.error = error instanceof Error ? error.message : String(error);
      },
    );
  }, vaultPath, token);
}

async function startInstalledCancellation(vaultPath: string, token: string) {
  await browser.executeObsidian(({ app, obsidian }, filePath, runToken) => {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof obsidian.TFile)) {
      throw new Error(`Performance fixture not found: ${filePath}`);
    }
    const leaf = app.workspace.getLeaf("tab");
    app.workspace.setActiveLeaf(leaf, { focus: true });
    const benchmarkWindow = window as unknown as RunRegistryWindow;
    const registry = (benchmarkWindow.__pptxPerformanceRuns ??= {});
    const run: RegisteredRun = {
      leaf,
      settled: false,
      error: null,
      sawLoading: false,
    };
    registry[runToken] = run;
    const observer = new MutationObserver(() => cancelWhenLoading());
    const cancelWhenLoading = () => {
      const loadingRoot = document.querySelector(
        '.workspace-leaf.mod-active .pptx-viewer[data-state="loading"]',
      );
      if (!loadingRoot || run.sawLoading) return;
      run.sawLoading = true;
      run.cancellationStartedAt = performance.now();
      observer.disconnect();
      leaf.detach();
    };
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-state"],
      childList: true,
      subtree: true,
    });
    void leaf.openFile(file).then(
      () => {
        run.settled = true;
        observer.disconnect();
      },
      (error: unknown) => {
        run.settled = true;
        run.error = error instanceof Error ? error.message : String(error);
        observer.disconnect();
      },
    );
    cancelWhenLoading();
  }, vaultPath, token);
}

async function detachRun(token: string): Promise<void> {
  await browser.executeObsidian((_context, runToken) => {
    const registry = (window as unknown as RunRegistryWindow)
      .__pptxPerformanceRuns;
    registry?.[runToken]?.leaf.detach();
  }, token);
}

async function getRunStatus(token: string): Promise<RunStatus> {
  return browser.executeObsidian((_context, runToken) => {
    const run = (window as unknown as RunRegistryWindow)
      .__pptxPerformanceRuns?.[runToken];
    const container = run?.leaf.view?.containerEl;
    return {
      exists: run !== undefined,
      settled: run?.settled ?? false,
      error: run?.error ?? null,
      detached: run === undefined || !container?.isConnected,
      viewerAbsent: document.querySelectorAll(".pptx-viewer").length === 0,
      sawLoading: run?.sawLoading ?? false,
      cancellationElapsedMs:
        run?.cancellationStartedAt === undefined
          ? null
          : performance.now() - run.cancellationStartedAt,
    };
  }, token);
}

async function waitForCleanup(
  token: string,
): Promise<{ observation: CleanupObservation; status: RunStatus }> {
  const startedAt = performance.now();
  let status = await getRunStatus(token);
  while (
    performance.now() - startedAt < OBSERVATION_WINDOW_MS &&
    !(status.settled && status.detached && status.viewerAbsent)
  ) {
    await browser.pause(25);
    status = await getRunStatus(token);
  }
  return {
    observation: {
      elapsedMs: performance.now() - startedAt,
      unfinishedWorkStopped: status.settled,
      resourcesReleased: status.detached && status.viewerAbsent,
    },
    status,
  };
}

function peakMemory(
  label: string,
  observations: readonly ElectronMemoryObservation[],
): ElectronMemoryObservation | null {
  if (observations.length === 0) return null;
  const heapPeak = observations.reduce((left, right) =>
    right.heapUsedBytes > left.heapUsedBytes ? right : left,
  );
  const rssPeak = observations.reduce((left, right) =>
    right.rssBytes > left.rssBytes ? right : left,
  );
  return {
    label,
    heapUsedBytes: heapPeak.heapUsedBytes,
    rssBytes: rssPeak.rssBytes,
    heapSource: heapPeak.heapSource,
    rssSource: rssPeak.rssSource,
  };
}

function renderProtocolMarkdown(
  opens: readonly RawOpenObservation[],
  cancellations: readonly RawCancellationObservation[],
  garbageCollection: readonly GarbageCollectionObservation[],
  memoryRuntime: ElectronMemoryRuntimeProbe,
): string {
  const lines = [
    "## Benchmark protocol evidence",
    "",
    "The cold observation is recorded but excluded from percentile gates. Two warmups are also excluded; the ten measured warm opens feed the gates.",
    "",
    "| Phase | Sample | Metadata | First readable | Slide switch | Opening state | Result |",
    "| --- | ---: | ---: | ---: | ---: | --- | --- |",
  ];
  for (const open of opens) {
    lines.push(
      `| ${open.kind} | ${open.sampleIndex} | ${open.metadataMs ?? "n/a"} | ${open.firstReadableMs ?? "n/a"} | ${open.slideSwitchMs ?? "n/a"} | ${open.openingState ?? "n/a"} | ${open.success ? "PASS" : `FAIL: ${(open.error ?? "unknown").replaceAll("|", "\\|")}`} |`,
    );
  }
  lines.push(
    "",
    "### Garbage collection behavior",
    "",
    ...garbageCollection.map(
      (observation, index) =>
        `- Sample ${index + 1}: ${observation.method}; forced=${observation.forced ? "yes" : "no"}${observation.cdpError ? `; CDP error=${observation.cdpError}` : ""}${observation.fallbackReason ? `; ${observation.fallbackReason}` : ""}`,
    ),
    "",
    "### Electron renderer memory API behavior",
    "",
    `- \`process.memoryUsage\` available: ${memoryRuntime.memoryUsageAvailable ? "yes" : "no"}`,
    `- \`process.getProcessMemoryInfo\` available: ${memoryRuntime.getProcessMemoryInfoAvailable ? "yes" : "no"}`,
    `- Selected heap source: ${memoryRuntime.selectedHeapSource ?? "none"}`,
    `- Selected RSS source: ${memoryRuntime.selectedRssSource ?? "none"}`,
    `- \`process.getProcessMemoryInfo\` keys: ${memoryRuntime.getProcessMemoryInfoKeys.join(", ") || "none"}`,
    `- \`process.getProcessMemoryInfo().residentSet\`: ${memoryRuntime.getProcessMemoryInfoResidentSet ?? "unavailable"}`,
    ...(memoryRuntime.rssFallbackReason
      ? [`- RSS fallback: ${memoryRuntime.rssFallbackReason}`]
      : []),
    ...(memoryRuntime.getProcessMemoryInfoError
      ? [`- \`process.getProcessMemoryInfo\` error: ${memoryRuntime.getProcessMemoryInfoError}`]
      : []),
    "",
    "### Stress cancellation details",
    "",
    ...cancellations.map(
      (observation) =>
        `- Sample ${observation.sampleIndex}: loading=${observation.sawLoading ? "yes" : "no"}, settled=${observation.openSettled ? "yes" : "no"}, detached=${observation.detached ? "yes" : "no"}, viewer absent=${observation.viewerAbsent ? "yes" : "no"}, elapsed=${observation.elapsedMs.toFixed(3)} ms${observation.openError ? `, error=${observation.openError}` : ""}`,
    ),
  );
  return `${lines.join("\n")}\n`;
}

describe("installed PPTX performance collector", () => {
  it("collects the complete installed Electron benchmark without hiding failures", async () => {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    const representative = performanceFixtureManifest[0]!;
    const stress = performanceFixtureManifest[1]!;
    const memoryBrowser = browser as unknown as ElectronMemoryBrowser;
    const runtimeVersions = await browser.execute(() => ({
      electron: globalThis.process?.versions.electron ?? "unavailable",
      chromium: globalThis.process?.versions.chrome ?? "unavailable",
      node: globalThis.process?.versions.node ?? "unavailable",
    })) as RuntimeVersions;
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
      coldDefinition:
        "First representative-deck open after the installed Obsidian process launched; recorded separately and excluded from latency gates.",
      warmDefinition:
        "Representative-deck opens in the same installed Obsidian process after closing the prior leaf; two warmups are excluded and ten measured opens feed gates.",
      warmupRuns: WARMUP_RUNS,
      measuredRuns: MEASURED_RUNS,
    };
    const firstReadableMs: number[] = [];
    const slideSwitchMs: number[] = [];
    const memory: ElectronMemoryObservation[] = [];
    const rawMemory: ElectronMemoryObservation[] = [];
    const cancellation: CancellationObservation[] = [];
    const rawCancellations: RawCancellationObservation[] = [];
    const cleanup: CleanupObservation[] = [];
    const garbageCollection: GarbageCollectionObservation[] = [];
    const failures: PerformanceFailure[] = [];
    const invariantFailures: string[] = [];
    const rawOpens: RawOpenObservation[] = [];

    const recordFailure = (
      phase: string,
      failureMessage: string,
      sampleIndex?: number,
    ) => {
      failures.push({ phase, message: failureMessage, ...(sampleIndex === undefined ? {} : { sampleIndex }) });
      invariantFailures.push(`${phase}${sampleIndex === undefined ? "" : ` sample ${sampleIndex}`}: ${failureMessage}`);
    };
    const tryMemory = async (
      label: string,
      sampleIndex: number,
    ): Promise<ElectronMemoryObservation | null> => {
      try {
        const observation = await collectElectronMemory(memoryBrowser, label);
        rawMemory.push(observation);
        return observation;
      } catch (error) {
        recordFailure("memory", message(error), sampleIndex);
        return null;
      }
    };

    const collectOpen = async (
      kind: OpenKind,
      sampleIndex: number,
      measured: boolean,
    ) => {
      const token = `${kind}-${sampleIndex}-${Date.now()}`;
      const raw: RawOpenObservation = {
        kind,
        sampleIndex,
        token,
        success: false,
        metadataMs: null,
        firstReadableMs: null,
        slideSwitchMs: null,
        openingState: null,
      };
      const runMemory: ElectronMemoryObservation[] = [];
      try {
        await startInstalledOpen(representative.vaultPath, token);
        if (measured) {
          const opening = await tryMemory(`${token}-opening`, sampleIndex);
          if (opening) runMemory.push(opening);
        }
        const root = await browser.$(ACTIVE_ROOT);
        await root.waitForExist({ timeout: 30_000 });
        raw.openingState = await root.getAttribute("data-state");
        await browser.waitUntil(async () => {
          const state = await root.getAttribute("data-state");
          return state === "ready" || state === "error";
        }, { timeout: 30_000, timeoutMsg: `${token} did not finish opening` });
        if ((await root.getAttribute("data-state")) !== "ready") {
          throw new Error("installed PPTX view reached error state");
        }
        raw.metadataMs = parseTiming(
          await root.getAttribute("data-metadata-ms"),
          "metadata",
        );
        raw.firstReadableMs = parseTiming(
          await root.getAttribute("data-first-readable-ms"),
          "first readable",
        );
        expect(raw.firstReadableMs).toBeGreaterThan(0);
        if (measured) {
          const next = await root.$('[data-action="next-slide"]');
          await next.click();
          await browser.waitUntil(
            async () =>
              (await root.getAttribute("data-last-slide-switch-ms")) !== null,
            { timeout: 5_000, timeoutMsg: `${token} did not switch slides` },
          );
          raw.slideSwitchMs = parseTiming(
            await root.getAttribute("data-last-slide-switch-ms"),
            "slide switch",
          );
          firstReadableMs.push(raw.firstReadableMs);
          slideSwitchMs.push(raw.slideSwitchMs);
          await browser.pause(250);
          const steady = await tryMemory(`${token}-steady`, sampleIndex);
          if (steady) runMemory.push(steady);
        }
        raw.success = true;
      } catch (error) {
        raw.error = message(error);
        recordFailure(`${kind}-open`, raw.error, sampleIndex);
      } finally {
        try {
          await detachRun(token);
          const cleanupResult = await waitForCleanup(token);
          if (measured) {
            cleanup.push(cleanupResult.observation);
            const gc = await requestElectronGarbageCollection(memoryBrowser);
            garbageCollection.push(gc);
            const remaining = Math.max(
              0,
              OBSERVATION_WINDOW_MS - cleanupResult.observation.elapsedMs,
            );
            if (remaining > 0) await browser.pause(remaining);
            const postClose = await tryMemory(
              `${token}-post-close`,
              sampleIndex,
            );
            const peak = peakMemory(`${token}-peak`, runMemory);
            if (peak) memory.push(peak);
            const steady = runMemory.find(({ label }) => label.endsWith("-steady"));
            if (steady) memory.push(steady);
            if (postClose) memory.push(postClose);
            if (
              !cleanupResult.observation.unfinishedWorkStopped ||
              !cleanupResult.observation.resourcesReleased
            ) {
              recordFailure(
                "cleanup",
                `view did not settle and release resources inside ${OBSERVATION_WINDOW_MS} ms`,
                sampleIndex,
              );
            }
          }
          if (cleanupResult.status.error && !raw.error) {
            raw.error = cleanupResult.status.error;
            raw.success = false;
            recordFailure(`${kind}-open`, raw.error, sampleIndex);
          }
        } catch (error) {
          recordFailure("cleanup", message(error), sampleIndex);
        }
        rawOpens.push(raw);
      }
    };

    await collectOpen("cold", 1, false);
    for (let index = 1; index <= WARMUP_RUNS; index += 1) {
      await collectOpen("warmup", index, false);
    }
    for (let index = 1; index <= MEASURED_RUNS; index += 1) {
      await collectOpen("measured", index, true);
    }

    for (let index = 1; index <= CANCELLATION_RUNS; index += 1) {
      const token = `cancellation-${index}-${Date.now()}`;
      try {
        await startInstalledCancellation(stress.vaultPath, token);
        const cleanupResult = await waitForCleanup(token);
        const status = cleanupResult.status;
        const observation: RawCancellationObservation = {
          sampleIndex: index,
          elapsedMs:
            status.cancellationElapsedMs ?? cleanupResult.observation.elapsedMs,
          sawLoading: status.sawLoading,
          detached: status.detached,
          viewerAbsent: status.viewerAbsent,
          openSettled: status.settled,
          openError: status.error,
        };
        rawCancellations.push(observation);
        cancellation.push(observation);
        cleanup.push(cleanupResult.observation);
        if (!status.sawLoading) {
          recordFailure(
            "cancellation",
            "stress view was not observed in loading state before detach",
            index,
          );
        }
        if (!status.settled || !status.detached || !status.viewerAbsent) {
          recordFailure(
            "cancellation",
            `stress cancellation did not settle, detach, and remove its viewer inside ${OBSERVATION_WINDOW_MS} ms`,
            index,
          );
        }
      } catch (error) {
        recordFailure("cancellation", message(error), index);
        try {
          await detachRun(token);
        } catch {
          // The original failure is preserved above.
        }
      }
    }

    const input: PerformanceInput = {
      environment,
      firstReadableMs,
      slideSwitchMs,
      resources: {
        memory,
        cancellation,
        cleanup,
        bundleBytes: (await stat(path.resolve("main.js"))).size,
        observationWindowMs: OBSERVATION_WINDOW_MS,
      },
      failures,
    };
    const summary = summarizePerformance(input);
    const protocol = {
      coldRuns: 1,
      warmupRuns: WARMUP_RUNS,
      measuredRuns: MEASURED_RUNS,
      slideSwitchesPerMeasuredRun: 1,
      cancellationRuns: CANCELLATION_RUNS,
      observationWindowMs: OBSERVATION_WINDOW_MS,
    };
    await writeFile(
      path.join(ARTIFACT_DIR, "results.json"),
      `${JSON.stringify({ protocol, memoryRuntime, rawOpens, rawMemory, rawCancellations, garbageCollection, ...summary }, null, 2)}\n`,
    );
    await writeFile(
      path.join(ARTIFACT_DIR, "summary.md"),
      `${renderPerformanceMarkdown(summary)}\n${renderProtocolMarkdown(rawOpens, rawCancellations, garbageCollection, memoryRuntime)}`,
    );

    if (invariantFailures.length > 0) {
      throw new Error(invariantFailures.join("\n"));
    }
  });
});
