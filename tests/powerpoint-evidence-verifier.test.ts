import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

async function rewriteIdentities(
  source: Buffer,
  destination: string,
  edit: (entries: string[]) => string[],
  updateTitle = false,
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
  if (updateTitle) {
    const slide = archive.file("ppt/slides/slide6.xml");
    if (slide === null) throw new Error("Missing target slide XML");
    archive.file(
      "ppt/slides/slide6.xml",
      (await slide.async("string")).replace(
        "Representative benchmark slide 6",
        "Representative benchmark slide 6 — PowerPoint round-trip",
      ),
    );
  }
  await writeFile(destination, await archive.generateAsync({ type: "nodebuffer" }));
}

function verify(edited: string, deleted: string) {
  const result = spawnSync(process.execPath, [
    "scripts/verify-powerpoint-slide-id-evidence.mjs",
    "--edited",
    edited,
    "--deleted",
    deleted,
    "--powerpoint-version",
    "test-version",
  ], { cwd: path.resolve("."), encoding: "utf8" });
  return {
    status: result.status,
    report: JSON.parse(result.stdout) as {
      passed: boolean;
      targetSlideId: number;
      checks: Record<string, boolean>;
    },
  };
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
      }, true);
      await rewriteIdentities(await readFile(edited), deleted, (entries) =>
        entries.filter((entry) => !entry.includes('id="261"')));

      const { status, report } = verify(edited, deleted);

      expect(status).toBe(0);
      expect(report.passed).toBe(true);
      expect(report.targetSlideId).toBe(261);
      expect(Object.values(report.checks).every(Boolean)).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects deletion evidence that did not derive from the edited package", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "pptx-slide-id-evidence-"));
    try {
      const source = await readFile(
        path.resolve("tests/fixtures/performance/representative-12-slides.pptx"),
      );
      const edited = path.join(directory, "powerpoint-edited.pptx");
      const deleted = path.join(directory, "powerpoint-deleted.pptx");
      await rewriteIdentities(source, edited, (entries) => {
        const target = entries.find((entry) => entry.includes('id="261"'))!;
        return ['<p:sldId id="999" r:id="rId999"/>', target, ...entries.filter(
          (entry) => entry !== target,
        )];
      }, true);
      await rewriteIdentities(source, deleted, (entries) =>
        entries.filter((entry) => !entry.includes('id="261"')));

      const { status, report } = verify(edited, deleted);
      expect(status).toBe(1);
      expect(report.passed).toBe(false);
      expect(report.checks.deletedMatchesEditedMinusTarget).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects edited evidence without the required title marker", async () => {
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
        return ['<p:sldId id="999" r:id="rId999"/>', remaining[0]!, target, ...remaining.slice(1)];
      });
      await rewriteIdentities(await readFile(edited), deleted, (entries) =>
        entries.filter((entry) => !entry.includes('id="261"')));

      const { status, report } = verify(edited, deleted);
      expect(status).toBe(1);
      expect(report.passed).toBe(false);
      expect(report.checks.editedTargetTitleUpdated).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
