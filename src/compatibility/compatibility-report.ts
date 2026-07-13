export type CompatibilityClassification = "supported" | "degraded" | "failed";

export interface CompatibilityObservation {
  readonly fixtureId: string;
  readonly title: string;
  readonly expectedMarkers: readonly string[];
  readonly visibleMarkers: readonly string[];
  readonly reviewClassification: CompatibilityClassification;
  readonly reviewReason: string;
  readonly visualDiffRatio: number;
  readonly error?: string;
}

export interface FixtureCompatibilityResult extends CompatibilityObservation {
  readonly classification: CompatibilityClassification;
  readonly readableMarkers: number;
  readonly totalMarkers: number;
}

export interface CompatibilitySummary {
  readonly threshold: number;
  readonly readableMarkers: number;
  readonly totalMarkers: number;
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
    const expected = new Set(observation.expectedMarkers);
    const readableMarkers = new Set(
      observation.visibleMarkers.filter((marker) => expected.has(marker)),
    ).size;
    const totalMarkers = expected.size;
    let classification = observation.reviewClassification;
    if (observation.error || (totalMarkers > 0 && readableMarkers === 0)) {
      classification = "failed";
    } else if (
      classification === "supported" &&
      readableMarkers < totalMarkers
    ) {
      classification = "degraded";
    }

    return {
      ...observation,
      classification,
      readableMarkers,
      totalMarkers,
    };
  });

  const readableMarkers = fixtures.reduce(
    (total, fixture) => total + fixture.readableMarkers,
    0,
  );
  const totalMarkers = fixtures.reduce(
    (total, fixture) => total + fixture.totalMarkers,
    0,
  );
  const readableRatio = totalMarkers === 0 ? 0 : readableMarkers / totalMarkers;
  const counts = { supported: 0, degraded: 0, failed: 0 };
  for (const fixture of fixtures) counts[fixture.classification] += 1;

  return {
    threshold,
    readableMarkers,
    totalMarkers,
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
    `Readable main content: **${summary.readableMarkers} / ${summary.totalMarkers} (${percent(summary.readableRatio)})**.`,
    `Classifications: ${summary.counts.supported} supported, ${summary.counts.degraded} degraded, ${summary.counts.failed} failed.`,
    "",
    "| Fixture | Classification | Readable markers | Visual diff |",
    "| --- | --- | ---: | ---: |",
  ];

  for (const fixture of summary.fixtures) {
    lines.push(
      `| ${fixture.fixtureId} | ${fixture.classification} | ${fixture.readableMarkers} / ${fixture.totalMarkers} | ${(fixture.visualDiffRatio * 100).toFixed(3)}% |`,
    );
  }
  lines.push("", "## Review notes", "");
  for (const fixture of summary.fixtures) {
    lines.push(`- **${fixture.fixtureId}:** ${fixture.reviewReason}`);
  }
  return `${lines.join("\n")}\n`;
}
