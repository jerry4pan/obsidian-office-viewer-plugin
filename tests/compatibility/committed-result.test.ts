import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  renderCompatibilityMarkdown,
  summarizeCompatibility,
  type CompatibilityObservation,
} from "../../src/compatibility/compatibility-report";
import {
  CORPUS_ENVIRONMENT,
  corpusManifest,
  getCandidateBaselineApproval,
} from "./corpus-manifest";
import { fileSha256 } from "./hash";

interface CommittedCompatibilityResult {
  readonly candidate: "pptx-preview";
  readonly environment: {
    readonly renderer: "pptx-preview@1.0.7";
  };
  readonly threshold: number;
  readonly readableContentCount: number;
  readonly totalContentCount: number;
  readonly readableRatio: number;
  readonly gatePassed: boolean;
  readonly counts: {
    readonly supported: number;
    readonly degraded: number;
    readonly failed: number;
  };
  readonly fixtures: readonly CompatibilityObservation[];
}

const resultPath = path.resolve(
  "tests/compatibility/results/pptx-preview-1.0.7.json",
);
const reportPath = path.resolve(
  "tests/compatibility/results/pptx-preview-1.0.7.md",
);
const result = JSON.parse(
  readFileSync(resultPath, "utf8"),
) as CommittedCompatibilityResult;

describe("committed pptx-preview compatibility result", () => {
  it("recomputes the exact-boundary M0 result from fixture observations", () => {
    const summary = summarizeCompatibility(
      result.fixtures,
      CORPUS_ENVIRONMENT.readabilityGate,
    );

    expect(summary).toEqual({
      threshold: result.threshold,
      readableContentCount: result.readableContentCount,
      totalContentCount: result.totalContentCount,
      readableRatio: result.readableRatio,
      gatePassed: result.gatePassed,
      counts: result.counts,
      fixtures: result.fixtures,
    });
    expect(result.candidate).toBe("pptx-preview");
    expect(result.environment.renderer).toBe("pptx-preview@1.0.7");
    expect(result.readableContentCount).toBe(16);
    expect(result.totalContentCount).toBe(20);
    expect(result.readableRatio).toBe(0.8);
    expect(result.gatePassed).toBe(true);
    expect(result.counts).toEqual({ supported: 1, degraded: 4, failed: 0 });
  });

  it("binds every approved screenshot to the reviewed candidate hash", async () => {
    for (const fixture of corpusManifest) {
      const approval = getCandidateBaselineApproval(fixture, "pptx-preview");
      const baselinePath = path.resolve(
        "tests/compatibility/baselines/pptx-preview-1.0.7",
        `${fixture.id}.png`,
      );
      expect(await fileSha256(baselinePath), fixture.id).toBe(approval.sha256);
    }
  });

  it("keeps the generated compatibility summary byte-for-byte reproducible", () => {
    const summary = summarizeCompatibility(
      result.fixtures,
      CORPUS_ENVIRONMENT.readabilityGate,
    );
    expect(readFileSync(reportPath, "utf8")).toBe(
      renderCompatibilityMarkdown(summary),
    );
  });
});
