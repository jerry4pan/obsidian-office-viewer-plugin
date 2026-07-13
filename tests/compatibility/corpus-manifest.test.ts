import { describe, expect, it } from "vitest";
import {
  CORPUS_ENVIRONMENT,
  CORPUS_EXPECTED_GATE,
  REQUIRED_CORPUS_FEATURES,
  corpusManifest,
} from "./corpus-manifest";

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
      expect(fixture.review.reason.length).toBeGreaterThan(10);
      expect(fixture.baselineApproval.reason.length).toBeGreaterThan(10);
      expect(fixture.baselineApproval.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(["supported", "degraded", "failed"]).toContain(
        fixture.review.classification,
      );
    }
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
  });
});
