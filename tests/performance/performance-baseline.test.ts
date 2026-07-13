import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateInstalledPerformanceArtifact } from "./installed-performance-artifact";
import { renderInstalledPerformanceMarkdown } from "./installed-performance-markdown";
import { activeRendererAcceptanceConfig } from "../support/renderer-candidate";

const renderer = activeRendererAcceptanceConfig();
const baselinePath = path.resolve(
  "tests/performance/baselines",
  `${renderer.candidate.evidenceId}.json`,
);
const reportPath = path.resolve(
  "docs/performance",
  `${renderer.candidate.evidenceId}.md`,
);
const baselineSource = readFileSync(baselinePath, "utf8");
const baselineValue: unknown = JSON.parse(baselineSource);

function actualBundleBytes(): number {
  return statSync(path.resolve("main.js")).size;
}

function cloneBaseline(): unknown {
  return JSON.parse(baselineSource) as unknown;
}

describe("committed installed PPTX performance baseline", () => {
  it("validates the full schema and recomputes every derived value from raw evidence", () => {
    const baseline = validateInstalledPerformanceArtifact(
      baselineValue,
      actualBundleBytes(),
    );

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

    expect(() =>
      validateInstalledPerformanceArtifact(tampered, actualBundleBytes()),
    ).toThrow(
      /selected peak snapshot/,
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

    expect(() =>
      validateInstalledPerformanceArtifact(tampered, actualBundleBytes()),
    ).toThrow(
      /selected in-flight snapshot/,
    );
  });

  it("rejects selected snapshots that are not the corresponding raw snapshots", () => {
    const tampered = cloneBaseline() as {
      rawMemoryAttempts: Array<{ preOpen: { heapUsedBytes: number } }>;
    };
    tampered.rawMemoryAttempts[0]!.preOpen.heapUsedBytes += 1;

    expect(() =>
      validateInstalledPerformanceArtifact(tampered, actualBundleBytes()),
    ).toThrow(/selected pre-open snapshot/);
  });

  it("rejects an incorrect attempt kind, index, or status sequence", () => {
    const tampered = cloneBaseline() as {
      rawOpens: Array<{ kind: string; sampleIndex: number; status: string }>;
    };
    tampered.rawOpens[0]!.kind = "warmup";
    tampered.rawOpens[0]!.sampleIndex = 2;
    tampered.rawOpens[0]!.status = "failed";

    expect(() =>
      validateInstalledPerformanceArtifact(tampered, actualBundleBytes()),
    ).toThrow(/exact cold, warmup, measured sequence/);
  });

  it("rejects a baseline recorded for a different production bundle", () => {
    expect(() =>
      validateInstalledPerformanceArtifact(baselineValue, actualBundleBytes() + 1),
    ).toThrow(/bundleBytes must equal actual production main.js size/);
  });

  it("keeps the committed Markdown byte-for-byte reproducible", () => {
    const baseline = validateInstalledPerformanceArtifact(
      baselineValue,
      actualBundleBytes(),
    );
    expect(readFileSync(reportPath, "utf8")).toBe(
      renderInstalledPerformanceMarkdown(baseline),
    );
  });
});
