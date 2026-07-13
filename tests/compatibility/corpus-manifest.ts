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
export type MainContentCheck =
  | { readonly kind: "text"; readonly label: string; readonly text: string }
  | {
      readonly kind: "font";
      readonly label: string;
      readonly text: string;
      readonly family: string;
      readonly expectedAvailable: boolean;
    }
  | { readonly kind: "image"; readonly label: string }
  | {
      readonly kind: "contained";
      readonly label: string;
      readonly selector: "canvas";
    };

export interface CorpusFixture {
  readonly id: string;
  readonly title: string;
  readonly vaultPath: `compatibility/${string}.pptx`;
  readonly features: readonly CorpusFeature[];
  readonly mainContentChecks: readonly MainContentCheck[];
  readonly provenance: {
    readonly license: "MIT";
    readonly generator: "scripts/generate-compatibility-fixtures.mjs";
  };
  readonly review: {
    readonly classification: CompatibilityClassification;
    readonly reason: string;
  };
  readonly baselineApproval: {
    readonly sha256: string;
    readonly reason: string;
    readonly approvedOn: "2026-07-13";
  };
}

export const CORPUS_ENVIRONMENT = {
  viewport: { width: 1024, height: 800 },
  theme: "light",
  zoom: 1,
  fontFamily: "Arial",
  fontSamples: ["Arial", "Times New Roman", "Definitely Missing Font"],
  readabilityGate: 0.8,
  maxVisualDiffRatio: 0,
} as const;

export const CORPUS_EXPECTED_GATE = true;

const provenance = {
  license: "MIT",
  generator: "scripts/generate-compatibility-fixtures.mjs",
} as const;

const text = (value: string): MainContentCheck => ({
  kind: "text",
  label: value,
  text: value,
});
const image = (label: string): MainContentCheck => ({ kind: "image", label });
const font = (
  textValue: string,
  family: string,
  expectedAvailable: boolean,
): MainContentCheck => ({
  kind: "font",
  label: `${textValue} [${family}]`,
  text: textValue,
  family,
  expectedAvailable,
});
const contained = (label: string): MainContentCheck => ({
  kind: "contained",
  label,
  selector: "canvas",
});

export const corpusManifest: readonly CorpusFixture[] = [
  {
    id: "text-theme-wide",
    title: "Text, fonts, theme and master on 16:9",
    vaultPath: "compatibility/text-theme-wide.pptx",
    features: ["text", "fonts", "theme", "master", "wide-layout"],
    mainContentChecks: [
      font("Quarterly Brief", "Arial", true),
      text("Revenue grew 24%"),
      text("Theme footer"),
      font("Times New Roman sample", "Times New Roman", true),
      font("Missing font fallback sample", "Definitely Missing Font", false),
    ],
    provenance,
    review: {
      classification: "supported",
      reason: "Body text, both font samples, fallback text, and the master footer are readable.",
    },
    baselineApproval: {
      sha256: "4b1cdb952c18629085e78e6808b1402c5accef8d13bb509379bb0eedb9a80d83",
      reason: "Approved initial evidence for text, theme, master and font fallback coverage.",
      approvedOn: "2026-07-13",
    },
  },
  {
    id: "images-transparency-standard",
    title: "Images and transparency on 4:3",
    vaultPath: "compatibility/images-transparency-standard.pptx",
    features: ["images", "transparency", "shapes", "standard-layout"],
    mainContentChecks: [
      text("Layered Product"),
      text("50% transparency"),
      text("Embedded SVG"),
      image("Product illustration"),
    ],
    provenance,
    review: {
      classification: "degraded",
      reason: "Transparency and labels render, but the embedded SVG remains a broken image.",
    },
    baselineApproval: {
      sha256: "1b41462069fe42eb42336f674df00aeb66bb6865edaa45246201b94d074d6932",
      reason: "Approved evidence records working transparency and the broken embedded SVG.",
      approvedOn: "2026-07-13",
    },
  },
  {
    id: "tables-charts",
    title: "Business table and chart",
    vaultPath: "compatibility/tables-charts.pptx",
    features: ["table", "chart", "text"],
    mainContentChecks: [
      text("Regional performance"),
      text("North"),
      text("South"),
      text("FY26 plan"),
      contained("Chart fully visible"),
    ],
    provenance,
    review: {
      classification: "supported",
      reason: "The table, axes, labels, title, and both chart bars are fully visible.",
    },
    baselineApproval: {
      sha256: "74e7c270844024fead221bb11e747d55375f0956b2c83ad5854e2b4ae27da1ea",
      reason: "Approved evidence records the complete table and fully contained chart.",
      approvedOn: "2026-07-13",
    },
  },
  {
    id: "grouped-rotated",
    title: "Native grouped and rotated shapes",
    vaultPath: "compatibility/grouped-rotated.pptx",
    features: ["group", "rotation", "shapes", "text"],
    mainContentChecks: [
      text("Grouped workflow"),
      text("Discover"),
      text("Decide"),
      text("Deliver"),
    ],
    provenance,
    review: {
      classification: "supported",
      reason: "All three native group members and the rotated callout are fully visible.",
    },
    baselineApproval: {
      sha256: "febc35b34486cabd9e8219a1638299fcafcfa068e3fdc97e48b74785b5c801bd",
      reason: "Approved evidence records the complete native group and rotation rendering.",
      approvedOn: "2026-07-13",
    },
  },
  {
    id: "complex-drawing",
    title: "Complex vector drawing fallback",
    vaultPath: "compatibility/complex-drawing.pptx",
    features: ["complex-drawing", "images", "text"],
    mainContentChecks: [text("Architecture map"), image("Architecture diagram")],
    provenance,
    review: {
      classification: "degraded",
      reason: "The complex SVG drawing is replaced by a broken-image placeholder.",
    },
    baselineApproval: {
      sha256: "69b2aeeb2865e3b816f820c083de34449fee52eef4f9dacdff7b4db69ddece06",
      reason: "Approved evidence records the missing complex vector architecture diagram.",
      approvedOn: "2026-07-13",
    },
  },
] as const;
import type { CompatibilityClassification } from "../../src/compatibility/compatibility-report";
