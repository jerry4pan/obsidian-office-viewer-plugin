export const REQUIRED_CORPUS_FEATURES = [
  "text",
  "fonts",
  "images",
  "transparency",
  "shapes",
  "theme",
  "master",
  "wide-layout",
  "standard-layout",
  "table",
  "chart",
  "group",
  "rotation",
  "complex-drawing",
] as const;

export type CorpusFeature = (typeof REQUIRED_CORPUS_FEATURES)[number];
export type CompatibilityClassification = "supported" | "degraded" | "failed";

export interface CorpusFixture {
  readonly id: string;
  readonly title: string;
  readonly vaultPath: `compatibility/${string}.pptx`;
  readonly features: readonly CorpusFeature[];
  readonly mainContentMarkers: readonly string[];
  readonly visualAssertions: {
    readonly containedLayout: true;
    readonly healthyImages: number;
  };
  readonly provenance: {
    readonly license: "MIT";
    readonly generator: "scripts/generate-compatibility-fixtures.mjs";
  };
  readonly review: {
    readonly classification: CompatibilityClassification;
    readonly reason: string;
  };
}

export const CORPUS_ENVIRONMENT = {
  viewport: { width: 1440, height: 1000 },
  theme: "light",
  zoom: 1,
  fontFamily: "Arial",
  readabilityGate: 0.8,
  maxVisualDiffRatio: 0.005,
} as const;

export const CORPUS_EXPECTED_GATE = false;

const provenance = {
  license: "MIT",
  generator: "scripts/generate-compatibility-fixtures.mjs",
} as const;

export const corpusManifest: readonly CorpusFixture[] = [
  {
    id: "text-theme-wide",
    title: "Text, fonts, theme and master on 16:9",
    vaultPath: "compatibility/text-theme-wide.pptx",
    features: ["text", "fonts", "theme", "master", "wide-layout"],
    mainContentMarkers: ["Quarterly Brief", "Revenue grew 24%", "Theme footer"],
    visualAssertions: { containedLayout: true, healthyImages: 0 },
    provenance,
    review: {
      classification: "degraded",
      reason: "Body text is readable, but the master footer falls below the visible slide boundary.",
    },
  },
  {
    id: "images-transparency-standard",
    title: "Images and transparency on 4:3",
    vaultPath: "compatibility/images-transparency-standard.pptx",
    features: ["images", "transparency", "shapes", "standard-layout"],
    mainContentMarkers: ["Layered Product", "50% transparency", "Embedded SVG"],
    visualAssertions: { containedLayout: true, healthyImages: 1 },
    provenance,
    review: {
      classification: "degraded",
      reason: "Embedded SVG is broken and the translucent overlay text is clipped at the right edge.",
    },
  },
  {
    id: "tables-charts",
    title: "Business table and chart",
    vaultPath: "compatibility/tables-charts.pptx",
    features: ["table", "chart", "text"],
    mainContentMarkers: ["Regional performance", "North", "South", "FY26 plan"],
    visualAssertions: { containedLayout: true, healthyImages: 0 },
    provenance,
    review: {
      classification: "degraded",
      reason: "Table content is readable, but the chart extends beyond the slide and is clipped.",
    },
  },
  {
    id: "grouped-rotated",
    title: "Native grouped and rotated shapes",
    vaultPath: "compatibility/grouped-rotated.pptx",
    features: ["group", "rotation", "shapes", "text"],
    mainContentMarkers: ["Grouped workflow", "Discover", "Decide", "Deliver"],
    visualAssertions: { containedLayout: true, healthyImages: 0 },
    provenance,
    review: {
      classification: "degraded",
      reason: "Rotation renders, but the third member of the native DrawingML group is clipped.",
    },
  },
  {
    id: "complex-drawing",
    title: "Complex vector drawing fallback",
    vaultPath: "compatibility/complex-drawing.pptx",
    features: ["complex-drawing", "images", "text"],
    mainContentMarkers: ["Architecture map", "Client", "Plugin", "Renderer"],
    visualAssertions: { containedLayout: true, healthyImages: 1 },
    provenance,
    review: {
      classification: "degraded",
      reason: "The complex SVG drawing is replaced by a broken-image placeholder.",
    },
  },
] as const;
