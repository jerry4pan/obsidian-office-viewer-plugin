import type { CompatibilityClassification } from "../../src/compatibility/compatibility-report";
import type { PptxCompatibilityWarningCategory } from "../../src/renderer/pptx-renderer-adapter";
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
  readonly approvedOn:
    | "2026-07-13"
    | "2026-07-14"
    | "2026-07-15"
    | "2026-08-02"
    | "2026-08-11";
}

export interface CorpusFixture {
  readonly id: string;
  readonly title: string;
  readonly vaultPath: `compatibility/${string}.pptx`;
  readonly features: readonly CorpusFeature[];
  readonly runtimeWarnings: readonly PptxCompatibilityWarningCategory[];
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
    runtimeWarnings: ["font-substitution"],
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
        sha256: "5a1949c75081d7401d0f3f5b7e6320dd090fac37c9813fccfa8eb764363d4b9a",
        reason: "The 2026-08-11 PPTX control-polish review approved the intentional 462 x 484 capture after icon-led navigation regrouping restored one chrome row of slide height; all five readable units, layout, and font-substitution warning remain unchanged.",
        approvedOn: "2026-08-11",
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
    runtimeWarnings: ["unsupported-content"],
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
        sha256: "df12427a29880164c576ce27ee2df0ec4c46d9f4124951edace639e32498417b",
        reason: "The 2026-08-11 PPTX control-polish review approved the intentional 462 x 484 capture after icon-led navigation regrouping restored one chrome row of slide height; labels, transparency, layout, and the known broken SVG remain unchanged.",
        approvedOn: "2026-08-11",
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
    runtimeWarnings: [],
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
        sha256: "636479744d95b69b19fbf04698303c0a88b925ea9af7f746f04ef0419f61e129",
        reason: "The 2026-08-11 PPTX control-polish review approved the intentional 462 x 549 capture after icon-led navigation regrouping restored one chrome row of slide height; the table, axes, labels, and both chart bars remain fully visible.",
        approvedOn: "2026-08-11",
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
    runtimeWarnings: [],
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
        sha256: "7d267421a5de57159320f3c938f30ff71cda3a937e79faf0603e4015d3edb1e6",
        reason: "The 2026-08-11 PPTX control-polish review approved the intentional 462 x 549 capture after icon-led navigation regrouping restored one chrome row of slide height; all grouped shapes, labels, and the rotated callout remain fully visible.",
        approvedOn: "2026-08-11",
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
    runtimeWarnings: ["unsupported-content"],
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
        sha256: "6cfb3690a7665a6872f295ca569f6302a270fd89b59544b7a0a5986d2fba072d",
        reason: "The 2026-08-11 PPTX control-polish review approved the intentional 462 x 484 capture after icon-led navigation regrouping restored one chrome row of slide height; the title, layout, and known broken complex-SVG placeholder remain unchanged.",
        approvedOn: "2026-08-11",
      },
      "pptx-preview": {
        sha256: "cee7216f5a842e43b7d850f912fff010bfd81e47e5788249a88f029ff1943400",
        reason: "Ticket #6 approved the fixed-viewport pptx-preview output after visual review; ordinary runs require an exact pixel match.",
        approvedOn: "2026-07-13",
      },
    },
  },
] as const;
