import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  summarizePerformance,
  type PerformanceSummary,
} from "../../src/performance/performance-report";

interface CommittedPerformanceBaseline extends PerformanceSummary {
  readonly protocol: {
    readonly coldRuns: number;
    readonly warmupRuns: number;
    readonly measuredRuns: number;
    readonly slideSwitchesPerMeasuredRun: number;
    readonly cancellationRuns: number;
    readonly observationWindowMs: number;
  };
  readonly rawOpens: readonly unknown[];
  readonly rawMemoryAttempts: readonly unknown[];
  readonly rawCancellationAttempts: readonly unknown[];
  readonly analysis: {
    readonly metadata: { readonly sampleCount: number };
    readonly firstReadable: { readonly sampleCount: number };
    readonly slideSwitch: { readonly sampleCount: number };
    readonly cancellationElapsedMs: { readonly sampleCount: number };
    readonly cleanupElapsedMs: { readonly sampleCount: number };
    readonly failureSummary: readonly unknown[];
    readonly budgetMisses: readonly unknown[];
  };
}

const baselinePath = path.resolve(
  "tests/performance/baselines/aiden-pptx-renderer-1.2.4.json",
);
const reportPath = path.resolve(
  "docs/performance/aiden-pptx-renderer-1.2.4.md",
);
const baseline = JSON.parse(
  readFileSync(baselinePath, "utf8"),
) as CommittedPerformanceBaseline;

describe("committed installed PPTX performance baseline", () => {
  it("preserves the fixed protocol and all raw attempts", () => {
    expect(baseline.environment).toMatchObject({
      renderer: "@aiden0z/pptx-renderer@1.2.4",
      coldDefinition: expect.any(String),
      warmDefinition: expect.any(String),
      warmupRuns: 2,
      measuredRuns: 10,
      slideSwitchesPerRun: 4,
    });
    expect(baseline.protocol).toMatchObject({
      coldRuns: 1,
      warmupRuns: 2,
      measuredRuns: 10,
      slideSwitchesPerMeasuredRun: 4,
      cancellationRuns: 5,
      observationWindowMs: 2_000,
    });
    expect(baseline.rawOpens).toHaveLength(13);
    expect(baseline.rawMemoryAttempts).toHaveLength(10);
    expect(baseline.rawCancellationAttempts).toHaveLength(5);
    expect(baseline.resources.memory).toHaveLength(30);
    expect(baseline.resources.cancellation).toHaveLength(5);
    expect(baseline.resources.cleanup).toHaveLength(15);
  });

  it("matches the fixed gate calculation and expanded sample counts", () => {
    const recomputed = summarizePerformance({
      environment: baseline.environment,
      firstReadableMs: baseline.firstReadable.samples,
      slideSwitchMs: baseline.slideSwitch.samples,
      resources: baseline.resources,
      failures: baseline.failures,
    });

    expect(baseline.firstReadable).toEqual(recomputed.firstReadable);
    expect(baseline.slideSwitch).toEqual(recomputed.slideSwitch);
    expect(baseline.gates).toEqual(recomputed.gates);
    expect(baseline.analysis).toMatchObject({
      metadata: { sampleCount: 10 },
      firstReadable: { sampleCount: 10 },
      slideSwitch: { sampleCount: 40 },
      cancellationElapsedMs: { sampleCount: 5 },
      cleanupElapsedMs: { sampleCount: 10 },
      failureSummary: expect.any(Array),
      budgetMisses: expect.any(Array),
    });
  });

  it("keeps the human report tied to the same candidate and verdict", () => {
    const report = readFileSync(reportPath, "utf8");

    expect(report).toContain("# Installed PPTX performance run");
    expect(report).toContain(`| Renderer | ${baseline.environment.renderer} |`);
    expect(report).toContain(
      `Overall result: **${baseline.gates.overallPassed ? "PASS" : "FAIL"}**.`,
    );
  });
});
