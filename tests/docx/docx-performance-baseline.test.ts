import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const baseline = JSON.parse(
  readFileSync(
    "tests/performance/baselines/docx-preview-0.3.6.json",
    "utf8",
  ),
) as {
  bundleBytes: number;
  protocol: Record<string, number>;
  fixtures: Record<string, string>;
  samples: Record<string, number[]>;
  p95: Record<string, number>;
  stress: { bodyDomElements: number; heapDeltaBytes: number };
  verdict: string;
};

function sha256(relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(path.resolve(relativePath)))
    .digest("hex");
}

function p95(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1]!;
}

describe("committed installed DOCX performance baseline", () => {
  it("anchors the exact fixtures and recomputes every p95 verdict", () => {
    expect(baseline.fixtures.representativeSha256).toBe(
      sha256("tests/fixtures/docx-exploration/performance-representative-1000-paragraphs.docx"),
    );
    expect(baseline.fixtures.stressSha256).toBe(
      sha256("tests/fixtures/docx-exploration/performance-stress-5000-paragraphs.docx"),
    );
    expect(p95(baseline.samples.firstReadableMs!)).toBe(
      baseline.p95.firstReadableMs,
    );
    expect(p95(baseline.samples.searchReadyMs!)).toBe(
      baseline.p95.searchReadyMs,
    );
    expect(p95(baseline.samples.queryMs!)).toBe(baseline.p95.queryMs);
    expect(p95(baseline.samples.cleanupMs!)).toBe(baseline.p95.cleanupMs);
    expect(baseline.p95.firstReadableMs).toBeLessThanOrEqual(
      baseline.protocol.firstReadableBudgetMs!,
    );
    expect(baseline.p95.searchReadyMs).toBeLessThanOrEqual(
      baseline.protocol.searchReadyBudgetMs!,
    );
    expect(baseline.p95.queryMs).toBeLessThanOrEqual(
      baseline.protocol.queryBudgetMs!,
    );
    expect(baseline.p95.cleanupMs).toBeLessThanOrEqual(
      baseline.protocol.cleanupBudgetMs!,
    );
    expect(baseline.stress.bodyDomElements).toBeLessThanOrEqual(
      baseline.protocol.stressBodyDomElementBudget!,
    );
    expect(baseline.stress.heapDeltaBytes).toBeLessThanOrEqual(
      baseline.protocol.stressHeapDeltaBudgetBytes!,
    );
    expect(baseline.verdict).toBe("pass");
  });

  it("keeps the production bundle within five percent of the accepted baseline", () => {
    expect(statSync("main.js").size).toBeLessThanOrEqual(
      Math.ceil(baseline.bundleBytes * 1.05),
    );
  });
});
