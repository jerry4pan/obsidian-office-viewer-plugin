import { execFile } from "node:child_process";
import { access, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import manifest from "../tests/failure/failure-fixtures.json" with { type: "json" };
import { parseSafetyFixtureManifest } from "./safety-fixture-manifest.mjs";

const execFileAsync = promisify(execFile);
const allSafetyFixtures = parseSafetyFixtureManifest(manifest);
const degradedNavigationFixturePath = path.resolve(
  "tests/fixtures/m1/degraded-navigation.pptx",
);
const degradedNavigationVaultPath = path.resolve(
  "tests/vault/m1/degraded-navigation.pptx",
);

for (const directory of new Set(
  [
    ...allSafetyFixtures.flatMap((fixture) => [
      path.dirname(fixture.fixturePath),
      path.dirname(fixture.vaultPath),
    ]),
    path.dirname(degradedNavigationFixturePath),
    path.dirname(degradedNavigationVaultPath),
  ],
)) {
  await mkdir(path.resolve(directory), { recursive: true });
}

const fixtureById = new Map(allSafetyFixtures.map((fixture) => [fixture.id, fixture]));

function fixturePath(id) {
  const fixture = fixtureById.get(id);
  if (!fixture) throw new Error(`Unknown failure fixture ${id}`);
  return path.resolve(fixture.fixturePath);
}

function vaultPath(id) {
  const fixture = fixtureById.get(id);
  if (!fixture) throw new Error(`Unknown failure fixture ${id}`);
  return path.resolve(fixture.vaultPath);
}

async function buildBasePptx() {
  const pptx = new PptxGenJS();
  pptx.author = "Obsidian Office Viewer";
  pptx.company = "Obsidian Office Viewer";
  pptx.subject = "Failure-path acceptance fixture";
  pptx.title = "Repository-authored failure fixture";
  pptx.lang = "en-US";
  pptx.layout = "LAYOUT_WIDE";
  const slide = pptx.addSlide();
  slide.addText("Failure fixture", {
    x: 1,
    y: 1,
    w: 5,
    h: 0.6,
    fontFace: "Arial",
    fontSize: 24,
  });
  slide.addImage({
    data:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZC3sAAAAASUVORK5CYII=",
    x: 1,
    y: 2,
    w: 1,
    h: 1,
  });
  return Buffer.from(
    await pptx.write({ outputType: "nodebuffer", compression: true }),
  );
}

async function writeZip(zip) {
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

async function generateDegradedNavigationFixture() {
  const pptx = new PptxGenJS();
  pptx.author = "Obsidian Office Viewer";
  pptx.subject = "Installed degraded-navigation acceptance fixture";
  pptx.title = "Readable slides for deterministic navigation fault injection";
  pptx.lang = "en-US";
  pptx.layout = "LAYOUT_WIDE";
  for (const slideNumber of [1, 2, 3]) {
    const slide = pptx.addSlide();
    slide.addText(`Readable slide ${slideNumber}`, {
      x: 1,
      y: 1,
      w: 7,
      h: 0.8,
      fontFace: "Arial",
      fontSize: 28,
    });
  }
  const bytes = Buffer.from(
    await pptx.write({ outputType: "nodebuffer", compression: true }),
  );
  await writeFile(degradedNavigationFixturePath, bytes);
}

async function generateFixtures() {
  const base = await buildBasePptx();

  await writeFile(fixturePath("malformed-zip"), base.subarray(0, base.length - 96));

  const malformedXml = await JSZip.loadAsync(base);
  malformedXml.file(
    "ppt/presentation.xml",
    '<?xml version="1.0"?><p:presentation><p:sldIdLst>',
  );
  await writeFile(fixturePath("malformed-xml"), await writeZip(malformedXml));

  const missingMedia = await JSZip.loadAsync(base);
  const mediaPath = Object.keys(missingMedia.files).find((entry) =>
    entry.startsWith("ppt/media/"),
  );
  if (!mediaPath) throw new Error("base fixture did not contain related media");
  missingMedia.remove(mediaPath);
  await writeFile(fixturePath("missing-media"), await writeZip(missingMedia));

  const plainProtectedPath = `${fixturePath("protected-encrypted")}.plain.pptx`;
  await writeFile(plainProtectedPath, base);
  try {
    await execFileAsync(
      process.env.MSOFFCRYPTO_PYTHON ?? "python3",
      [
        "scripts/encrypt-ooxml-fixture.py",
        plainProtectedPath,
        fixturePath("protected-encrypted"),
        "repository-fixture-password",
      ],
    );
  } catch (error) {
    throw new Error(
      "Protected fixture generation requires Python >=3.10 and `pip install -r scripts/requirements-fixtures.txt`; set MSOFFCRYPTO_PYTHON when needed.",
      { cause: error },
    );
  } finally {
    await rm(plainProtectedPath, { force: true });
  }

  const activeContent = await JSZip.loadAsync(base);
  const contentTypes = await activeContent.file("[Content_Types].xml")?.async("text");
  if (!contentTypes) {
    throw new Error("base fixture is missing required OOXML parts");
  }
  activeContent.file(
    "[Content_Types].xml",
    contentTypes.replace(
      "</Types>",
      '<Override PartName="/ppt/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>',
    ),
  );
  activeContent.file(
    "ppt/vbaProject.bin",
    Buffer.from("INERT TEST CONTENT - MUST NEVER EXECUTE", "utf8"),
  );
  await writeFile(
    fixturePath("active-content"),
    await writeZip(activeContent),
  );

  const rendererLimit = await JSZip.loadAsync(base);
  rendererLimit.file("ppt/media/oversized-candidate-entry.bin", Buffer.alloc(33 * 1024 * 1024));
  await writeFile(
    fixturePath("renderer-resource-limit"),
    await writeZip(rendererLimit),
  );

  const preflightXmlLimit = await JSZip.loadAsync(base);
  preflightXmlLimit.file(
    "ppt/safety/oversized.xml",
    `<safety>${" ".repeat(33 * 1024 * 1024)}</safety>`,
  );
  await writeFile(
    fixturePath("preflight-xml-limit"),
    await writeZip(preflightXmlLimit),
  );

  const preflightEntryLimit = await JSZip.loadAsync(base);
  for (let index = 0; index < 4_001; index += 1) {
    preflightEntryLimit.file(`ppt/safety/entry-${index}.bin`, new Uint8Array());
  }
  await writeFile(
    fixturePath("preflight-entry-limit"),
    await writeZip(preflightEntryLimit),
  );

  const externalRelationship = await JSZip.loadAsync(base);
  const slide = await externalRelationship.file("ppt/slides/slide1.xml")?.async("text");
  const slideRelationships = await externalRelationship
    .file("ppt/slides/_rels/slide1.xml.rels")
    ?.async("text");
  if (!slide || !slideRelationships) {
    throw new Error("base fixture is missing slide relationship parts");
  }
  externalRelationship.file(
    "ppt/slides/slide1.xml",
    slide.replace(
      "</a:rPr>",
      '<a:hlinkClick r:id="rIdExternalSafetyFixture"/></a:rPr>',
    ),
  );
  externalRelationship.file(
    "ppt/slides/_rels/slide1.xml.rels",
    slideRelationships.replace(
      "</Relationships>",
      '<Relationship Id="rIdExternalSafetyFixture" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/must-not-fetch" TargetMode="External"/></Relationships>',
    ),
  );
  await writeFile(
    fixturePath("external-relationship-safe"),
    await writeZip(externalRelationship),
  );

  const externalImage = await JSZip.loadAsync(base);
  const externalImageSlide = await externalImage
    .file("ppt/slides/slide1.xml")
    ?.async("text");
  const externalImageRelationships = await externalImage
    .file("ppt/slides/_rels/slide1.xml.rels")
    ?.async("text");
  if (!externalImageSlide || !externalImageRelationships) {
    throw new Error("base fixture is missing image relationship parts");
  }
  externalImage.file(
    "ppt/slides/slide1.xml",
    externalImageSlide.replace('r:embed="rId1"', 'r:link="rId1"'),
  );
  externalImage.file(
    "ppt/slides/_rels/slide1.xml.rels",
    externalImageRelationships.replace(
      'Target="../media/image-1-1.png"',
      'Target="https://example.invalid/must-not-fetch.png" TargetMode="External"',
    ),
  );
  await writeFile(
    fixturePath("external-image-blocked"),
    await writeZip(externalImage),
  );

  const spoofedExternalImage = await JSZip.loadAsync(base);
  spoofedExternalImage.file(
    "ppt/slides/slide1.xml",
    externalImageSlide.replace('r:embed="rId1"', 'r:link="rId1"'),
  );
  spoofedExternalImage.file(
    "ppt/slides/_rels/slide1.xml.rels",
    externalImageRelationships.replace(
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image-1-1.png"',
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/must-not-fetch.png" TargetMode="External"',
    ),
  );
  await writeFile(
    fixturePath("external-image-type-spoof-blocked"),
    await writeZip(spoofedExternalImage),
  );
}

const force = process.argv.includes("--force");
const allFixtureFilesExist = (
  await Promise.all(
    allSafetyFixtures.map(({ id }) => access(fixturePath(id)).then(
      () => true,
      () => false,
    )),
  )
).every(Boolean);

if (force || !allFixtureFilesExist) await generateFixtures();

const degradedNavigationFixtureIsCurrent = await readFile(
  degradedNavigationFixturePath,
).then(
  async (bytes) => {
    const zip = await JSZip.loadAsync(bytes);
    const slide2 = await zip.file("ppt/slides/slide2.xml")?.async("text");
    return slide2?.includes("Readable slide 2") === true;
  },
  () => false,
);
if (force || !degradedNavigationFixtureIsCurrent) {
  await generateDegradedNavigationFixture();
}

for (const { id } of allSafetyFixtures) {
  await readFile(fixturePath(id));
  await copyFile(fixturePath(id), vaultPath(id));
}
await copyFile(degradedNavigationFixturePath, degradedNavigationVaultPath);
