import {
  renderPerformanceMarkdown,
  type PerformanceSummary,
} from "../../src/performance/performance-report";
import type { ElectronMemoryRuntimeProbe } from "./electron-memory";
import type { summarizeInstalledPerformance } from "./installed-performance-analysis";

type Analysis = ReturnType<typeof summarizeInstalledPerformance>;

export interface InstalledMarkdownArtifact extends PerformanceSummary {
  readonly protocol: {
    readonly observationWindowMs: number;
    readonly postCloseSampleTargetMs: number;
    readonly maxRetainedHeapFraction: number;
    readonly attemptTimeoutMs: number;
  };
  readonly memoryRuntime: ElectronMemoryRuntimeProbe;
  readonly rawMemoryAttempts: readonly {
    readonly loadingSnapshotCount: number;
  }[];
  readonly rawCancellationAttempts: readonly {
    readonly cancellationElapsedMs: number | null;
    readonly resourceCompletionElapsedMs: number | null;
    readonly sawInFlight: boolean;
    readonly inFlightSnapshotCount: number;
  }[];
  readonly analysis: Analysis;
}

function metricRow(
  label: string,
  summary: {
    p50: number | null;
    p95: number | null;
    sampleCount: number;
    expectedSampleCount: number;
  },
) {
  return `| ${label} | ${summary.sampleCount}/${summary.expectedSampleCount} | ${summary.p50 ?? "n/a"} | ${summary.p95 ?? "n/a"} |`;
}

function renderInstalledAnalysis(artifact: InstalledMarkdownArtifact): string {
  const { analysis, memoryRuntime, protocol } = artifact;
  const lines = [
    "## Expanded statistical summaries",
    "",
    "| Metric | Samples | p50 | p95 |",
    "| --- | ---: | ---: | ---: |",
    metricRow("Metadata/open", analysis.metadata),
    metricRow("First readable", analysis.firstReadable),
    metricRow("Slide switch", analysis.slideSwitch),
    metricRow("Cancellation / adapter-stop elapsed", analysis.cancellationElapsedMs),
    metricRow(
      "Full resource completion elapsed",
      analysis.resourceCompletionElapsedMs,
    ),
    "",
    "| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...(["peak", "steady", "postClose"] as const).map(
      (phase) =>
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
    `- One monotonic ${protocol.attemptTimeoutMs} ms deadline covers open, all slide switches, and cleanup for each attempt; it is never reset between phases. Atomic progress evidence is replaced after every completed attempt.`,
    "- Peak means the single actual snapshot with maximum heap used between open start and the explicit steady capture. Its RSS is from that same instant; independent maxima are not combined.",
    `- Post-close capture target: ${protocol.postCloseSampleTargetMs} ms from the renderer timestamp immediately before detach; hard deadline: ${protocol.observationWindowMs} ms, including detach, CDP GC, adapter settlement, and post-close sampling.`,
    `- Heap release passes only when post-close heap is at or below the workload peak and retained incremental heap is no greater than ${protocol.maxRetainedHeapFraction * 100}% of the observed positive pre-open-to-workload increment. The allowance is capped by that measured increment; no uncalibrated floor is used. RSS is reported but not gated because Electron/Chromium allocators retain and share resident pages noisily.`,
    `- Memory attempts: ${artifact.rawMemoryAttempts.length}; all have loading snapshot: ${artifact.rawMemoryAttempts.every(({ loadingSnapshotCount }) => loadingSnapshotCount > 0) ? "yes" : "no"}.`,
    `- In-flight cancellation attempts: ${artifact.rawCancellationAttempts.length}; all prove adapter-opening: ${artifact.rawCancellationAttempts.every(({ sawInFlight, inFlightSnapshotCount }) => sawInFlight && inFlightSnapshotCount > 0) ? "yes" : "no"}; all adapter stops met deadline: ${artifact.rawCancellationAttempts.every(({ cancellationElapsedMs }) => cancellationElapsedMs !== null && cancellationElapsedMs <= protocol.observationWindowMs) ? "yes" : "no"}; all full resource completions met deadline: ${artifact.rawCancellationAttempts.every(({ resourceCompletionElapsedMs }) => resourceCompletionElapsedMs !== null && resourceCompletionElapsedMs <= protocol.observationWindowMs) ? "yes" : "no"}.`,
    `- Renderer memory source: ${memoryRuntime.selectedHeapSource ?? "none"}; RSS source: ${memoryRuntime.selectedRssSource ?? "none"}.`,
  ];
  return `${lines.join("\n")}\n`;
}

export function renderInstalledPerformanceMarkdown(
  artifact: InstalledMarkdownArtifact,
): string {
  return `${renderPerformanceMarkdown(artifact)}\n${renderInstalledAnalysis(artifact)}`;
}
