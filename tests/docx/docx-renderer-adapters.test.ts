import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { inspectDocxPackage } from "../../src/docx/docx-semantic-model";
import {
  mapRenderedParagraphs,
  sanitizeRenderedDocx,
  type DocxRendererAdapter,
} from "../../src/docx/renderer/docx-renderer-adapter";
import { DocxPreviewRendererAdapter } from "../../src/docx/renderer/docx-preview-renderer-adapter";

const W =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const W14 = "http://schemas.microsoft.com/office/word/2010/wordml";

async function rendererFixture(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml"
          ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1"
          Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
          Target="word/document.xml"/>
      </Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="${W}" xmlns:w14="${W14}">
        <w:body>
          <w:p w14:paraId="00000001">
            <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
            <w:r><w:t>Quarterly outlook</w:t></w:r>
          </w:p>
          <w:p w14:paraId="00000002">
            <w:r><w:t>Demand remains resilient.</w:t></w:r>
          </w:p>
          <w:tbl><w:tr><w:tc>
            <w:p w14:paraId="00000003">
              <w:r><w:t>Table evidence</w:t></w:r>
            </w:p>
          </w:tc></w:tr></w:tbl>
          <w:sectPr/>
        </w:body>
      </w:document>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("DOCX renderer mapping and sanitization", () => {
  it("maps only exact semantic paragraph text in document order", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <h1>Quarterly outlook</h1>
      <p>Demand remains resilient.</p>
    `;
    const mapping = mapRenderedParagraphs(container, [
      {
        ordinal: 1,
        text: "Quarterly outlook",
        searchText: "quarterly outlook",
        styleId: "Heading1",
        listItem: false,
        tableDepth: 0,
        bookmarks: [],
        hyperlinks: [],
        inlineImageCount: 0,
        unavailableContent: [],
      },
      {
        ordinal: 2,
        text: "Demand remains resilient.",
        searchText: "demand remains resilient.",
        styleId: null,
        listItem: false,
        tableDepth: 0,
        bookmarks: [],
        hyperlinks: [],
        inlineImageCount: 0,
        unavailableContent: [],
      },
    ]);

    expect(mapping.get(2)?.dataset.docxParagraphOrdinal).toBe("2");
    expect(() =>
      mapRenderedParagraphs(container, [
        {
          ordinal: 1,
          text: "Different text",
          searchText: "different text",
          styleId: null,
          listItem: false,
          tableDepth: 0,
          bookmarks: [],
          hyperlinks: [],
          inlineImageCount: 0,
          unavailableContent: [],
        },
        {
          ordinal: 2,
          text: "Demand remains resilient.",
          searchText: "demand remains resilient.",
          styleId: null,
          listItem: false,
          tableDepth: 0,
          bookmarks: [],
          hyperlinks: [],
          inlineImageCount: 0,
          unavailableContent: [],
        },
      ])
    ).toThrow(/does not match/);
  });

  it("blocks active DOM and unsafe navigation while retaining allowlisted links", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <script>window.bad = true</script>
      <a id="safe" href="https://example.com">safe</a>
      <a id="local" href="file:///tmp/private">local</a>
      <a id="bookmark" href="#Target">jump</a>
      <img id="remote" src="https://example.com/private.png">
      <img id="inline" src="data:image/png;base64,AA==">
    `;

    sanitizeRenderedDocx(container);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("#safe")?.getAttribute("href")).toBe(
      "https://example.com",
    );
    expect(container.querySelector("#local")?.getAttribute("href")).toBeNull();
    expect(
      (container.querySelector("#bookmark") as HTMLElement | null)?.dataset
        .docxBookmark,
    ).toBe("Target");
    expect(container.querySelector("#remote")?.getAttribute("src")).toBeNull();
    expect(container.querySelector("#inline")?.getAttribute("src")).toContain(
      "data:image/png",
    );
  });
});

describe("docx-preview renderer adapter", () => {
  const createAdapter = () => new DocxPreviewRendererAdapter();
  it("maps the same fixture to the project-owned semantic paragraphs", async () => {
    const bytes = await rendererFixture();
    const signal = new AbortController().signal;
    const model = await inspectDocxPackage(bytes, signal);
    const container = document.createElement("div");
    const adapter: DocxRendererAdapter = createAdapter();

    const session = await adapter.open(bytes, container, model, signal);

    expect(session.paragraphElements.size).toBe(3);
    expect(session.paragraphElements.get(1)?.textContent).toContain(
      "Quarterly outlook",
    );
    expect(session.paragraphElements.get(3)?.textContent).toContain(
      "Table evidence",
    );
    expect(container.querySelectorAll("[data-docx-paragraph-ordinal]"))
      .toHaveLength(3);
    session.dispose();
    expect(container.childElementCount).toBe(0);
  });

  it("does not mutate the destination when already aborted", async () => {
    const bytes = await rendererFixture();
    const controller = new AbortController();
    controller.abort();
    const model = await inspectDocxPackage(
      bytes,
      new AbortController().signal,
    );
    const container = document.createElement("div");
    container.textContent = "unchanged";

    await expect(
      createAdapter().open(bytes, container, model, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(container.textContent).toBe("unchanged");
  });
});
