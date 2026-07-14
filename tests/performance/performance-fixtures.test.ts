import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { performanceFixtureManifest } from "./performance-fixtures";

const execFileAsync = promisify(execFile);
const generatorPath = path.resolve("scripts/generate-performance-fixtures.mjs");

async function runGenerator(cwd = process.cwd()): Promise<void> {
  await execFileAsync(process.execPath, [generatorPath], { cwd });
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function inspectPresentation(bytes: Buffer): Promise<{
  slideCount: number;
  zip: JSZip;
}> {
  const zip = await JSZip.loadAsync(bytes);
  const presentationXml = await zip
    .file("ppt/presentation.xml")
    ?.async("string");
  if (!presentationXml) throw new Error("fixture is missing presentation.xml");
  return {
    slideCount: presentationXml.match(/<p:sldId\b/g)?.length ?? 0,
    zip,
  };
}

describe("performance fixture manifest", () => {
  it("separates a bounded representative deck from the 200-slide stress deck", () => {
    expect(performanceFixtureManifest).toEqual([
      expect.objectContaining({
        id: "representative-12-slides",
        role: "representative",
        vaultPath: "performance/representative-12-slides.pptx",
        slideCount: 12,
        maxSlideCount: 50,
        maxBytes: 20 * 1024 * 1024,
      }),
      expect.objectContaining({
        id: "stress-200-slides",
        role: "stress",
        vaultPath: "performance/stress-200-slides.pptx",
        slideCount: 200,
      }),
    ]);
  });

  it("copies stable committed bytes with the required slide counts and content", async () => {
    await runGenerator();
    const hashes = new Map<string, string>();

    for (const fixture of performanceFixtureManifest) {
      const bytes = await readFile(fixture.fixturePath);
      const vaultBytes = await readFile(`tests/vault/${fixture.vaultPath}`);
      const { slideCount } = await inspectPresentation(bytes);

      expect(vaultBytes).toEqual(bytes);
      expect(slideCount).toBe(fixture.slideCount);
      hashes.set(fixture.id, sha256(bytes));
    }

    const representative = performanceFixtureManifest[0]!;
    const representativeBytes = await readFile(representative.fixturePath);
    const representativeInspection = await inspectPresentation(
      representativeBytes,
    );
    const representativeSlideXml = await representativeInspection.zip
      .file("ppt/slides/slide1.xml")
      ?.async("string");
    expect(representativeBytes.byteLength).toBeLessThanOrEqual(
      representative.maxBytes!,
    );
    expect(representativeInspection.slideCount).toBeLessThanOrEqual(
      representative.maxSlideCount!,
    );
    expect(representativeSlideXml).toContain("Representative benchmark slide 1");
    expect(representativeSlideXml).toContain("<a:tbl>");
    expect(
      representativeInspection.zip.file(/^ppt\/media\/image/).length,
    ).toBeGreaterThan(0);

    const stressBytes = await readFile(
      performanceFixtureManifest[1]!.fixturePath,
    );
    const stressInspection = await inspectPresentation(stressBytes);
    const finalStressSlideXml = await stressInspection.zip
      .file("ppt/slides/slide200.xml")
      ?.async("string");
    expect(finalStressSlideXml).toContain("Stress benchmark slide 200");

    await runGenerator();
    for (const fixture of performanceFixtureManifest) {
      expect(sha256(await readFile(fixture.fixturePath))).toBe(
        hashes.get(fixture.id),
      );
    }
  }, 30_000);

  it("refuses to rebuild a missing committed source in normal mode", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "performance-fixtures-"));
    try {
      await expect(runGenerator(cwd)).rejects.toThrow(
        /Missing committed performance fixture.*fixtures:performance:regenerate/s,
      );
      await expect(
        access(
          path.join(
            cwd,
            "tests/fixtures/performance/representative-12-slides.pptx",
          ),
        ),
      ).rejects.toThrow();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }, 30_000);
});
