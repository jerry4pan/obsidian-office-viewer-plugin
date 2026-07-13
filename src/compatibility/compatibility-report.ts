export type CompatibilityClassification = "supported" | "degraded" | "failed";

export interface CompatibilityObservation {
  readonly fixtureId: string;
  readonly title: string;
  readonly expectedContent: readonly string[];
  readonly readableContent: readonly string[];
  readonly reviewClassification: CompatibilityClassification;
  readonly reviewReason: string;
  readonly visualDiffRatio: number;
  readonly error?: string;
}

export interface FixtureCompatibilityResult extends CompatibilityObservation {
  readonly classification: CompatibilityClassification;
  readonly readableContentCount: number;
  readonly totalContentCount: number;
}

export interface CompatibilitySummary {
  readonly threshold: number;
  readonly readableContentCount: number;
  readonly totalContentCount: number;
  readonly readableRatio: number;
  readonly gatePassed: boolean;
  readonly counts: Readonly<Record<CompatibilityClassification, number>>;
  readonly fixtures: readonly FixtureCompatibilityResult[];
}

export function summarizeCompatibility(
  observations: readonly CompatibilityObservation[],
  threshold: number,
): CompatibilitySummary {
  if (threshold < 0 || threshold > 1) {
    throw new RangeError("compatibility threshold must be between 0 and 1");
  }

  const fixtures = observations.map((observation) => {
    const expected = new Set(observation.expectedContent);
    const readableContentCount = new Set(
      observation.readableContent.filter((item) => expected.has(item)),
    ).size;
    const totalContentCount = expected.size;
    let classification = observation.reviewClassification;
    if (
      observation.error ||
      (totalContentCount > 0 && readableContentCount === 0)
    ) {
      classification = "failed";
    } else if (
      classification === "supported" &&
      readableContentCount < totalContentCount
    ) {
      classification = "degraded";
    }

    return {
      ...observation,
      classification,
      readableContentCount,
      totalContentCount,
    };
  });

  const readableContentCount = fixtures.reduce(
    (total, fixture) => total + fixture.readableContentCount,
    0,
  );
  const totalContentCount = fixtures.reduce(
    (total, fixture) => total + fixture.totalContentCount,
    0,
  );
  const readableRatio =
    totalContentCount === 0 ? 0 : readableContentCount / totalContentCount;
  const counts = { supported: 0, degraded: 0, failed: 0 };
  for (const fixture of fixtures) counts[fixture.classification] += 1;

  return {
    threshold,
    readableContentCount,
    totalContentCount,
    readableRatio,
    gatePassed: readableRatio >= threshold,
    counts,
    fixtures,
  };
}

export function renderCompatibilityMarkdown(
  summary: CompatibilitySummary,
): string {
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const lines = [
    "# PPTX compatibility run",
    "",
    `M0 gate: **${summary.gatePassed ? "PASS" : "FAIL"}** (required ${percent(summary.threshold)}).`,
    `Readable main content: **${summary.readableContentCount} / ${summary.totalContentCount} (${percent(summary.readableRatio)})**.`,
    `Classifications: ${summary.counts.supported} supported, ${summary.counts.degraded} degraded, ${summary.counts.failed} failed.`,
    "",
    "| Fixture | Classification | Readable content | Visual diff |",
    "| --- | --- | ---: | ---: |",
  ];

  for (const fixture of summary.fixtures) {
    lines.push(
      `| ${fixture.fixtureId} | ${fixture.classification} | ${fixture.readableContentCount} / ${fixture.totalContentCount} | ${(fixture.visualDiffRatio * 100).toFixed(3)}% |`,
    );
  }
  lines.push("", "## Review notes", "");
  for (const fixture of summary.fixtures) {
    lines.push(`- **${fixture.fixtureId}:** ${fixture.reviewReason}`);
  }
  return `${lines.join("\n")}\n`;
}
