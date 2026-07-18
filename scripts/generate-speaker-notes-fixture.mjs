import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";

const fixtureDir = path.resolve("tests/fixtures");
const vaultDir = path.resolve("tests/vault");
const fixturePath = path.join(fixtureDir, "speaker-notes.pptx");
const vaultPath = path.join(vaultDir, "speaker-notes.pptx");

await mkdir(fixtureDir, { recursive: true });
await mkdir(vaultDir, { recursive: true });

const force = process.argv.includes("--force");
const fixtureExists = await access(fixturePath).then(
  () => true,
  () => false,
);

if (force || !fixtureExists) {
  const pptx = new PptxGenJS();
  pptx.author = "Obsidian Office Viewer";
  pptx.company = "Obsidian Office Viewer";
  pptx.subject = "Speaker-note viewing fixture";
  pptx.title = "Speaker notes fixture";
  pptx.lang = "en-US";
  pptx.layout = "LAYOUT_WIDE";
  pptx.theme = {
    headFontFace: "Arial",
    bodyFontFace: "Arial",
    lang: "en-US",
  };

  const withNotes = pptx.addSlide();
  withNotes.background = { color: "FFFFFF" };
  withNotes.addText("Slide with author notes", {
    x: 1,
    y: 2.6,
    w: 11.333,
    h: 0.7,
    align: "center",
    color: "1F2937",
    fontFace: "Arial",
    fontSize: 28,
    bold: true,
    margin: 0,
  });
  withNotes.addNotes(
    [
      "AUTHOR_NOTE_P1 First author paragraph",
      "AUTHOR_NOTE_P2 Second author paragraph",
      "讲者备注标记 NOTE_ZH_HANS",
      "講者備註標記 NOTE_ZH_HANT",
    ].join("\n"),
  );

  const emptyNotes = pptx.addSlide();
  emptyNotes.background = { color: "FFFFFF" };
  emptyNotes.addText("Slide with empty notes part", {
    x: 1,
    y: 2.6,
    w: 11.333,
    h: 0.7,
    align: "center",
    color: "1F2937",
    fontFace: "Arial",
    fontSize: 28,
    bold: true,
    margin: 0,
  });

  const noNotes = pptx.addSlide();
  noNotes.background = { color: "FFFFFF" };
  noNotes.addText("Slide without notes relationship", {
    x: 1,
    y: 2.6,
    w: 11.333,
    h: 0.7,
    align: "center",
    color: "1F2937",
    fontFace: "Arial",
    fontSize: 28,
    bold: true,
    margin: 0,
  });

  await pptx.writeFile({ fileName: fixturePath, compression: true });

  const zip = await JSZip.loadAsync(await readFile(fixturePath));

  const notesSlide1 = zip.file("ppt/notesSlides/notesSlide1.xml");
  if (!notesSlide1) {
    throw new Error("Expected notesSlide1.xml from pptxgenjs");
  }
  const authorParagraphs = [
    "AUTHOR_NOTE_P1 First author paragraph",
    "AUTHOR_NOTE_P2 Second author paragraph",
    "讲者备注标记 NOTE_ZH_HANS",
    "講者備註標記 NOTE_ZH_HANT",
  ];
  const authorBody = authorParagraphs
    .map(
      (text) =>
        `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${text}</a:t></a:r><a:endParaRPr lang="en-US" dirty="0"/></a:p>`,
    )
    .join("");
  let notesXml = await notesSlide1.async("text");
  notesXml = notesXml.replace(
    /<p:txBody><a:bodyPr\/><a:lstStyle\/><a:p><a:r><a:rPr lang="en-US" dirty="0"\/><a:t>[\s\S]*?<\/a:t><\/a:r><a:endParaRPr lang="en-US" dirty="0"\/><\/a:p><\/p:txBody>/,
    `<p:txBody><a:bodyPr/><a:lstStyle/>${authorBody}</p:txBody>`,
  );
  notesXml = notesXml.replace(
    /(<p:ph type="sldNum"[^/]*\/>[\s\S]*?<a:fld[^>]*>[\s\S]*?<a:t>)[^<]*(<\/a:t>)/,
    "$1DECOY_SLIDE_NUMBER$2",
  );
  zip.file("ppt/notesSlides/notesSlide1.xml", notesXml);

  const notesSlide2 = zip.file("ppt/notesSlides/notesSlide2.xml");
  if (notesSlide2) {
    let emptyNotesXml = await notesSlide2.async("text");
    emptyNotesXml = emptyNotesXml.replace(
      /(<p:ph type="sldNum"[^/]*\/>[\s\S]*?<a:fld[^>]*>[\s\S]*?<a:t>)[^<]*(<\/a:t>)/,
      "$1DECOY_SLIDE_NUMBER$2",
    );
    zip.file("ppt/notesSlides/notesSlide2.xml", emptyNotesXml);
  }

  const notesMaster = zip.file("ppt/notesMasters/notesMaster1.xml");
  if (!notesMaster) {
    throw new Error("Expected notesMaster1.xml from pptxgenjs");
  }
  let masterXml = await notesMaster.async("text");
  masterXml = masterXml.replace(
    /(<p:ph type="hdr"[^/]*\/>[\s\S]*?<a:p>)([\s\S]*?)(<\/a:p>)/,
    "$1<a:r><a:t>DECOY_NOTES_MASTER_HEADER</a:t></a:r>$3",
  );
  masterXml = masterXml.replace(
    /(<p:ph type="dt"[^/]*\/>[\s\S]*?<a:fld[^>]*>[\s\S]*?<a:t>)[^<]*(<\/a:t>)/,
    "$1DECOY_NOTES_MASTER_DATE$2",
  );
  if (masterXml.includes('type="ftr"')) {
    masterXml = masterXml.replace(
      /(<p:ph type="ftr"[^/]*\/>[\s\S]*?<a:p>)([\s\S]*?)(<\/a:p>)/,
      "$1<a:r><a:t>DECOY_NOTES_MASTER_FOOTER</a:t></a:r>$3",
    );
  } else {
    masterXml = masterXml.replace(
      "</p:spTree>",
      `<p:sp><p:nvSpPr><p:cNvPr id="99" name="Footer Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ftr" sz="quarter" idx="4"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>DECOY_NOTES_MASTER_FOOTER</a:t></a:r></a:p></p:txBody></p:sp></p:spTree>`,
    );
  }
  zip.file("ppt/notesMasters/notesMaster1.xml", masterXml);

  // Remove the third slide's notes relationship and part so "no notes" is
  // distinguishable from an empty notes body.
  const slide3Rels = zip.file("ppt/slides/_rels/slide3.xml.rels");
  if (slide3Rels) {
    let relsXml = await slide3Rels.async("text");
    relsXml = relsXml.replace(
      /<Relationship\b[^>]*Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/notesSlide"[^>]*\/>/,
      "",
    );
    zip.file("ppt/slides/_rels/slide3.xml.rels", relsXml);
  }
  zip.remove("ppt/notesSlides/notesSlide3.xml");
  zip.remove("ppt/notesSlides/_rels/notesSlide3.xml.rels");

  const contentTypes = zip.file("[Content_Types].xml");
  if (contentTypes) {
    let typesXml = await contentTypes.async("text");
    typesXml = typesXml.replace(
      /<Override[^>]*PartName="\/ppt\/notesSlides\/notesSlide3\.xml"[^/]*\/>/,
      "",
    );
    zip.file("[Content_Types].xml", typesXml);
  }

  const patched = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  await writeFile(fixturePath, patched);
}

await copyFile(fixturePath, vaultPath);
process.stdout.write(`${fixturePath}\n`);
