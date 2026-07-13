import { describe, expect, it } from "vitest";
import {
  CORPUS_ENVIRONMENT,
  CORPUS_EXPECTED_GATE,
  REQUIRED_CORPUS_FEATURES,
  corpusManifest,
  getCandidateBaselineApproval,
  getCandidateReview,
} from "./corpus-manifest";

const candidates = ["aiden", "pptx-preview"] as const;

describe("PPTX compatibility corpus manifest", () => {
  it("uses unique identities and distributable repository-authored fixtures", () => {
    expect(new Set(corpusManifest.map(({ id }) => id)).size).toBe(
      corpusManifest.length,
    );
    expect(new Set(corpusManifest.map(({ vaultPath }) => vaultPath)).size).toBe(
      corpusManifest.length,
    );

    for (const fixture of corpusManifest) {
      expect(fixture.vaultPath).toBe(`compatibility/${fixture.id}.pptx`);
      expect(fixture.provenance.license).toBe("MIT");
      expect(fixture.provenance.generator).toBe(
        "scripts/generate-compatibility-fixtures.mjs",
      );
      expect(fixture.mainContentChecks.length).toBeGreaterThan(0);
      expect(
        new Set(fixture.mainContentChecks.map(({ label }) => label)).size,
      ).toBe(fixture.mainContentChecks.length);
      for (const candidate of candidates) {
        const review = getCandidateReview(fixture, candidate);
        const approval = getCandidateBaselineApproval(fixture, candidate);
        expect(review.reason.length).toBeGreaterThan(10);
        expect(approval.reason.length).toBeGreaterThan(10);
        expect(approval.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(["supported", "degraded", "failed"]).toContain(
          review.classification,
        );
        expect(
          review.unreadableContent.every((label) =>
            fixture.mainContentChecks.some((check) => check.label === label),
          ),
        ).toBe(true);
      }
    }
  });

  it("stores independent approved evidence for each renderer candidate", () => {
    const tables = corpusManifest.find(({ id }) => id === "tables-charts");
    expect(tables).toBeDefined();

    expect(getCandidateReview(tables!, "aiden")).toMatchObject({
      classification: "supported",
      unreadableContent: [],
    });
    expect(getCandidateReview(tables!, "pptx-preview")).toMatchObject({
      classification: "degraded",
      unreadableContent: ["Chart fully visible"],
    });
    expect(getCandidateBaselineApproval(tables!, "pptx-preview").sha256).toBe(
      "277205fe5a6d1fad1822fcbcf290af10b91acf7eb5bf824dbbcf8ff2809286c7",
    );
  });

  it("covers every representative feature required by Ticket #4", () => {
    const covered = new Set(corpusManifest.flatMap(({ features }) => features));

    for (const feature of REQUIRED_CORPUS_FEATURES) {
      expect(covered, `missing corpus coverage for ${feature}`).toContain(feature);
    }
  });

  it("pins the visual environment and M0 readability gate", () => {
    expect(CORPUS_EXPECTED_GATE).toBe(true);
    expect(CORPUS_ENVIRONMENT).toEqual({
      viewport: { width: 1024, height: 800 },
      theme: "light",
      zoom: 1,
      fontFamily: "Arial",
      fontSamples: ["Arial", "Times New Roman", "Definitely Missing Font"],
      readabilityGate: 0.8,
      maxVisualDiffRatio: 0,
    });
    const fontChecks = corpusManifest.flatMap(({ mainContentChecks }) =>
      mainContentChecks.filter((check) => check.kind === "font"),
    );
    expect(fontChecks.map(({ family }) => family)).toEqual(
      CORPUS_ENVIRONMENT.fontSamples,
    );
    expect(fontChecks.map(({ expectedAvailable }) => expectedAvailable)).toEqual([
      true,
      true,
      false,
    ]);
  });
});
