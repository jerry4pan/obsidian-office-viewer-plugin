import type { PerformanceFailure } from "../../src/performance/performance-report";

export function stringifyJsonEvidence(value: unknown, space?: number): string {
  return JSON.stringify(
    value,
    (key, current) => {
      if (typeof current === "number" && !Number.isFinite(current)) {
        throw new Error(`Non-finite JSON evidence at ${key || "<root>"}: ${String(current)}`);
      }
      return current;
    },
    space,
  );
}

export interface DistributionSummary {
  readonly samples: readonly number[];
  readonly sampleCount: number;
  readonly expectedSampleCount: number;
  readonly missingSampleCount: number;
  readonly p50: number | null;
  readonly p95: number | null;
}

export interface MemoryPhaseInput {
  readonly heapUsedBytes: number;
  readonly rssBytes: number;
}

export interface MemoryRunInput {
  readonly peak: MemoryPhaseInput;
  readonly steady: MemoryPhaseInput;
  readonly postClose: MemoryPhaseInput;
}

export interface InstalledPerformanceAnalysisInput {
  readonly expectedMeasuredRuns: number;
  readonly expectedCancellationRuns: number;
  readonly expectedResourceCompletionRuns: number;
  readonly switchesPerRun: number;
  readonly metadataMs: readonly number[];
  readonly firstReadableMs: readonly number[];
  readonly slideSwitchMs: readonly number[];
  readonly thumbnailReadinessMs: readonly number[];
  readonly mountedThumbnailCounts: readonly number[];
  readonly runOutcomes: readonly ("passed" | "failed")[];
  readonly requiredConsecutiveCleanRuns: number;
  readonly memory: readonly MemoryRunInput[];
  readonly cancellationElapsedMs: readonly number[];
  readonly resourceCompletionElapsedMs: readonly number[];
  readonly failures: readonly PerformanceFailure[];
  readonly budgets: {
    readonly firstReadableMs: number;
    readonly slideSwitchMs: number;
  };
}

export type BottleneckClassification =
  | "metadata-loading"
  | "first-slide-render"
  | "slide-render";

export interface BudgetMiss {
  readonly metric: "first-readable" | "slide-switch";
  readonly observedP95Ms: number;
  readonly budgetMs: number;
  readonly bottleneck: BottleneckClassification;
}

export interface FailurePhaseSummary {
  readonly phase: string;
  readonly count: number;
  readonly sampleIndexes: readonly number[];
  readonly messages: readonly string[];
}

function distribution(
  samples: readonly number[],
  expectedSampleCount: number,
): DistributionSummary {
  const sorted = samples.filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (value: number) =>
    sorted[Math.ceil(value * sorted.length) - 1] ?? null;
  return {
    samples: [...samples],
    sampleCount: samples.length,
    expectedSampleCount,
    missingSampleCount: Math.max(0, expectedSampleCount - samples.length),
    p50: percentile(0.5),
    p95: percentile(0.95),
  };
}

export function summarizeInstalledPerformance(
  input: InstalledPerformanceAnalysisInput,
) {
  const metadata = distribution(input.metadataMs, input.expectedMeasuredRuns);
  const firstReadable = distribution(
    input.firstReadableMs,
    input.expectedMeasuredRuns,
  );
  const slideSwitch = distribution(
    input.slideSwitchMs,
    input.expectedMeasuredRuns * input.switchesPerRun,
  );
  const thumbnailReadiness = distribution(
    input.thumbnailReadinessMs,
    input.expectedMeasuredRuns,
  );
  const mountedThumbnails = distribution(
    input.mountedThumbnailCounts,
    input.expectedMeasuredRuns,
  );
  let consecutiveCleanRuns = 0;
  for (const outcome of [...input.runOutcomes].reverse()) {
    if (outcome !== "passed") break;
    consecutiveCleanRuns += 1;
  }
  const runSelection = {
    attemptCount: input.runOutcomes.length,
    failedAttemptCount: input.runOutcomes.filter((outcome) => outcome === "failed")
      .length,
    consecutiveCleanRuns,
    requiredConsecutiveCleanRuns: input.requiredConsecutiveCleanRuns,
    eligibleForPromotion:
      consecutiveCleanRuns >= input.requiredConsecutiveCleanRuns,
  };
  const memoryPhase = (phase: keyof MemoryRunInput) => ({
    heapUsedBytes: distribution(
      input.memory.map((run) => run[phase].heapUsedBytes),
      input.expectedMeasuredRuns,
    ),
    rssBytes: distribution(
      input.memory.map((run) => run[phase].rssBytes),
      input.expectedMeasuredRuns,
    ),
  });
  const failureMap = new Map<string, PerformanceFailure[]>();
  for (const failure of input.failures) {
    const current = failureMap.get(failure.phase) ?? [];
    current.push(failure);
    failureMap.set(failure.phase, current);
  }
  const failureSummary = [...failureMap].map(([phase, failures]) => ({
    phase,
    count: failures.length,
    sampleIndexes: failures.flatMap(({ sampleIndex }) =>
      sampleIndex === undefined ? [] : [sampleIndex],
    ),
    messages: failures.map(({ message }) => message),
  }));
  const budgetMisses: BudgetMiss[] = [];
  if (
    firstReadable.p95 !== null &&
    firstReadable.p95 > input.budgets.firstReadableMs
  ) {
    budgetMisses.push({
      metric: "first-readable",
      observedP95Ms: firstReadable.p95,
      budgetMs: input.budgets.firstReadableMs,
      bottleneck:
        metadata.p95 !== null && metadata.p95 / firstReadable.p95 >= 0.5
          ? "metadata-loading"
          : "first-slide-render",
    });
  }
  if (
    slideSwitch.p95 !== null &&
    slideSwitch.p95 > input.budgets.slideSwitchMs
  ) {
    budgetMisses.push({
      metric: "slide-switch",
      observedP95Ms: slideSwitch.p95,
      budgetMs: input.budgets.slideSwitchMs,
      bottleneck: "slide-render",
    });
  }
  return {
    metadata,
    firstReadable,
    slideSwitch,
    thumbnailReadiness,
    mountedThumbnails,
    runSelection,
    memory: {
      peak: memoryPhase("peak"),
      steady: memoryPhase("steady"),
      postClose: memoryPhase("postClose"),
    },
    cancellationElapsedMs: distribution(
      input.cancellationElapsedMs,
      input.expectedCancellationRuns,
    ),
    resourceCompletionElapsedMs: distribution(
      input.resourceCompletionElapsedMs,
      input.expectedResourceCompletionRuns,
    ),
    failureSummary,
    budgetMisses,
  };
}

export interface ResourceReturnInput {
  readonly preOpenHeapBytes: number;
  readonly steadyHeapBytes: number;
  readonly postCloseHeapBytes: number;
  readonly postCloseElapsedMs: number;
  readonly openSettled: boolean;
  readonly adapterDisposed: boolean;
  readonly maxRetainedHeapFraction: number;
  readonly deadlineMs: number;
}

export function resourceCompletionElapsedMs(input: {
  readonly cleanupElapsedMs: number;
  readonly gcCompletedElapsedMs: number;
  readonly postCloseElapsedMs: number;
}): number {
  return Math.max(
    input.cleanupElapsedMs,
    input.gcCompletedElapsedMs,
    input.postCloseElapsedMs,
  );
}

export function evaluateResourceReturn(input: ResourceReturnInput) {
  const heapIncrementBytes = Math.max(
    0,
    input.steadyHeapBytes - input.preOpenHeapBytes,
  );
  const retainedHeapBytes = Math.max(
    0,
    input.postCloseHeapBytes - input.preOpenHeapBytes,
  );
  const retainedHeapFraction: number | null =
    heapIncrementBytes === 0
      ? null
      : retainedHeapBytes / heapIncrementBytes;
  const deadlinePassed = input.postCloseElapsedMs <= input.deadlineMs;
  const adapterStopped = input.openSettled && input.adapterDisposed;
  const allowedRetainedHeapBytes = Math.min(
    heapIncrementBytes,
    heapIncrementBytes *
      Math.max(0, Math.min(1, input.maxRetainedHeapFraction)),
  );
  const postCloseAtOrBelowSteady =
    input.postCloseHeapBytes <= input.steadyHeapBytes;
  return {
    passed:
      deadlinePassed &&
      adapterStopped &&
      postCloseAtOrBelowSteady &&
      retainedHeapBytes <= allowedRetainedHeapBytes,
    deadlinePassed,
    adapterStopped,
    heapIncrementBytes,
    retainedHeapBytes,
    retainedHeapFraction,
    allowedRetainedHeapBytes,
    postCloseAtOrBelowSteady,
  };
}
