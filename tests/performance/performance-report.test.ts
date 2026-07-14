import { describe, expect, it } from "vitest";
import {
  renderPerformanceMarkdown,
  summarizePerformance,
  type PerformanceFailure,
  type PerformanceInput,
} from "../../src/performance/performance-report";

function performanceInput(
  overrides: Partial<PerformanceInput> = {},
): PerformanceInput {
  return {
    environment: {
      device: "reference-device",
      os: "reference-os",
      obsidianVersion: "1.13.1",
      electronVersion: "reference-electron",
      renderer: "@aiden0z/pptx-renderer@1.2.4",
      coldDefinition: "first open after Obsidian launch",
      warmDefinition: "subsequent open in the same Obsidian session",
      warmupRuns: 2,
      measuredRuns: 3,
    },
    firstReadableMs: [1_000, 2_000, 3_100],
    slideSwitchMs: [40, 80, 120],
    resources: {
      memory: [],
      cancellation: [],
      cleanup: [],
      bundleBytes: 123_456,
      observationWindowMs: 2_000,
    },
    failures: [],
    ...overrides,
  };
}

describe("performance report", () => {
  it("uses nearest-rank p95 values for the fixed M0 latency gates", () => {
    const summary = summarizePerformance(performanceInput());

    expect(summary.firstReadable.p95).toBe(3_100);
    expect(summary.slideSwitch.p95).toBe(120);
    expect(summary.gates.firstReadable).toEqual({
      budgetMs: 3_000,
      passed: false,
    });
    expect(summary.gates.slideSwitch).toEqual({
      budgetMs: 100,
      passed: false,
    });
    expect(summary.gates.overallPassed).toBe(false);
  });

  it("fails gates and preserves JSON-safe evidence for non-finite samples", () => {
    const summary = summarizePerformance(
      performanceInput({
        environment: {
          ...performanceInput().environment,
          measuredRuns: 2,
        },
        firstReadableMs: [1_000, Number.POSITIVE_INFINITY],
        slideSwitchMs: [40, Number.NaN],
      }),
    );

    expect(summary.firstReadable.p95).toBe(1_000);
    expect(summary.slideSwitch.p95).toBe(40);
    expect(summary.firstReadable.invalidSamples).toEqual([
      { index: 1, value: "Infinity" },
    ]);
    expect(summary.slideSwitch.invalidSamples).toEqual([
      { index: 1, value: "NaN" },
    ]);
    expect(summary.gates.firstReadable.passed).toBe(false);
    expect(summary.gates.slideSwitch.passed).toBe(false);
    expect(summary.failures).toEqual([
      {
        phase: "first-readable",
        message: "Invalid performance sample at index 1: Infinity.",
      },
      {
        phase: "slide-switch",
        message: "Invalid performance sample at index 1: NaN.",
      },
    ]);

    const serialized = JSON.stringify(summary);
    expect(serialized).toContain('"value":"Infinity"');
    expect(serialized).toContain('"value":"NaN"');
  });

  it("fails gates and records missing expected observations", () => {
    const summary = summarizePerformance(
      performanceInput({
        firstReadableMs: [1_000, 2_000],
        slideSwitchMs: [40],
      }),
    );

    expect(summary.firstReadable.samples).toEqual([1_000, 2_000]);
    expect(summary.firstReadable.expectedSampleCount).toBe(3);
    expect(summary.firstReadable.missingSampleCount).toBe(1);
    expect(summary.slideSwitch.expectedSampleCount).toBe(3);
    expect(summary.slideSwitch.missingSampleCount).toBe(2);
    expect(summary.gates.firstReadable.passed).toBe(false);
    expect(summary.gates.slideSwitch.passed).toBe(false);
    expect(summary.failures).toEqual([
      {
        phase: "first-readable",
        message: "Expected 3 performance samples but received 2; 1 missing.",
      },
      {
        phase: "slide-switch",
        message: "Expected 3 performance samples but received 1; 2 missing.",
      },
    ]);
  });

  it("calculates p50 from finite samples and snapshots raw samples and failures", () => {
    const firstReadableMs = [30, 10, 20];
    const failures: PerformanceFailure[] = [
      { phase: "warm-open", message: "renderer did not become ready", sampleIndex: 2 },
    ];
    const summary = summarizePerformance(
      performanceInput({
        firstReadableMs,
        slideSwitchMs: [90, 90, 90],
        failures,
      }),
    );

    firstReadableMs.push(40);
    failures.push({ phase: "cleanup", message: "late mutation" });

    expect(summary.firstReadable).toEqual({
      samples: [30, 10, 20],
      invalidSamples: [],
      expectedSampleCount: 3,
      missingSampleCount: 0,
      p50: 20,
      p95: 30,
    });
    expect(summary.failures).toEqual([
      { phase: "warm-open", message: "renderer did not become ready", sampleIndex: 2 },
    ]);
    expect(summary.gates.overallPassed).toBe(false);
  });

  it("renders deterministic human-readable evidence including raw observations", () => {
    const summary = summarizePerformance(
      performanceInput({
        resources: {
          memory: [
            { label: "after ready", heapUsedBytes: 1_024, rssBytes: 2_048 },
          ],
          cancellation: [
            { elapsedMs: 75.25, detached: true, viewerAbsent: true },
          ],
          cleanup: [
            {
              elapsedMs: 2_000,
              unfinishedWorkStopped: true,
              resourcesReleased: false,
            },
          ],
          bundleBytes: 123_456,
          observationWindowMs: 2_000,
        },
        failures: [
          {
            phase: "warm-open",
            message: "renderer did not become ready",
            sampleIndex: 2,
          },
        ],
      }),
    );

    const markdown = renderPerformanceMarkdown(summary);

    expect(renderPerformanceMarkdown(summary)).toBe(markdown);
    expect(markdown).toContain("Overall result: **FAIL**");
    expect(markdown).toContain(
      "| First readable slide | 2,000.000 ms | 3,100.000 ms | <= 3,000.000 ms | FAIL |",
    );
    expect(markdown).toContain(
      "| Rendered page switch | 80.000 ms | 120.000 ms | <= 100.000 ms | FAIL |",
    );
    expect(markdown).toContain(
      "- First readable slide (ms): `1000, 2000, 3100`",
    );
    expect(markdown).toContain(
      "- `warm-open` sample 2: renderer did not become ready",
    );
    expect(markdown).toContain("| after ready | 1,024 | 2,048 |");
    expect(markdown).toContain("| 1 | 75.250 ms | yes | yes |");
    expect(markdown).toContain("| 1 | 2,000.000 ms | yes | no |");
    expect(markdown.endsWith("\n")).toBe(true);
  });
});
