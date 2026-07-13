export type PerformanceFixtureRole = "representative" | "stress";
export type PerformanceFixtureFeature =
  | "text"
  | "shapes"
  | "table"
  | "image";

export interface PerformanceFixture {
  readonly id: string;
  readonly title: string;
  readonly role: PerformanceFixtureRole;
  readonly fixturePath: `tests/fixtures/performance/${string}.pptx`;
  readonly vaultPath: `performance/${string}.pptx`;
  readonly slideCount: number;
  readonly features: readonly PerformanceFixtureFeature[];
  readonly maxSlideCount?: number;
  readonly maxBytes?: number;
  readonly provenance: {
    readonly license: "MIT";
    readonly generator: "scripts/generate-performance-fixtures.mjs";
  };
}

const provenance = {
  license: "MIT",
  generator: "scripts/generate-performance-fixtures.mjs",
} as const;

export const performanceFixtureManifest: readonly PerformanceFixture[] = [
  {
    id: "representative-12-slides",
    title: "Representative 12-slide benchmark deck",
    role: "representative",
    fixturePath:
      "tests/fixtures/performance/representative-12-slides.pptx",
    vaultPath: "performance/representative-12-slides.pptx",
    slideCount: 12,
    features: ["text", "shapes", "table", "image"],
    maxSlideCount: 50,
    maxBytes: 20 * 1024 * 1024,
    provenance,
  },
  {
    id: "stress-200-slides",
    title: "200-slide cancellation and memory stress deck",
    role: "stress",
    fixturePath: "tests/fixtures/performance/stress-200-slides.pptx",
    vaultPath: "performance/stress-200-slides.pptx",
    slideCount: 200,
    features: ["text", "shapes"],
    provenance,
  },
] as const;
