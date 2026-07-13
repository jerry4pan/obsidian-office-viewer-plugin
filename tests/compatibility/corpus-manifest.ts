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
    provenance,
    review: {
      classification: "supported",
      reason: "Initial baseline requires all themed text and master content to remain readable.",
    },
  },
  {
    id: "images-transparency-standard",
    title: "Images and transparency on 4:3",
    vaultPath: "compatibility/images-transparency-standard.pptx",
    features: ["images", "transparency", "shapes", "standard-layout"],
    mainContentMarkers: ["Layered Product", "50% transparency", "Embedded SVG"],
    provenance,
    review: {
      classification: "supported",
      reason: "Initial baseline requires the embedded image and translucent overlay to stay visible.",
    },
  },
  {
    id: "tables-charts",
    title: "Business table and chart",
    vaultPath: "compatibility/tables-charts.pptx",
    features: ["table", "chart", "text"],
    mainContentMarkers: ["Regional performance", "North", "South", "FY26 plan"],
    provenance,
    review: {
      classification: "supported",
      reason: "Initial baseline requires table labels and the chart context to remain readable.",
    },
  },
  {
    id: "grouped-rotated",
    title: "Native grouped and rotated shapes",
    vaultPath: "compatibility/grouped-rotated.pptx",
    features: ["group", "rotation", "shapes", "text"],
    mainContentMarkers: ["Grouped workflow", "Discover", "Decide", "Deliver"],
    provenance,
    review: {
      classification: "supported",
      reason: "Initial baseline requires the native group labels and rotated callout to render.",
    },
  },
  {
    id: "complex-drawing",
    title: "Complex vector drawing fallback",
    vaultPath: "compatibility/complex-drawing.pptx",
    features: ["complex-drawing", "images", "text"],
    mainContentMarkers: ["Architecture map", "Client", "Plugin", "Renderer"],
    provenance,
    review: {
      classification: "supported",
      reason: "Initial baseline requires the complex vector drawing and its labels to remain visible.",
    },
  },
] as const;
