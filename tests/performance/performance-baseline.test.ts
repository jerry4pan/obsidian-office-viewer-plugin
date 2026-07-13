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
const expectedOutcome =
  renderer.candidate.id === "pptx-preview" ? "expected-open-failure" : "pass";

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
      expectedOutcome,
      renderer.candidate.label,
    );

    expect(baseline.rawOpens).toHaveLength(13);
    expect(baseline.rawMemoryAttempts).toHaveLength(10);
    expect(baseline.rawCancellationAttempts).toHaveLength(5);
    expect(baseline.resources.memory).toHaveLength(
      expectedOutcome === "pass" ? 30 : 0,
    );
    expect(baseline.resources.cancellation).toHaveLength(5);
    expect(baseline.resources.cleanup).toHaveLength(
      expectedOutcome === "pass" ? 15 : 5,
    );
  });

  it.runIf(expectedOutcome === "pass")(
    "rejects a tampered raw measurement instead of trusting stored summaries",
    () => {
      const tampered = cloneBaseline() as {
        rawMemoryAttempts: Array<{
          peak: { heapUsedBytes: number };
        }>;
      };
      tampered.rawMemoryAttempts[0]!.peak.heapUsedBytes += 1;

      expect(() =>
        validateInstalledPerformanceArtifact(
          tampered,
          actualBundleBytes(),
          expectedOutcome,
          renderer.candidate.label,
        ),
      ).toThrow(/selected peak snapshot/);
    },
  );

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
      validateInstalledPerformanceArtifact(
        tampered,
        actualBundleBytes(),
        expectedOutcome,
        renderer.candidate.label,
      ),
    ).toThrow(/selected in-flight snapshot/);
  });

  it("rejects selected snapshots that are not the corresponding raw snapshots", () => {
    const tampered = cloneBaseline() as {
      rawMemoryAttempts: Array<{ preOpen: { heapUsedBytes: number } }>;
    };
    tampered.rawMemoryAttempts[0]!.preOpen.heapUsedBytes += 1;

    expect(() =>
      validateInstalledPerformanceArtifact(
        tampered,
        actualBundleBytes(),
        expectedOutcome,
        renderer.candidate.label,
      ),
    ).toThrow(/selected pre-open snapshot/);
  });

  it("rejects an incorrect attempt kind, index, or status sequence", () => {
    const tampered = cloneBaseline() as {
      rawOpens: Array<{ kind: string; sampleIndex: number; status: string }>;
    };
    tampered.rawOpens[0]!.kind = "warmup";
    tampered.rawOpens[0]!.sampleIndex = 2;
    tampered.rawOpens[0]!.status = "pending";

    expect(() =>
      validateInstalledPerformanceArtifact(
        tampered,
        actualBundleBytes(),
        expectedOutcome,
        renderer.candidate.label,
      ),
    ).toThrow(/exact cold, warmup, measured sequence/);
  });

  it.runIf(expectedOutcome === "expected-open-failure")(
    "rejects a failed-open baseline whose raw status was softened",
    () => {
      const tampered = cloneBaseline() as {
        rawOpens: Array<{ status: string }>;
      };
      tampered.rawOpens[0]!.status = "passed";

      expect(() =>
        validateInstalledPerformanceArtifact(
          tampered,
          actualBundleBytes(),
          expectedOutcome,
          renderer.candidate.label,
        ),
      ).toThrow(/complete expected open-failure evidence/);
    },
  );

  it("rejects evidence relabelled as a different renderer", () => {
    const tampered = cloneBaseline() as {
      environment: { renderer: string };
    };
    tampered.environment.renderer = "different-renderer@9.9.9";

    expect(() =>
      validateInstalledPerformanceArtifact(
        tampered,
        actualBundleBytes(),
        expectedOutcome,
        renderer.candidate.label,
      ),
    ).toThrow(/environment\.renderer must equal selected candidate/);
  });

  it("rejects a baseline recorded for a different production bundle", () => {
    expect(() =>
      validateInstalledPerformanceArtifact(
        baselineValue,
        actualBundleBytes() + 1,
        expectedOutcome,
        renderer.candidate.label,
      ),
    ).toThrow(/bundleBytes must equal actual production main.js size/);
  });

  it("keeps the committed Markdown byte-for-byte reproducible", () => {
    const baseline = validateInstalledPerformanceArtifact(
      baselineValue,
      actualBundleBytes(),
      expectedOutcome,
      renderer.candidate.label,
    );
    expect(readFileSync(reportPath, "utf8")).toBe(
      renderInstalledPerformanceMarkdown(baseline),
    );
  });
});
