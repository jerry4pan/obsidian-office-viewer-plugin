import {
  collectElectronMemory,
  probeElectronMemoryRuntime,
  requestElectronGarbageCollection,
} from "./electron-memory";

describe("Electron renderer memory collection", () => {
  it("preserves the installed runtime capability probe and selected measured sources", async () => {
    const browser = {
      execute: vi.fn().mockResolvedValue({
        memoryUsageAvailable: true,
        getProcessMemoryInfoAvailable: false,
        getProcessMemoryInfoError: null,
        getProcessMemoryInfoKeys: [],
        getProcessMemoryInfoResidentSet: null,
        rssFallbackReason:
          "process.getProcessMemoryInfo is unavailable in the installed renderer; using the measured process.memoryUsage().rss value.",
        selectedHeapSource: "process.memoryUsage().heapUsed",
        selectedRssSource: "process.memoryUsage().rss",
      }),
    };

    await expect(probeElectronMemoryRuntime(browser)).resolves.toEqual({
      memoryUsageAvailable: true,
      getProcessMemoryInfoAvailable: false,
      getProcessMemoryInfoError: null,
      getProcessMemoryInfoKeys: [],
      getProcessMemoryInfoResidentSet: null,
      rssFallbackReason:
        "process.getProcessMemoryInfo is unavailable in the installed renderer; using the measured process.memoryUsage().rss value.",
      selectedHeapSource: "process.memoryUsage().heapUsed",
      selectedRssSource: "process.memoryUsage().rss",
    });
  });

  it("preserves measured heap and renderer RSS with their runtime sources", async () => {
    const browser = {
      execute: vi.fn().mockResolvedValue({
        heapUsedBytes: 12_345,
        rssBytes: 67_890,
        heapSource: "process.memoryUsage().heapUsed",
        rssSource: "process.getProcessMemoryInfo().residentSet * 1024",
      }),
    };

    await expect(collectElectronMemory(browser, "ready")).resolves.toEqual({
      label: "ready",
      heapUsedBytes: 12_345,
      rssBytes: 67_890,
      heapSource: "process.memoryUsage().heapUsed",
      rssSource: "process.getProcessMemoryInfo().residentSet * 1024",
    });
  });

  it("rejects unavailable or non-finite measurements instead of fabricating values", async () => {
    const browser = {
      execute: vi.fn().mockResolvedValue({
        error: "Electron renderer process memory APIs are unavailable.",
      }),
    };

    await expect(collectElectronMemory(browser, "opening")).rejects.toThrow(
      "Electron renderer process memory APIs are unavailable",
    );
  });

  it("uses Chromium HeapProfiler garbage collection when available", async () => {
    const browser = {
      execute: vi.fn(),
      sendCommand: vi.fn().mockResolvedValue(undefined),
    };

    await expect(requestElectronGarbageCollection(browser)).resolves.toEqual({
      forced: true,
      method: "cdp-heap-profiler",
    });
    expect(browser.sendCommand).toHaveBeenCalledWith(
      "HeapProfiler.collectGarbage",
      {},
    );
    expect(browser.execute).not.toHaveBeenCalled();
  });

  it("falls back to exposed renderer gc when CDP is unavailable", async () => {
    const browser = {
      execute: vi.fn().mockResolvedValue(true),
      sendCommand: vi.fn().mockRejectedValue(new Error("unknown command")),
    };

    await expect(requestElectronGarbageCollection(browser)).resolves.toEqual({
      forced: true,
      method: "renderer-global-gc",
      cdpError: "unknown command",
    });
  });

  it("documents observation-only fallback when no forced GC API exists", async () => {
    const browser = {
      execute: vi.fn().mockResolvedValue(false),
      sendCommand: vi.fn().mockRejectedValue(new Error("not supported")),
    };

    await expect(requestElectronGarbageCollection(browser)).resolves.toEqual({
      forced: false,
      method: "observation-window-only",
      cdpError: "not supported",
      fallbackReason:
        "Neither CDP HeapProfiler.collectGarbage nor renderer global gc is available; post-close memory remains a measured value after the observation window.",
    });
  });
});
