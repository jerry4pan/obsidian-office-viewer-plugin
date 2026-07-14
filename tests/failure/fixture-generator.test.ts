import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { parseSafetyFixtureManifest } from "../../scripts/safety-fixture-manifest.mjs";
import {
  allSafetyFixtures,
  expectedFailureFixtures,
  fixturePath,
  vaultPath,
} from "./failure-fixtures";

const execFileAsync = promisify(execFile);
const oleCompoundFileSignature = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("failure fixture generator", () => {
  it("copies every committed fixture without rewriting it", async () => {
    const before = await Promise.all(
      allSafetyFixtures.map(async (fixture) =>
        sha256(await readFile(fixturePath(fixture))),
      ),
    );

    await execFileAsync(process.execPath, [
      "scripts/generate-failure-fixtures.mjs",
    ]);

    const after = await Promise.all(
      allSafetyFixtures.map(async (fixture) => {
        const committed = await readFile(fixturePath(fixture));
        expect(await readFile(vaultPath(fixture))).toEqual(committed);
        return sha256(committed);
      }),
    );
    expect(after).toEqual(before);
  });

  it("uses the standard encrypted OOXML container signature for protected input", async () => {
    const bytes = await readFile(
      fixturePath(expectedFailureFixtures.find(({ id }) => id === "protected-encrypted")!),
    );

    expect(bytes.subarray(0, 8)).toEqual(oleCompoundFileSignature);
  });

  it("documents every fixture as repository-authored test content", () => {
    for (const fixture of allSafetyFixtures) {
      expect(fixture.provenance).toMatch(/^repository-authored|^truncated repository-authored/);
    }
  });

  it("keeps active-content and candidate-limit fixtures structurally usable", async () => {
    for (const id of [
      "active-content",
      "renderer-resource-limit",
      "external-relationship-safe",
    ]) {
      const fixture = allSafetyFixtures.find((entry) => entry.id === id)!;
      const zip = await JSZip.loadAsync(await readFile(fixturePath(fixture)));
      const presentation = await zip.file("ppt/presentation.xml")?.async("text");
      expect(presentation).toMatch(/<p:sldId\b/);
    }
  });

  it("keeps all three degraded-navigation source slides valid and readable", async () => {
    const fixtureBytes = await readFile(
      "tests/fixtures/m1/degraded-navigation.pptx",
    );
    const vaultBytes = await readFile(
      "tests/vault/m1/degraded-navigation.pptx",
    );
    expect(vaultBytes).toEqual(fixtureBytes);
    const zip = await JSZip.loadAsync(fixtureBytes);

    for (const slideNumber of [1, 2, 3]) {
      const xml = await zip
        .file(`ppt/slides/slide${slideNumber}.xml`)
        ?.async("text");
      expect(xml).toContain(`Readable slide ${slideNumber}`);
      const document = new DOMParser().parseFromString(
        xml ?? "",
        "application/xml",
      );
      expect(document.querySelector("parsererror")).toBeNull();
    }
  });

  it("uses a standard slide-referenced external hyperlink for the no-network fixture", async () => {
    const fixture = allSafetyFixtures.find(
      ({ id }) => id === "external-relationship-safe",
    )!;
    const zip = await JSZip.loadAsync(await readFile(fixturePath(fixture)));
    const slide = await zip.file("ppt/slides/slide1.xml")?.async("text");
    const relationships = await zip
      .file("ppt/slides/_rels/slide1.xml.rels")
      ?.async("text");

    expect(slide).toContain('a:hlinkClick r:id="rIdExternalSafetyFixture"');
    expect(relationships).toContain(
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"',
    );
    expect(relationships).toContain('TargetMode="External"');
  });

  it("uses a standard slide-referenced external image for the blocked-network fixture", async () => {
    const fixture = allSafetyFixtures.find(
      ({ id }) => id === "external-image-blocked",
    )!;
    const zip = await JSZip.loadAsync(await readFile(fixturePath(fixture)));
    const slide = await zip.file("ppt/slides/slide1.xml")?.async("text");
    const relationships = await zip
      .file("ppt/slides/_rels/slide1.xml.rels")
      ?.async("text");

    expect(slide).toContain('a:blip r:link="rId1"');
    expect(relationships).toContain(
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"',
    );
    expect(relationships).toContain('TargetMode="External"');
  });

  it("covers a hyperlink-type spoof used from an external image node", async () => {
    const fixture = allSafetyFixtures.find(
      ({ id }) => id === "external-image-type-spoof-blocked",
    )!;
    const zip = await JSZip.loadAsync(await readFile(fixturePath(fixture)));
    const slide = await zip.file("ppt/slides/slide1.xml")?.async("text");
    const relationships = await zip
      .file("ppt/slides/_rels/slide1.xml.rels")
      ?.async("text");

    expect(slide).toContain('a:blip r:link="rId1"');
    expect(relationships).toContain(
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"',
    );
    expect(relationships).toContain('TargetMode="External"');
  });

  it("rejects duplicate and out-of-scope manifest destinations before generation", () => {
    const valid = {
      id: "fixture",
      category: "malformed",
      provenance: "repository-authored fixture",
      fixturePath: "tests/fixtures/failure/fixture.pptx",
      vaultPath: "tests/vault/failure/fixture.pptx",
    };
    expect(() => parseSafetyFixtureManifest([valid, valid])).toThrow(/Duplicate/);
    expect(() =>
      parseSafetyFixtureManifest([
        { ...valid, fixturePath: "../outside.pptx" },
      ]),
    ).toThrow(/must stay under/);
  });
});
