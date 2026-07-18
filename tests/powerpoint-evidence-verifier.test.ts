import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

async function rewriteIdentities(
  source: Buffer,
  destination: string,
  edit: (entries: string[]) => string[],
): Promise<void> {
  const archive = await JSZip.loadAsync(source);
  const presentation = archive.file("ppt/presentation.xml");
  if (presentation === null) throw new Error("Missing presentation.xml");
  const xml = await presentation.async("string");
  const listPattern = /(<p:sldIdLst>)([\s\S]*?)(<\/p:sldIdLst>)/;
  const match = listPattern.exec(xml);
  if (match === null) throw new Error("Missing slide identity list");
  const entries = [...match[2]!.matchAll(/<p:sldId\b[^>]*\/>/g)]
    .map(([entry]) => entry);
  archive.file(
    "ppt/presentation.xml",
    xml.replace(listPattern, `$1${edit(entries).join("")}$3`),
  );
  await writeFile(destination, await archive.generateAsync({ type: "nodebuffer" }));
}

describe("PowerPoint slide identity evidence verifier", () => {
  it("accepts inserted/reordered and deleted evidence with the target identity", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "pptx-slide-id-evidence-"));
    try {
      const source = await readFile(
        path.resolve("tests/fixtures/performance/representative-12-slides.pptx"),
      );
      const edited = path.join(directory, "powerpoint-edited.pptx");
      const deleted = path.join(directory, "powerpoint-deleted.pptx");
      await rewriteIdentities(source, edited, (entries) => {
        const target = entries.find((entry) => entry.includes('id="261"'))!;
        const remaining = entries.filter((entry) => entry !== target);
        return [
          '<p:sldId id="999" r:id="rId999"/>',
          remaining[0]!,
          target,
          ...remaining.slice(1),
        ];
      });
      await rewriteIdentities(await readFile(edited), deleted, (entries) =>
        entries.filter((entry) => !entry.includes('id="261"')));

      const { stdout } = await execFileAsync(
        process.execPath,
        [
          "scripts/verify-powerpoint-slide-id-evidence.mjs",
          "--edited",
          edited,
          "--deleted",
          deleted,
          "--powerpoint-version",
          "test-version",
        ],
        { cwd: path.resolve(".") },
      );
      const report = JSON.parse(stdout) as {
        passed: boolean;
        targetSlideId: number;
        checks: Record<string, boolean>;
      };

      expect(report.passed).toBe(true);
      expect(report.targetSlideId).toBe(261);
      expect(Object.values(report.checks).every(Boolean)).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
