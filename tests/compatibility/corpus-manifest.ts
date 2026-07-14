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
      sha256: "e152a4483004834fd90d3fac6aa635ee48c719b47461d491aa129fe071de9dd5",
      reason: "Ticket #5 approved the intentional 10 px capture-height normalization caused by Task 1 navigation controls; rendered content and layout are unchanged.",
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
      sha256: "ac54b5ec8c85c943acb63b83df81f807ad355b36a9b9c802c5e80fe0a44904aa",
      reason: "Ticket #5 approved the intentional 10 px capture-height normalization caused by Task 1 navigation controls; rendered content and layout are unchanged.",
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
      sha256: "87649d567246d9dfac4e18b20a550889ef75485239d27e522e3060fcb9c3a255",
      reason: "Ticket #5 approved the intentional 10 px capture-height normalization caused by Task 1 navigation controls; rendered content and layout are unchanged.",
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
      sha256: "c2f00dda84ad2f68f42a1ab3c43ff545576b1c049789bcf82bc346ff3bf7b175",
      reason: "Ticket #5 approved the intentional 10 px capture-height normalization caused by Task 1 navigation controls; rendered content and layout are unchanged.",
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
      sha256: "1d83188287d530952a41cc1bd867b293ee1afa2f70fad4e4d9cad4f883c7e052",
      reason: "Ticket #5 approved the intentional 10 px capture-height normalization caused by Task 1 navigation controls; rendered content and layout are unchanged.",
      approvedOn: "2026-07-13",
    },
  },
] as const;
import type { CompatibilityClassification } from "../../src/compatibility/compatibility-report";
