import {
  evaluateResourceReturn,
  stringifyJsonEvidence,
  summarizeInstalledPerformance,
  type InstalledPerformanceAnalysisInput,
} from "./installed-performance-analysis";

function analysisInput(
  overrides: Partial<InstalledPerformanceAnalysisInput> = {},
): InstalledPerformanceAnalysisInput {
  return {
    expectedMeasuredRuns: 2,
    expectedCancellationRuns: 5,
    switchesPerRun: 3,
    metadataMs: [10, 20],
    firstReadableMs: [30, 50],
    slideSwitchMs: [1, 2, 3, 4, 5, 6],
    memory: [
      {
        peak: { heapUsedBytes: 200, rssBytes: 2_000 },
        steady: { heapUsedBytes: 180, rssBytes: 1_800 },
        postClose: { heapUsedBytes: 110, rssBytes: 1_500 },
      },
      {
        peak: { heapUsedBytes: 300, rssBytes: 3_000 },
        steady: { heapUsedBytes: 280, rssBytes: 2_800 },
        postClose: { heapUsedBytes: 120, rssBytes: 1_600 },
      },
    ],
    cancellationElapsedMs: [7, 9, 8, 6, 10],
    cleanupElapsedMs: [20, 30],
    failures: [{ phase: "memory", message: "sample missing", sampleIndex: 2 }],
    budgets: { firstReadableMs: 3_000, slideSwitchMs: 100 },
    ...overrides,
  };
}

describe("installed performance analysis", () => {
  it("refuses to silently serialize non-finite evidence as null", () => {
    expect(() =>
      stringifyJsonEvidence({ elapsedMs: Number.POSITIVE_INFINITY }),
    ).toThrow("Non-finite JSON evidence at elapsedMs: Infinity");
    expect(stringifyJsonEvidence({ elapsedMs: null, error: "timing unavailable" })).toBe(
      '{"elapsedMs":null,"error":"timing unavailable"}',
    );
  });

  it("summarizes metadata, repeated switches, memory phases, cancellation, cleanup, and failures", () => {
    const summary = summarizeInstalledPerformance(analysisInput());

    expect(summary.metadata).toMatchObject({ p50: 10, p95: 20, sampleCount: 2 });
    expect(summary.slideSwitch).toMatchObject({
      p50: 3,
      p95: 6,
      sampleCount: 6,
      expectedSampleCount: 6,
    });
    expect(summary.memory.peak.heapUsedBytes).toMatchObject({ p50: 200, p95: 300 });
    expect(summary.memory.steady.rssBytes).toMatchObject({ p50: 1_800, p95: 2_800 });
    expect(summary.memory.postClose.heapUsedBytes).toMatchObject({ p50: 110, p95: 120 });
    expect(summary.cancellationElapsedMs).toMatchObject({ p50: 8, p95: 10 });
    expect(summary.cleanupElapsedMs).toMatchObject({ p50: 20, p95: 30 });
    expect(summary.failureSummary).toEqual([
      { phase: "memory", count: 1, sampleIndexes: [2], messages: ["sample missing"] },
    ]);
  });

  it("returns typed budget misses with bottleneck classification instead of throwing", () => {
    const summary = summarizeInstalledPerformance(
      analysisInput({
        metadataMs: [2_700, 2_800],
        firstReadableMs: [3_100, 3_200],
        slideSwitchMs: [90, 101, 102, 103, 104, 105],
      }),
    );

    expect(summary.budgetMisses).toEqual([
      {
        metric: "first-readable",
        observedP95Ms: 3_200,
        budgetMs: 3_000,
        bottleneck: "metadata-loading",
      },
      {
        metric: "slide-switch",
        observedP95Ms: 105,
        budgetMs: 100,
        bottleneck: "slide-render",
      },
    ]);
  });

  it("reports missing cancellation attempts against the fixed protocol count", () => {
    const summary = summarizeInstalledPerformance(
      analysisInput({ cancellationElapsedMs: [7, 9] }),
    );
    expect(summary.cancellationElapsedMs).toMatchObject({
      sampleCount: 2,
      expectedSampleCount: 5,
      missingSampleCount: 3,
    });
  });
});

describe("post-close resource return", () => {
  it("passes only when adapter work stops, the deadline holds, and retained incremental heap is within policy", () => {
    expect(
      evaluateResourceReturn({
        preOpenHeapBytes: 100,
        steadyHeapBytes: 200,
        postCloseHeapBytes: 120,
        postCloseElapsedMs: 1_900,
        openSettled: true,
        adapterDisposed: true,
        maxRetainedHeapFraction: 0.25,
        deadlineMs: 2_000,
      }),
    ).toEqual({
      passed: true,
      deadlinePassed: true,
      adapterStopped: true,
      heapIncrementBytes: 100,
      retainedHeapBytes: 20,
      retainedHeapFraction: 0.2,
      allowedRetainedHeapBytes: 25,
      postCloseAtOrBelowSteady: true,
    });
  });

  it("fails deadline and resource return independently without hiding measured values", () => {
    expect(
      evaluateResourceReturn({
        preOpenHeapBytes: 100,
        steadyHeapBytes: 200,
        postCloseHeapBytes: 150,
        postCloseElapsedMs: 2_001,
        openSettled: true,
        adapterDisposed: false,
        maxRetainedHeapFraction: 0.25,
        deadlineMs: 2_000,
      }),
    ).toMatchObject({
      passed: false,
      deadlinePassed: false,
      adapterStopped: false,
      retainedHeapFraction: 0.5,
    });
  });

  it("fails when post-close heap exceeds steady heap even if a former noise floor would allow it", () => {
    expect(
      evaluateResourceReturn({
        preOpenHeapBytes: 10_000_000,
        steadyHeapBytes: 11_000_000,
        postCloseHeapBytes: 11_500_000,
        postCloseElapsedMs: 1_850,
        openSettled: true,
        adapterDisposed: true,
        maxRetainedHeapFraction: 0.5,
        deadlineMs: 2_000,
      }),
    ).toMatchObject({
      passed: false,
      retainedHeapBytes: 1_500_000,
      retainedHeapFraction: 1.5,
      allowedRetainedHeapBytes: 500_000,
      postCloseAtOrBelowSteady: false,
    });
  });

  it("uses null rather than non-JSON Infinity when no open heap increment exists", () => {
    expect(
      evaluateResourceReturn({
        preOpenHeapBytes: 100,
        steadyHeapBytes: 100,
        postCloseHeapBytes: 150,
        postCloseElapsedMs: 1_900,
        openSettled: true,
        adapterDisposed: true,
        maxRetainedHeapFraction: 0.5,
        deadlineMs: 2_000,
      }),
    ).toMatchObject({ passed: false, retainedHeapFraction: null });
  });

  it("handles a negative workload increment conservatively and JSON-safely", () => {
    const result = evaluateResourceReturn({
      preOpenHeapBytes: 200,
      steadyHeapBytes: 150,
      postCloseHeapBytes: 175,
      postCloseElapsedMs: 1_900,
      openSettled: true,
      adapterDisposed: true,
      maxRetainedHeapFraction: 0.5,
      deadlineMs: 2_000,
    });
    expect(result).toMatchObject({
      passed: false,
      heapIncrementBytes: 0,
      allowedRetainedHeapBytes: 0,
      retainedHeapFraction: null,
      postCloseAtOrBelowSteady: false,
    });
    expect(stringifyJsonEvidence(result)).not.toContain("Infinity");
  });
});
