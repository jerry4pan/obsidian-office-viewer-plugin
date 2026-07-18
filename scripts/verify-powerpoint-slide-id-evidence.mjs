import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import JSZip from "jszip";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function identities(filePath) {
  const bytes = await readFile(filePath);
  const archive = await JSZip.loadAsync(bytes);
  const presentation = archive.file("ppt/presentation.xml");
  if (presentation === null) throw new Error(`${filePath}: missing ppt/presentation.xml`);
  const xml = await presentation.async("string");
  const list = /<(?:[A-Za-z_][\w.-]*:)?sldIdLst\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?sldIdLst\s*>/.exec(xml)?.[1];
  if (list === undefined) throw new Error(`${filePath}: missing slide identity list`);
  const ids = [...list.matchAll(/<(?:[A-Za-z_][\w.-]*:)?sldId\b[^>]*\bid="([1-9]\d*)"/g)]
    .map((match) => Number(match[1]));
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error(`${filePath}: slide identities are empty or duplicated`);
  }
  return ids;
}

const editedPath = argument("--edited");
const deletedPath = argument("--deleted");
const powerpointVersion = argument("--powerpoint-version");
if (!editedPath || !deletedPath || !powerpointVersion) {
  throw new Error(
    "Usage: node scripts/verify-powerpoint-slide-id-evidence.mjs --edited <pptx> --deleted <pptx> --powerpoint-version <version>",
  );
}

const baselinePath = path.resolve("tests/fixtures/performance/representative-12-slides.pptx");
const [baseline, edited, deleted] = await Promise.all([
  identities(baselinePath),
  identities(path.resolve(editedPath)),
  identities(path.resolve(deletedPath)),
]);
const target = baseline[5];
const preservedOriginals = baseline.filter((id) => id !== target);
const checks = {
  targetWasBaselineSlide6: target === 261,
  editedHasInsertedSlide: edited.length === baseline.length + 1,
  editedTargetMovedToSlide3: edited[2] === target,
  editedPreservesOtherOriginalIds: preservedOriginals.every((id) => edited.includes(id)),
  deletedRemovesTarget: !deleted.includes(target),
  deletedPreservesOtherOriginalIds: preservedOriginals.every((id) => deleted.includes(id)),
};
const passed = Object.values(checks).every(Boolean);
process.stdout.write(`${JSON.stringify({
  passed,
  environment: { powerpointVersion, platform: `${process.platform}-${process.arch}` },
  files: {
    baseline: baselinePath,
    edited: path.resolve(editedPath),
    deleted: path.resolve(deletedPath),
  },
  targetSlideId: target,
  baseline,
  edited,
  deleted,
  checks,
}, null, 2)}\n`);
if (!passed) process.exitCode = 1;
