import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { corpusManifest } from "./corpus-manifest";

const execFileAsync = promisify(execFile);

function hash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function runGenerator(): Promise<void> {
  await execFileAsync(process.execPath, [
    "scripts/generate-compatibility-fixtures.mjs",
  ]);
}

describe("compatibility fixture generator", () => {
  it("creates stable, byte-identical fixture and vault pairs", async () => {
    await runGenerator();

    const before = new Map<string, string>();
    for (const fixture of corpusManifest) {
      const fixtureBytes = await readFile(
        `tests/fixtures/compatibility/${fixture.id}.pptx`,
      );
      const vaultBytes = await readFile(`tests/vault/${fixture.vaultPath}`);
      expect(vaultBytes).toEqual(fixtureBytes);
      before.set(fixture.id, hash(fixtureBytes));
    }

    await runGenerator();

    for (const fixture of corpusManifest) {
      expect(
        hash(
          await readFile(`tests/fixtures/compatibility/${fixture.id}.pptx`),
        ),
      ).toBe(before.get(fixture.id));
    }
  });

  it("contains a native DrawingML group in the grouped fixture", async () => {
    await runGenerator();
    const bytes = await readFile(
      "tests/fixtures/compatibility/grouped-rotated.pptx",
    );
    const zip = await JSZip.loadAsync(bytes);
    const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");

    expect(slideXml).toContain("<p:grpSp>");
    expect(slideXml).toContain("Grouped workflow");
  });
});
