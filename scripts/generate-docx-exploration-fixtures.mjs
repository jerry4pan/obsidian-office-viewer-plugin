import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import JSZip from "jszip";

const roots = [
  path.resolve("tests/fixtures/docx-exploration"),
  path.resolve("tests/vault/docx-exploration"),
];

const W =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const W14 = "http://schemas.microsoft.com/office/word/2010/wordml";
const R =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const M =
  "http://schemas.openxmlformats.org/officeDocument/2006/math";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const WP =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const PIC =
  "http://schemas.openxmlformats.org/drawingml/2006/picture";
const C =
  "http://schemas.openxmlformats.org/drawingml/2006/chart";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const fixedZipDate = new Date("1980-01-01T00:00:00.000Z");

function addZipFile(zip, partPath, contents) {
  zip.file(partPath, contents, {
    createFolders: false,
    date: fixedZipDate,
  });
}

function paragraph(id, text, options = {}) {
  const identity = id === null ? "" : ` w14:paraId="${id}"`;
  const style = options.style
    ? `<w:pPr><w:pStyle w:val="${options.style}"/></w:pPr>`
    : options.list
      ? `<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>`
      : "";
  const bookmark = options.bookmark
    ? `<w:bookmarkStart w:id="${options.bookmarkId ?? 1}" w:name="${options.bookmark}"/>`
    : "";
  return `<w:p${identity}>${style}${bookmark}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function contentTypes(extra = "") {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Default Extension="png" ContentType="image/png"/>
      <Override PartName="/word/document.xml"
        ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      <Override PartName="/word/styles.xml"
        ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
      <Override PartName="/word/numbering.xml"
        ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
      ${extra}
    </Types>`;
}

const rootRelationships = `<?xml version="1.0" encoding="UTF-8"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1"
      Type="${R}/officeDocument"
      Target="word/document.xml"/>
  </Relationships>`;

const styles = `<?xml version="1.0" encoding="UTF-8"?>
  <w:styles xmlns:w="${W}">
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
      <w:name w:val="Normal"/>
    </w:style>
    <w:style w:type="paragraph" w:styleId="Heading1">
      <w:name w:val="heading 1"/>
      <w:basedOn w:val="Normal"/>
      <w:next w:val="Normal"/>
      <w:uiPriority w:val="9"/>
      <w:qFormat/>
      <w:pPr><w:outlineLvl w:val="0"/></w:pPr>
    </w:style>
  </w:styles>`;

const numbering = `<?xml version="1.0" encoding="UTF-8"?>
  <w:numbering xmlns:w="${W}">
    <w:abstractNum w:abstractNumId="0">
      <w:lvl w:ilvl="0">
        <w:start w:val="1"/>
        <w:numFmt w:val="bullet"/>
        <w:lvlText w:val="•"/>
      </w:lvl>
    </w:abstractNum>
    <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  </w:numbering>`;

function mainDocument(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="${W}" xmlns:w14="${W14}" xmlns:r="${R}"
      xmlns:m="${M}" xmlns:a="${A}" xmlns:wp="${WP}" xmlns:pic="${PIC}"
      xmlns:c="${C}">
      <w:body>${body}<w:sectPr/></w:body>
    </w:document>`;
}

async function packageDocx({
  body,
  relationships = "",
  extraContentTypes = "",
  extraParts = {},
}) {
  const zip = new JSZip();
  addZipFile(zip, "[Content_Types].xml", contentTypes(extraContentTypes));
  addZipFile(zip, "_rels/.rels", rootRelationships);
  addZipFile(zip, "word/document.xml", mainDocument(body));
  addZipFile(zip, "word/styles.xml", styles);
  addZipFile(zip, "word/numbering.xml", numbering);
  addZipFile(
    zip,
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rStyles" Type="${R}/styles" Target="styles.xml"/>
        <Relationship Id="rNumbering" Type="${R}/numbering" Target="numbering.xml"/>
        ${relationships}
      </Relationships>`,
  );
  for (const [partPath, contents] of Object.entries(extraParts)) {
    addZipFile(zip, partPath, contents);
  }
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

const imageDrawing = `
  <w:r><w:drawing><wp:inline>
    <wp:extent cx="914400" cy="914400"/>
    <wp:effectExtent l="0" t="0" r="0" b="0"/>
    <wp:docPr id="1" name="Evidence image"/>
    <wp:cNvGraphicFramePr/>
    <a:graphic><a:graphicData uri="${PIC}">
      <pic:pic>
        <pic:nvPicPr>
          <pic:cNvPr id="1" name="Evidence image"/>
          <pic:cNvPicPr/>
        </pic:nvPicPr>
        <pic:blipFill>
          <a:blip r:embed="rImage"/>
          <a:stretch><a:fillRect/></a:stretch>
        </pic:blipFill>
        <pic:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="914400" cy="914400"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </pic:spPr>
      </pic:pic>
    </a:graphicData></a:graphic>
  </wp:inline></w:drawing></w:r>`;

const fixtures = new Map();

fixtures.set(
  "body-led-reference.docx",
  await packageDocx({
    relationships: `
      <Relationship Id="rImage" Type="${R}/image" Target="media/evidence.png"/>
      <Relationship Id="rWeb" Type="${R}/hyperlink"
        Target="https://example.com/evidence" TargetMode="External"/>
      <Relationship Id="rMail" Type="${R}/hyperlink"
        Target="mailto:research@example.com" TargetMode="External"/>
    `,
    extraParts: { "word/media/evidence.png": onePixelPng },
    body: `
      ${paragraph("10000001", "Market outlook", { style: "Heading1", bookmark: "Outlook" })}
      <w:p w14:paraId="10000002">
        <w:r><w:t>Demand remains resilient. </w:t></w:r>
        <w:hyperlink r:id="rWeb"><w:r><w:t>Supporting evidence</w:t></w:r></w:hyperlink>
      </w:p>
      ${paragraph("10000003", "Local processing protects confidential reports.", { list: true })}
      ${paragraph("10000004", "Document search keeps source text local.", { list: true })}
      <w:tbl><w:tr>
        <w:tc>${paragraph("10000005", "Region")}</w:tc>
        <w:tc>${paragraph("10000006", "Growth")}</w:tc>
      </w:tr><w:tr>
        <w:tc>${paragraph("10000007", "Asia")}</w:tc>
        <w:tc>${paragraph("10000008", "5 percent")}</w:tc>
      </w:tr></w:tbl>
      <w:p w14:paraId="10000009"><w:r><w:t>Inline evidence image</w:t></w:r>${imageDrawing}</w:p>
      <w:p w14:paraId="1000000A">
        <w:hyperlink w:anchor="Outlook"><w:r><w:t>Return to outlook</w:t></w:r></w:hyperlink>
        <w:r><w:t xml:space="preserve"> or </w:t></w:r>
        <w:hyperlink r:id="rMail"><w:r><w:t>contact research</w:t></w:r></w:hyperlink>
      </w:p>
      ${paragraph("1000000B", "中文段落验证本地阅读和搜索。")}
    `,
  }),
);

fixtures.set(
  "read-search-only.docx",
  await packageDocx({
    body:
      paragraph("20000001", "This paragraph has a native identity.") +
      paragraph(null, "This generated paragraph has no native identity."),
  }),
);

fixtures.set(
  "final-revisions.docx",
  await packageDocx({
    body: `
      <w:p w14:paraId="30000001">
        <w:r><w:t>Approved </w:t></w:r>
        <w:ins w:id="1"><w:r><w:t>new language</w:t></w:r></w:ins>
        <w:del w:id="2"><w:r><w:delText>old language</w:delText></w:r></w:del>
        <w:r><w:rPr><w:vanish/></w:rPr><w:t> hidden text</w:t></w:r>
      </w:p>
    `,
  }),
);

fixtures.set(
  "unavailable-content.docx",
  await packageDocx({
    relationships: `
      <Relationship Id="rExternalImage" Type="${R}/image"
        Target="https://example.com/private.png" TargetMode="External"/>
      <Relationship Id="rChart" Type="${R}/chart" Target="charts/chart1.xml"/>
      <Relationship Id="rChunk" Type="${R}/aFChunk" Target="chunks/content.html"/>
    `,
    extraParts: {
      "word/chunks/content.html": "<script>alert(1)</script>",
      "word/charts/chart1.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <c:chartSpace xmlns:c="${C}"><c:chart/></c:chartSpace>`,
    },
    extraContentTypes: `
      <Override PartName="/word/charts/chart1.xml"
        ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
    `,
    body: `
      ${paragraph("40000001", "Visible before unavailable content.")}
      <w:p w14:paraId="40000002"><w:object/></w:p>
      <w:p w14:paraId="40000003">
        <w:r><w:t>Equation follows.</w:t></w:r>
        <m:oMath><m:r><m:t>x+y</m:t></m:r></m:oMath>
      </w:p>
      <w:p w14:paraId="40000004">
        <w:r><w:t>External image follows.</w:t></w:r>
        <w:r><w:drawing><a:blip r:embed="rExternalImage"/></w:drawing></w:r>
      </w:p>
      <w:p w14:paraId="40000005">
        <w:r><w:drawing>
          <wp:inline>
            <wp:extent cx="5486400" cy="3200400"/>
            <a:graphic><a:graphicData uri="${C}">
              <c:chart r:id="rChart"/>
            </a:graphicData></a:graphic>
          </wp:inline>
        </w:drawing></w:r>
      </w:p>
      <w:altChunk r:id="rChunk"/>
      ${paragraph("40000006", "Visible after unavailable content.")}
    `,
  }),
);

fixtures.set(
  "active-content.docx",
  await packageDocx({
    body: paragraph("50000001", "Active content must fail safely."),
    extraContentTypes: `
      <Override PartName="/word/vbaProject.bin"
        ContentType="application/vnd.ms-office.vbaProject"/>
    `,
    extraParts: { "word/vbaProject.bin": Buffer.from([1, 2, 3, 4]) },
  }),
);

const representativeParagraphs = Array.from({ length: 1_000 }, (_, index) =>
  paragraph(
    (0x60000000 + index).toString(16).toUpperCase().padStart(8, "0"),
    `Representative paragraph ${index + 1}: local DOCX reading and search evidence.`,
  )
).join("");
fixtures.set(
  "performance-representative-1000-paragraphs.docx",
  await packageDocx({ body: representativeParagraphs }),
);

const stressParagraphs = Array.from({ length: 5_000 }, (_, index) =>
  paragraph(
    (0x70000000 + index).toString(16).toUpperCase().padStart(8, "0"),
    `Stress paragraph ${index + 1}: bounded document rendering evidence.`,
  )
).join("");
fixtures.set(
  "performance-stress-5000-paragraphs.docx",
  await packageDocx({ body: stressParagraphs }),
);

const manifest = {
  generatedAt: "2026-07-31",
  generator: "scripts/generate-docx-exploration-fixtures.mjs",
  fixtures: [
    {
      path: "body-led-reference.docx",
      expected: "readable-body-led",
    },
    {
      path: "read-search-only.docx",
      expected: "readable-searchable",
    },
    {
      path: "final-revisions.docx",
      expected: "final-body-text-only",
    },
    {
      path: "unavailable-content.docx",
      expected: "readable-with-visible-degradation",
    },
    { path: "active-content.docx", expected: "incompatible" },
    {
      path: "performance-representative-1000-paragraphs.docx",
      expected: "performance-representative",
    },
    {
      path: "performance-stress-5000-paragraphs.docx",
      expected: "performance-stress",
    },
  ],
};

for (const root of roots) {
  await mkdir(root, { recursive: true });
  for (const [name, bytes] of fixtures) {
    await writeFile(path.join(root, name), bytes);
  }
  await writeFile(
    path.join(root, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

console.log(`Generated ${fixtures.size} DOCX exploration fixtures.`);
