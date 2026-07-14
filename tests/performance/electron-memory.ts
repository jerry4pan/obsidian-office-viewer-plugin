import type { MemoryObservation } from "../../src/performance/performance-report";

export type HeapMemorySource = "process.memoryUsage().heapUsed";
export type RssMemorySource =
  | "process.getProcessMemoryInfo().residentSet * 1024"
  | "process.memoryUsage().rss";

export interface ElectronMemoryObservation extends MemoryObservation {
  readonly heapSource: HeapMemorySource;
  readonly rssSource: RssMemorySource;
}

export interface GarbageCollectionObservation {
  readonly forced: boolean;
  readonly method:
    | "cdp-heap-profiler"
    | "renderer-global-gc"
    | "observation-window-only";
  readonly cdpError?: string;
  readonly fallbackReason?: string;
}

export interface ElectronMemoryRuntimeProbe {
  readonly memoryUsageAvailable: boolean;
  readonly getProcessMemoryInfoAvailable: boolean;
  readonly getProcessMemoryInfoError: string | null;
  readonly getProcessMemoryInfoKeys: readonly string[];
  readonly getProcessMemoryInfoResidentSet: number | null;
  readonly rssFallbackReason: string | null;
  readonly selectedHeapSource: HeapMemorySource | null;
  readonly selectedRssSource: RssMemorySource | null;
}

interface MemoryExecutionResult {
  readonly heapUsedBytes?: number;
  readonly rssBytes?: number;
  readonly heapSource?: HeapMemorySource;
  readonly rssSource?: RssMemorySource;
  readonly error?: string;
}

export interface ElectronMemoryBrowser {
  execute(script: () => unknown): Promise<unknown>;
  sendCommand?(command: string, parameters: object): Promise<unknown>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function probeElectronMemoryRuntime(
  browser: ElectronMemoryBrowser,
): Promise<ElectronMemoryRuntimeProbe> {
  return (await browser.execute(async () => {
    type ElectronRendererProcess = {
      memoryUsage?: () => { heapUsed?: number; rss?: number };
      getProcessMemoryInfo?: () => Promise<Record<string, unknown>>;
    };
    const rendererProcess = globalThis.process as ElectronRendererProcess;
    const memoryUsageAvailable =
      typeof rendererProcess?.memoryUsage === "function";
    const getProcessMemoryInfoAvailable =
      typeof rendererProcess?.getProcessMemoryInfo === "function";
    const nodeMemory = memoryUsageAvailable
      ? rendererProcess.memoryUsage!()
      : undefined;
    let electronRssAvailable = false;
    let getProcessMemoryInfoKeys: string[] = [];
    let getProcessMemoryInfoResidentSet: number | null = null;
    let getProcessMemoryInfoError: string | null = null;
    if (getProcessMemoryInfoAvailable) {
      try {
        const electronMemory = await rendererProcess.getProcessMemoryInfo!();
        getProcessMemoryInfoKeys = Object.keys(electronMemory).sort();
        getProcessMemoryInfoResidentSet = Number.isFinite(
          electronMemory.residentSet,
        )
          ? (electronMemory.residentSet as number)
          : null;
        electronRssAvailable = Number.isFinite(electronMemory.residentSet);
      } catch (error) {
        getProcessMemoryInfoError =
          error instanceof Error ? error.message : String(error);
      }
    }
    return {
      memoryUsageAvailable,
      getProcessMemoryInfoAvailable,
      getProcessMemoryInfoError,
      getProcessMemoryInfoKeys,
      getProcessMemoryInfoResidentSet,
      rssFallbackReason: electronRssAvailable
        ? null
        : getProcessMemoryInfoAvailable
          ? "process.getProcessMemoryInfo returned no finite residentSet in the installed renderer; using the measured process.memoryUsage().rss value."
          : "process.getProcessMemoryInfo is unavailable in the installed renderer; using the measured process.memoryUsage().rss value.",
      selectedHeapSource: Number.isFinite(nodeMemory?.heapUsed)
        ? ("process.memoryUsage().heapUsed" as const)
        : null,
      selectedRssSource: electronRssAvailable
        ? ("process.getProcessMemoryInfo().residentSet * 1024" as const)
        : Number.isFinite(nodeMemory?.rss)
          ? ("process.memoryUsage().rss" as const)
          : null,
    };
  })) as ElectronMemoryRuntimeProbe;
}

export async function collectElectronMemory(
  browser: ElectronMemoryBrowser,
  label: string,
): Promise<ElectronMemoryObservation> {
  const raw = (await browser.execute(async () => {
    type ElectronRendererProcess = {
      memoryUsage?: () => { heapUsed?: number; rss?: number };
      getProcessMemoryInfo?: () => Promise<{ residentSet?: number }>;
    };
    const rendererProcess = globalThis.process as ElectronRendererProcess;
    if (typeof rendererProcess?.memoryUsage !== "function") {
      return {
        error: "Electron renderer process memory APIs are unavailable.",
      };
    }

    const nodeMemory = rendererProcess.memoryUsage();
    const heapUsedBytes = nodeMemory.heapUsed;
    if (!Number.isFinite(heapUsedBytes)) {
      return {
        error: "Electron renderer heapUsed measurement is unavailable.",
      };
    }

    if (typeof rendererProcess.getProcessMemoryInfo === "function") {
      try {
        const electronMemory = await rendererProcess.getProcessMemoryInfo();
        if (Number.isFinite(electronMemory.residentSet)) {
          return {
            heapUsedBytes,
            rssBytes: electronMemory.residentSet! * 1024,
            heapSource: "process.memoryUsage().heapUsed" as const,
            rssSource:
              "process.getProcessMemoryInfo().residentSet * 1024" as const,
          };
        }
      } catch {
        // The installed Electron runtime can omit or reject this API. The
        // process.memoryUsage RSS value remains an actual renderer measurement.
      }
    }

    if (Number.isFinite(nodeMemory.rss)) {
      return {
        heapUsedBytes,
        rssBytes: nodeMemory.rss!,
        heapSource: "process.memoryUsage().heapUsed" as const,
        rssSource: "process.memoryUsage().rss" as const,
      };
    }
    return { error: "Electron renderer RSS measurement is unavailable." };
  })) as MemoryExecutionResult;

  if (raw.error) throw new Error(raw.error);
  if (
    !Number.isFinite(raw.heapUsedBytes) ||
    !Number.isFinite(raw.rssBytes) ||
    !raw.heapSource ||
    !raw.rssSource
  ) {
    throw new Error(
      "Electron renderer returned an incomplete memory measurement.",
    );
  }

  return {
    label,
    heapUsedBytes: raw.heapUsedBytes!,
    rssBytes: raw.rssBytes!,
    heapSource: raw.heapSource,
    rssSource: raw.rssSource,
  };
}

export async function requestElectronGarbageCollection(
  browser: ElectronMemoryBrowser,
): Promise<GarbageCollectionObservation> {
  let cdpError: string | undefined;
  if (browser.sendCommand) {
    try {
      await browser.sendCommand("HeapProfiler.collectGarbage", {});
      return { forced: true, method: "cdp-heap-profiler" };
    } catch (error) {
      cdpError = errorMessage(error);
    }
  } else {
    cdpError = "Chromium sendCommand is unavailable.";
  }

  const rendererGcRan = (await browser.execute(() => {
    const rendererGlobal = globalThis as typeof globalThis & {
      gc?: () => void;
    };
    if (typeof rendererGlobal.gc !== "function") return false;
    rendererGlobal.gc();
    return true;
  })) as boolean;
  if (rendererGcRan) {
    return {
      forced: true,
      method: "renderer-global-gc",
      cdpError,
    };
  }
  return {
    forced: false,
    method: "observation-window-only",
    cdpError,
    fallbackReason:
      "Neither CDP HeapProfiler.collectGarbage nor renderer global gc is available; post-close memory remains a measured value after the observation window.",
  };
}
