import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import JSZip from "jszip";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function attributeValue(element, name) {
  return new RegExp(`\\s${name}="([^"]+)"`).exec(element)?.[1];
}

function decodeXmlText(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

async function packageEvidence(filePath) {
  const bytes = await readFile(filePath);
  const archive = await JSZip.loadAsync(bytes);
  const presentation = archive.file("ppt/presentation.xml");
  if (presentation === null) throw new Error(`${filePath}: missing ppt/presentation.xml`);
  const xml = await presentation.async("string");
  const list = /<(?:[A-Za-z_][\w.-]*:)?sldIdLst\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?sldIdLst\s*>/.exec(xml)?.[1];
  if (list === undefined) throw new Error(`${filePath}: missing slide identity list`);
  const relationshipPrefix = new RegExp(
    'xmlns:([A-Za-z_][\\w.-]*)="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  ).exec(xml)?.[1];
  if (relationshipPrefix === undefined) {
    throw new Error(`${filePath}: missing office relationship namespace`);
  }
  const entries = [...list.matchAll(/<(?:[A-Za-z_][\w.-]*:)?sldId\b[^>]*\/?\s*>/g)]
    .map(([element]) => ({
      id: Number(attributeValue(element, "id")),
      relationshipId: attributeValue(element, `${relationshipPrefix}:id`),
    }));
  const ids = entries.map(({ id }) => id);
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error(`${filePath}: slide identities are empty or duplicated`);
  }
  if (entries.some(({ id, relationshipId }) =>
    !Number.isSafeInteger(id) || relationshipId === undefined
  )) {
    throw new Error(`${filePath}: slide identity entry is malformed`);
  }
  return { archive, entries, ids };
}

async function slideText(evidence, slideId, filePath) {
  const entry = evidence.entries.find(({ id }) => id === slideId);
  if (entry === undefined) return "";
  const relationships = evidence.archive.file("ppt/_rels/presentation.xml.rels");
  if (relationships === null) {
    throw new Error(`${filePath}: missing presentation relationships`);
  }
  const relationshipsXml = await relationships.async("string");
  const relationship = [...relationshipsXml.matchAll(/<Relationship\b[^>]*\/?\s*>/g)]
    .map(([element]) => ({
      id: attributeValue(element, "Id"),
      target: attributeValue(element, "Target"),
      type: attributeValue(element, "Type"),
    }))
    .find(({ id, type }) =>
      id === entry.relationshipId && type?.endsWith("/slide")
    );
  if (relationship?.target === undefined) {
    throw new Error(`${filePath}: target slide relationship is missing`);
  }
  const slidePath = path.posix.normalize(`ppt/${relationship.target}`);
  if (!slidePath.startsWith("ppt/slides/")) {
    throw new Error(`${filePath}: target slide relationship escapes ppt/slides`);
  }
  const slide = evidence.archive.file(slidePath);
  if (slide === null) throw new Error(`${filePath}: missing ${slidePath}`);
  const slideXml = await slide.async("string");
  return [...slideXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t\s*>/g)]
    .map((match) => decodeXmlText(match[1]))
    .join("");
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
const resolvedEditedPath = path.resolve(editedPath);
const resolvedDeletedPath = path.resolve(deletedPath);
const [baselineEvidence, editedEvidence, deletedEvidence] = await Promise.all([
  packageEvidence(baselinePath),
  packageEvidence(resolvedEditedPath),
  packageEvidence(resolvedDeletedPath),
]);
const baseline = baselineEvidence.ids;
const edited = editedEvidence.ids;
const deleted = deletedEvidence.ids;
const target = baseline[5];
const preservedOriginals = baseline.filter((id) => id !== target);
const editedWithoutTarget = edited.filter((id) => id !== target);
const targetText = await slideText(editedEvidence, target, resolvedEditedPath);
const checks = {
  targetWasBaselineSlide6: target === 261,
  editedHasInsertedSlide: edited.length === baseline.length + 1,
  editedTargetMovedToSlide3: edited[2] === target,
  editedTargetTitleUpdated:
    targetText.includes("Representative benchmark slide 6") &&
    targetText.includes("PowerPoint round-trip"),
  editedPreservesOtherOriginalIds: preservedOriginals.every((id) => edited.includes(id)),
  deletedRemovesTarget: !deleted.includes(target),
  deletedPreservesOtherOriginalIds: preservedOriginals.every((id) => deleted.includes(id)),
  deletedMatchesEditedMinusTarget:
    JSON.stringify(deleted) === JSON.stringify(editedWithoutTarget),
};
const passed = Object.values(checks).every(Boolean);
process.stdout.write(`${JSON.stringify({
  passed,
  environment: { powerpointVersion, platform: `${process.platform}-${process.arch}` },
  files: {
    baseline: baselinePath,
    edited: resolvedEditedPath,
    deleted: resolvedDeletedPath,
  },
  targetSlideId: target,
  baseline,
  edited,
  deleted,
  checks,
}, null, 2)}\n`);
if (!passed) process.exitCode = 1;
