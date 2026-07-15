import type { CompatibilityClassification } from "../../src/compatibility/compatibility-report";
import type { PptxRendererCandidate } from "../../src/renderer/renderer-candidate-config";

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

export interface CandidateHumanReview {
  readonly classification: CompatibilityClassification;
  readonly reason: string;
  readonly unreadableContent: readonly string[];
}

export interface CandidateBaselineApproval {
  readonly sha256: string;
  readonly reason: string;
  readonly approvedOn: "2026-07-13" | "2026-07-14" | "2026-07-15";
}

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
  readonly review: Readonly<
    Record<PptxRendererCandidate, CandidateHumanReview>
  >;
  readonly baselineApproval: Readonly<
    Record<PptxRendererCandidate, CandidateBaselineApproval>
  >;
}

export function getCandidateReview(
  fixture: CorpusFixture,
  candidate: PptxRendererCandidate,
): CandidateHumanReview {
  return fixture.review[candidate];
}

export function getCandidateBaselineApproval(
  fixture: CorpusFixture,
  candidate: PptxRendererCandidate,
): CandidateBaselineApproval {
  return fixture.baselineApproval[candidate];
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
      aiden: {
        classification: "supported",
        reason: "Body text, both font samples, fallback text, and the master footer are readable.",
        unreadableContent: [],
      },
      "pptx-preview": {
        classification: "degraded",
        reason: "Body text and both font samples are readable, but the theme master footer is missing.",
        unreadableContent: ["Theme footer"],
      },
    },
    baselineApproval: {
      aiden: {
        sha256: "575c0c33f264cc310ed2e9d73abcaf5b4ed958277293a68e6012124f1ce3fb26",
        reason: "The 2026-07-15 en-US host-language revalidation approved 304 material pixels confined to the missing-font fallback glyph raster; 69 additional raw edge-antialias pixels remain below the fixed comparison threshold, while layout, readable content, and known SVG limitations are unchanged.",
        approvedOn: "2026-07-15",
      },
      "pptx-preview": {
        sha256: "ce1fcdfa514ce879d7da008351f947b35165c31b833a49b441c3953e79ea7167",
        reason: "Ticket #6 approved the fixed-viewport pptx-preview output after visual review; ordinary runs require an exact pixel match.",
        approvedOn: "2026-07-13",
      },
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
      aiden: {
        classification: "degraded",
        reason: "Transparency and labels render, but the embedded SVG remains a broken image.",
        unreadableContent: ["Product illustration"],
      },
      "pptx-preview": {
        classification: "degraded",
        reason: "Labels and transparency render, but the embedded SVG product illustration is broken.",
        unreadableContent: ["Product illustration"],
      },
    },
    baselineApproval: {
      aiden: {
        sha256: "d1ebeaee8c153627001af8d76c54997e65f07f19d67ce3e22547fc87fb8f7166",
        reason: "The 2026-07-14 M2 review approved the intentional 462 x 549 main-slide capture produced by the default toolbar and thumbnail rail; rendered content and known SVG limitations are unchanged.",
        approvedOn: "2026-07-14",
      },
      "pptx-preview": {
        sha256: "f9e445481f1dc10b432e24e087d8752da6cef909175baf5d8aad515d960b664a",
        reason: "Ticket #6 approved the fixed-viewport pptx-preview output after visual review; ordinary runs require an exact pixel match.",
        approvedOn: "2026-07-13",
      },
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
      aiden: {
        classification: "supported",
        reason: "The table, axes, labels, title, and both chart bars are fully visible.",
        unreadableContent: [],
      },
      "pptx-preview": {
        classification: "degraded",
        reason: "The table text and chart container render, but the chart categories and data bars are empty or incorrect.",
        unreadableContent: ["Chart fully visible"],
      },
    },
    baselineApproval: {
      aiden: {
        sha256: "e233151e7c031386b1836d3d05ca79e6eb0ca10b57323f04b12106630f2859de",
        reason: "The 2026-07-14 M2 review approved the intentional 462 x 549 main-slide capture produced by the default toolbar and thumbnail rail; rendered content and known SVG limitations are unchanged.",
        approvedOn: "2026-07-14",
      },
      "pptx-preview": {
        sha256: "277205fe5a6d1fad1822fcbcf290af10b91acf7eb5bf824dbbcf8ff2809286c7",
        reason: "Ticket #6 approved the fixed-viewport pptx-preview output after visual review; ordinary runs require an exact pixel match.",
        approvedOn: "2026-07-13",
      },
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
      aiden: {
        classification: "supported",
        reason: "All three native group members and the rotated callout are fully visible.",
        unreadableContent: [],
      },
      "pptx-preview": {
        classification: "supported",
        reason: "All three native group members and the rotated callout are fully visible.",
        unreadableContent: [],
      },
    },
    baselineApproval: {
      aiden: {
        sha256: "d2b797a99d29f0e198816f436fb04cfbe81b5d11a540e35c5c71dfd9f8a125e4",
        reason: "The 2026-07-14 M2 review approved the intentional 462 x 549 main-slide capture produced by the default toolbar and thumbnail rail; rendered content and known SVG limitations are unchanged.",
        approvedOn: "2026-07-14",
      },
      "pptx-preview": {
        sha256: "8b9d9377e42546ca5c585f4eddcf8a033da61ad80a4cbb6fc2b2978399c79856",
        reason: "Ticket #6 approved the fixed-viewport pptx-preview output after visual review; ordinary runs require an exact pixel match.",
        approvedOn: "2026-07-13",
      },
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
      aiden: {
        classification: "degraded",
        reason: "The complex SVG drawing is replaced by a broken-image placeholder.",
        unreadableContent: ["Architecture diagram"],
      },
      "pptx-preview": {
        classification: "degraded",
        reason: "The complex SVG drawing is replaced by a broken-image placeholder.",
        unreadableContent: ["Architecture diagram"],
      },
    },
    baselineApproval: {
      aiden: {
        sha256: "9da90cef6b91003b3875ed2d16bc98973c9791b3e5acba189249a51d0ced3aff",
        reason: "The 2026-07-14 M2 review approved the intentional 462 x 549 main-slide capture produced by the default toolbar and thumbnail rail; rendered content and known SVG limitations are unchanged.",
        approvedOn: "2026-07-14",
      },
      "pptx-preview": {
        sha256: "cee7216f5a842e43b7d850f912fff010bfd81e47e5788249a88f029ff1943400",
        reason: "Ticket #6 approved the fixed-viewport pptx-preview output after visual review; ordinary runs require an exact pixel match.",
        approvedOn: "2026-07-13",
      },
    },
  },
] as const;
