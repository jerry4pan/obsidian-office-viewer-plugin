import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateInstalledPerformanceArtifact } from "./installed-performance-artifact";
import { renderInstalledPerformanceMarkdown } from "./installed-performance-markdown";

const baselinePath = path.resolve(
  "tests/performance/baselines/aiden-pptx-renderer-1.2.4.json",
);
const reportPath = path.resolve(
  "docs/performance/aiden-pptx-renderer-1.2.4.md",
);
const baselineSource = readFileSync(baselinePath, "utf8");
const baselineValue: unknown = JSON.parse(baselineSource);

function cloneBaseline(): unknown {
  return JSON.parse(baselineSource) as unknown;
}

describe("committed installed PPTX performance baseline", () => {
  it("validates the full schema and recomputes every derived value from raw evidence", () => {
    const baseline = validateInstalledPerformanceArtifact(baselineValue);

    expect(baseline.rawOpens).toHaveLength(13);
    expect(baseline.rawMemoryAttempts).toHaveLength(10);
    expect(baseline.rawCancellationAttempts).toHaveLength(5);
    expect(baseline.resources.memory).toHaveLength(30);
    expect(baseline.resources.cancellation).toHaveLength(5);
    expect(baseline.resources.cleanup).toHaveLength(15);
  });

  it("rejects a tampered raw measurement instead of trusting stored summaries", () => {
    const tampered = cloneBaseline() as {
      rawMemoryAttempts: Array<{
        peak: { heapUsedBytes: number };
      }>;
    };
    tampered.rawMemoryAttempts[0]!.peak.heapUsedBytes += 1;

    expect(() => validateInstalledPerformanceArtifact(tampered)).toThrow(
      /recomputed from raw evidence/,
    );
  });

  it("rejects a missing in-flight proof snapshot", () => {
    const tampered = cloneBaseline() as {
      rawCancellationAttempts: Array<{
        snapshots: Array<{ lifecyclePhase: string }>;
      }>;
    };
    tampered.rawCancellationAttempts[0]!.snapshots =
      tampered.rawCancellationAttempts[0]!.snapshots.filter(
        ({ lifecyclePhase }) => lifecyclePhase !== "adapter-opening",
      );

    expect(() => validateInstalledPerformanceArtifact(tampered)).toThrow(
      /prove strict in-flight resource return/,
    );
  });

  it("keeps the committed Markdown byte-for-byte reproducible", () => {
    const baseline = validateInstalledPerformanceArtifact(baselineValue);
    expect(readFileSync(reportPath, "utf8")).toBe(
      renderInstalledPerformanceMarkdown(baseline),
    );
  });
});
