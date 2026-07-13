import { describe, expect, it } from "vitest";
import {
  renderCompatibilityMarkdown,
  summarizeCompatibility,
  type CompatibilityObservation,
} from "../../src/compatibility/compatibility-report";

const observations: CompatibilityObservation[] = [
  {
    fixtureId: "supported",
    title: "Supported slide",
    expectedContent: ["A", "B"],
    readableContent: ["A", "B"],
    reviewClassification: "supported",
    reviewReason: "All representative content is visually intact.",
    visualDiffRatio: 0,
  },
  {
    fixtureId: "partial",
    title: "Partial slide",
    expectedContent: ["C", "D", "E"],
    readableContent: ["C", "D"],
    reviewClassification: "supported",
    reviewReason: "One semantic marker is missing from the rendered slide.",
    visualDiffRatio: 0.002,
  },
];

describe("compatibility report", () => {
  it("calculates readable content and downgrades partial output", () => {
    const summary = summarizeCompatibility(observations, 0.8);

    expect(summary.readableContentCount).toBe(4);
    expect(summary.totalContentCount).toBe(5);
    expect(summary.readableRatio).toBe(0.8);
    expect(summary.gatePassed).toBe(true);
    expect(summary.counts).toEqual({ supported: 1, degraded: 1, failed: 0 });
    expect(summary.fixtures[1]?.classification).toBe("degraded");
  });

  it("fails the gate below the exact 80 percent boundary", () => {
    const summary = summarizeCompatibility(
      [{ ...observations[1]!, readableContent: ["C"] }],
      0.8,
    );

    expect(summary.readableRatio).toBeCloseTo(1 / 3);
    expect(summary.gatePassed).toBe(false);
  });

  it("renders a deterministic human-readable summary", () => {
    const markdown = renderCompatibilityMarkdown(
      summarizeCompatibility(observations, 0.8),
    );

    expect(markdown).toContain("M0 gate: **PASS**");
    expect(markdown).toContain("Readable main content: **4 / 5 (80.0%)**");
    expect(markdown).toContain("| partial | degraded | 2 / 3 | 0.200% |");
  });
});
