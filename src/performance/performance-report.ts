export const PERFORMANCE_BUDGETS = {
  firstReadableMs: 3_000,
  slideSwitchMs: 100,
} as const;

export interface PerformanceEnvironment {
  readonly device: string;
  readonly os: string;
  readonly obsidianVersion: string;
  readonly electronVersion: string;
  readonly renderer: string;
  readonly coldDefinition: string;
  readonly warmDefinition: string;
  readonly warmupRuns: number;
  readonly measuredRuns: number;
  readonly slideSwitchesPerRun?: number;
}

export interface MemoryObservation {
  readonly label: string;
  readonly heapUsedBytes: number;
  readonly rssBytes: number;
}

export interface CancellationObservation {
  readonly elapsedMs: number;
  readonly detached: boolean;
  readonly viewerAbsent: boolean;
}

export interface CleanupObservation {
  readonly elapsedMs: number;
  readonly unfinishedWorkStopped: boolean;
  readonly resourcesReleased: boolean;
}

export interface PerformanceResources {
  readonly memory: readonly MemoryObservation[];
  readonly cancellation: readonly CancellationObservation[];
  readonly cleanup: readonly CleanupObservation[];
  readonly bundleBytes: number;
  readonly observationWindowMs: number;
}

export interface PerformanceFailure {
  readonly phase: string;
  readonly message: string;
  readonly sampleIndex?: number;
}

export interface PerformanceInput {
  readonly environment: PerformanceEnvironment;
  readonly firstReadableMs: readonly number[];
  readonly slideSwitchMs: readonly number[];
  readonly resources: PerformanceResources;
  readonly failures: readonly PerformanceFailure[];
}

export interface PercentileSummary {
  readonly samples: readonly number[];
  readonly invalidSamples: readonly InvalidPerformanceSample[];
  readonly expectedSampleCount: number;
  readonly missingSampleCount: number;
  readonly p50: number | null;
  readonly p95: number | null;
}

export type InvalidPerformanceSampleValue = "NaN" | "Infinity" | "-Infinity";

export interface InvalidPerformanceSample {
  readonly index: number;
  readonly value: InvalidPerformanceSampleValue;
}

export interface PerformanceSummary {
  readonly environment: PerformanceEnvironment;
  readonly firstReadable: PercentileSummary;
  readonly slideSwitch: PercentileSummary;
  readonly resources: PerformanceResources;
  readonly failures: readonly PerformanceFailure[];
  readonly gates: {
    readonly firstReadable: {
      readonly budgetMs: typeof PERFORMANCE_BUDGETS.firstReadableMs;
      readonly passed: boolean;
    };
    readonly slideSwitch: {
      readonly budgetMs: typeof PERFORMANCE_BUDGETS.slideSwitchMs;
      readonly passed: boolean;
    };
    readonly overallPassed: boolean;
  };
}

function nearestRank(
  sortedSamples: readonly number[],
  percentile: number,
): number | null {
  if (sortedSamples.length === 0) return null;
  return sortedSamples[Math.ceil(percentile * sortedSamples.length) - 1] ?? null;
}

function summarizeSamples(
  samples: readonly number[],
  expectedSampleCount: number,
): PercentileSummary {
  const invalidSamples = samples.flatMap((sample, index) => {
    if (Number.isFinite(sample)) return [];
    const value: InvalidPerformanceSampleValue = Number.isNaN(sample)
      ? "NaN"
      : sample > 0
        ? "Infinity"
        : "-Infinity";
    return [{ index, value }];
  });
  const finiteSamples = samples
    .filter((sample) => Number.isFinite(sample))
    .sort((left, right) => left - right);
  return {
    samples: [...samples],
    invalidSamples,
    expectedSampleCount,
    missingSampleCount: Math.max(0, expectedSampleCount - samples.length),
    p50: nearestRank(finiteSamples, 0.5),
    p95: nearestRank(finiteSamples, 0.95),
  };
}

export function summarizePerformance(
  input: PerformanceInput,
): PerformanceSummary {
  const firstReadable = summarizeSamples(
    input.firstReadableMs,
    input.environment.measuredRuns,
  );
  const slideSwitch = summarizeSamples(
    input.slideSwitchMs,
    input.environment.measuredRuns *
      (input.environment.slideSwitchesPerRun ?? 1),
  );
  const firstReadablePassed =
    firstReadable.p95 !== null &&
    firstReadable.invalidSamples.length === 0 &&
    firstReadable.missingSampleCount === 0 &&
    firstReadable.p95 <= PERFORMANCE_BUDGETS.firstReadableMs;
  const slideSwitchPassed =
    slideSwitch.p95 !== null &&
    slideSwitch.invalidSamples.length === 0 &&
    slideSwitch.missingSampleCount === 0 &&
    slideSwitch.p95 <= PERFORMANCE_BUDGETS.slideSwitchMs;
  const failures = input.failures.map((failure) => ({ ...failure }));
  for (const [phase, metric] of [
    ["first-readable", firstReadable],
    ["slide-switch", slideSwitch],
  ] as const) {
    for (const invalidSample of metric.invalidSamples) {
      failures.push({
        phase,
        message: `Invalid performance sample at index ${invalidSample.index}: ${invalidSample.value}.`,
      });
    }
    if (metric.missingSampleCount > 0) {
      failures.push({
        phase,
        message: `Expected ${metric.expectedSampleCount} performance samples but received ${metric.samples.length}; ${metric.missingSampleCount} missing.`,
      });
    }
  }

  return {
    environment: { ...input.environment },
    firstReadable,
    slideSwitch,
    resources: {
      ...input.resources,
      memory: input.resources.memory.map((observation) => ({ ...observation })),
      cancellation: input.resources.cancellation.map((observation) => ({
        ...observation,
      })),
      cleanup: input.resources.cleanup.map((observation) => ({ ...observation })),
    },
    failures,
    gates: {
      firstReadable: {
        budgetMs: PERFORMANCE_BUDGETS.firstReadableMs,
        passed: firstReadablePassed,
      },
      slideSwitch: {
        budgetMs: PERFORMANCE_BUDGETS.slideSwitchMs,
        passed: slideSwitchPassed,
      },
      overallPassed:
        firstReadablePassed && slideSwitchPassed && failures.length === 0,
    },
  };
}

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function formatMilliseconds(value: number | null): string {
  return value === null ? "n/a" : `${decimalFormatter.format(value)} ms`;
}

function markdownCell(value: string | number): string {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderPerformanceMarkdown(
  summary: PerformanceSummary,
): string {
  const lines = [
    "# Installed PPTX performance run",
    "",
    `Overall result: **${summary.gates.overallPassed ? "PASS" : "FAIL"}**.`,
    "",
    "| M0 latency gate | p50 | p95 | Budget | Result |",
    "| --- | ---: | ---: | ---: | --- |",
    `| First readable slide | ${formatMilliseconds(summary.firstReadable.p50)} | ${formatMilliseconds(summary.firstReadable.p95)} | <= ${formatMilliseconds(summary.gates.firstReadable.budgetMs)} | ${summary.gates.firstReadable.passed ? "PASS" : "FAIL"} |`,
    `| Rendered page switch | ${formatMilliseconds(summary.slideSwitch.p50)} | ${formatMilliseconds(summary.slideSwitch.p95)} | <= ${formatMilliseconds(summary.gates.slideSwitch.budgetMs)} | ${summary.gates.slideSwitch.passed ? "PASS" : "FAIL"} |`,
    "",
    "## Raw observations",
    "",
    `- First readable slide (ms): \`${summary.firstReadable.samples.join(", ")}\``,
    `- Rendered page switch (ms): \`${summary.slideSwitch.samples.join(", ")}\``,
    "",
    "## Environment",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Device | ${markdownCell(summary.environment.device)} |`,
    `| OS | ${markdownCell(summary.environment.os)} |`,
    `| Obsidian | ${markdownCell(summary.environment.obsidianVersion)} |`,
    `| Electron | ${markdownCell(summary.environment.electronVersion)} |`,
    `| Renderer | ${markdownCell(summary.environment.renderer)} |`,
    `| Cold definition | ${markdownCell(summary.environment.coldDefinition)} |`,
    `| Warm definition | ${markdownCell(summary.environment.warmDefinition)} |`,
    `| Warmups | ${summary.environment.warmupRuns} |`,
    `| Measured runs | ${summary.environment.measuredRuns} |`,
    "",
    "## Resources",
    "",
    `- Production bundle: ${integerFormatter.format(summary.resources.bundleBytes)} bytes`,
    `- Cleanup observation window: ${integerFormatter.format(summary.resources.observationWindowMs)} ms`,
    `- Memory observations: ${summary.resources.memory.length}`,
    `- Cancellation observations: ${summary.resources.cancellation.length}`,
    `- Cleanup observations: ${summary.resources.cleanup.length}`,
  ];

  if (summary.resources.memory.length > 0) {
    lines.push(
      "",
      "### Memory observations",
      "",
      "| Label | Heap used (bytes) | RSS (bytes) |",
      "| --- | ---: | ---: |",
    );
    for (const observation of summary.resources.memory) {
      lines.push(
        `| ${markdownCell(observation.label)} | ${integerFormatter.format(observation.heapUsedBytes)} | ${integerFormatter.format(observation.rssBytes)} |`,
      );
    }
  }

  if (summary.resources.cancellation.length > 0) {
    lines.push(
      "",
      "### Cancellation observations",
      "",
      "| Sample | Elapsed | Detached | Viewer absent |",
      "| ---: | ---: | --- | --- |",
    );
    summary.resources.cancellation.forEach((observation, index) => {
      lines.push(
        `| ${index + 1} | ${formatMilliseconds(observation.elapsedMs)} | ${observation.detached ? "yes" : "no"} | ${observation.viewerAbsent ? "yes" : "no"} |`,
      );
    });
  }

  if (summary.resources.cleanup.length > 0) {
    lines.push(
      "",
      "### Cleanup observations",
      "",
      "| Sample | Elapsed | Work stopped | Resources released |",
      "| ---: | ---: | --- | --- |",
    );
    summary.resources.cleanup.forEach((observation, index) => {
      lines.push(
        `| ${index + 1} | ${formatMilliseconds(observation.elapsedMs)} | ${observation.unfinishedWorkStopped ? "yes" : "no"} | ${observation.resourcesReleased ? "yes" : "no"} |`,
      );
    });
  }

  lines.push("", "## Failures", "");

  if (summary.failures.length === 0) {
    lines.push("None.");
  } else {
    for (const failure of summary.failures) {
      const sample =
        failure.sampleIndex === undefined ? "" : ` sample ${failure.sampleIndex}`;
      lines.push(
        `- \`${markdownCell(failure.phase)}\`${sample}: ${markdownCell(failure.message)}`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
