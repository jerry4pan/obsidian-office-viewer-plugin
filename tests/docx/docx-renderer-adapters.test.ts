import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { inspectDocxPackage } from "../../src/docx/docx-semantic-model";
import {
  mapRenderedParagraphs,
  prepareRenderedDocxReadingLayout,
  revealParagraphFragment,
  sanitizeRenderedDocx,
  type DocxRendererAdapter,
} from "../../src/docx/renderer/docx-renderer-adapter";
import { DocxPreviewRendererAdapter } from "../../src/docx/renderer/docx-preview-renderer-adapter";

const W =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const W14 = "http://schemas.microsoft.com/office/word/2010/wordml";

function semanticParagraph(
  ordinal: number,
  text: string,
  styleId: string | null = null,
) {
  return {
    ordinal,
    text,
    searchText: text.toLocaleLowerCase(),
    styleId,
    listItem: false,
    tableDepth: 0,
    bookmarks: [],
    hyperlinks: [],
    inlineImageCount: 0,
    unavailableContent: [],
  };
}

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

async function layoutPagesFixture(): Promise<ArrayBuffer> {
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
            <w:r><w:t>Before page break</w:t></w:r>
            <w:r><w:br w:type="page"/></w:r>
            <w:r><w:t>After page break unique marker</w:t></w:r>
          </w:p>
          <w:p w14:paraId="00000002">
            <w:r><w:t>Second paragraph</w:t></w:r>
          </w:p>
          <w:sectPr>
            <w:pgSz w:w="12240" w:h="15840"/>
            <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
          </w:sectPr>
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
      semanticParagraph(1, "Quarterly outlook", "Heading1"),
      semanticParagraph(2, "Demand remains resilient."),
    ]);

    expect(mapping.get(2)?.dataset.docxParagraphOrdinal).toBe("2");
    expect(() =>
      mapRenderedParagraphs(container, [
        semanticParagraph(1, "Different text"),
        semanticParagraph(2, "Demand remains resilient."),
      ]),
    ).toThrow(/does not match|fragments do not match/);
  });

  it("maps consecutive fragments of one semantic paragraph", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <section class="docx">
        <p>Before page break</p>
      </section>
      <section class="docx">
        <p>After page break unique marker</p>
        <p>Second paragraph</p>
      </section>
    `;
    const mapping = mapRenderedParagraphs(container, [
      semanticParagraph(1, "Before page breakAfter page break unique marker"),
      semanticParagraph(2, "Second paragraph"),
    ]);
    const fragments = container.querySelectorAll(
      '[data-docx-paragraph-ordinal="1"]',
    );
    expect(fragments).toHaveLength(2);
    expect(mapping.get(1)).toBe(fragments[0]);
    expect(
      revealParagraphFragment(
        container,
        mapping,
        1,
        "unique marker",
      )?.textContent,
    ).toContain("unique marker");
  });

  it("fails when fragment concatenation mismatches or reorders", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <p>Alpha</p>
      <p>Gamma</p>
      <p>Beta</p>
    `;
    expect(() =>
      mapRenderedParagraphs(container, [
        semanticParagraph(1, "AlphaBeta"),
        semanticParagraph(2, "Gamma"),
      ]),
    ).toThrow(/does not match|fragments do not match/);
  });

  it("ignores header and footer text during mapping", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <header><p>Header twin</p></header>
      <p>Header twin</p>
      <p>Body only</p>
      <footer><p>Body only</p></footer>
    `;
    const mapping = mapRenderedParagraphs(container, [
      semanticParagraph(1, "Header twin"),
      semanticParagraph(2, "Body only"),
    ]);
    expect(mapping.size).toBe(2);
    expect(
      (container.querySelector("header p") as HTMLElement | null)?.dataset
        .docxParagraphOrdinal,
    ).toBeUndefined();
    expect(
      (container.querySelector("footer p") as HTMLElement | null)?.dataset
        .docxParagraphOrdinal,
    ).toBeUndefined();
  });

  it("treats hyperlink break whitespace as equivalent for mapping", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <p>【腾讯文档】记录https://docs.qq.com/sheet/A</p>
      <p>Next paragraph</p>
    `;
    const mapping = mapRenderedParagraphs(container, [
      semanticParagraph(1, "【腾讯文档】记录\nhttps://docs.qq.com/sheet/A"),
      semanticParagraph(2, "Next paragraph"),
    ]);
    expect(mapping.get(1)?.dataset.docxParagraphOrdinal).toBe("1");
    expect(mapping.size).toBe(2);
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

  it("marks fixed-size docx-preview content for responsive reading", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <section class="docx">
        <div id="large" style="display: inline-block; width: 428.65pt; height: 172.2pt">
          <img id="large-image" src="data:image/png;base64,AA==" style="width: 428.65pt; height: 172.2pt">
        </div>
        <div id="small" style="display: inline-block; width: 72pt; height: 66pt">
          <img id="small-image" src="data:image/png;base64,AA==" style="width: 72pt; height: 66pt">
        </div>
        <div id="complex" style="display: inline-block; width: 200pt">
          <span>caption</span>
          <img id="complex-image" src="data:image/png;base64,AA==">
        </div>
        <table id="wide-table" style="width: 457.95pt">
          <colgroup><col id="narrow-column" style="width: 100pt"><col id="wide-column" style="width: 300pt"></colgroup>
          <tr><td>Label</td><td>Evidence</td></tr>
        </table>
      </section>
    `;

    prepareRenderedDocxReadingLayout(container);

    const large = container.querySelector<HTMLElement>("#large");
    const small = container.querySelector<HTMLElement>("#small");
    expect(large?.classList.contains("office-viewer-docx-media-wrapper")).toBe(
      true,
    );
    expect(
      large?.style.getPropertyValue("--office-viewer-docx-media-width"),
    ).toBe("428.65pt");
    expect(small?.classList.contains("office-viewer-docx-media-wrapper")).toBe(
      true,
    );
    expect(
      small?.style.getPropertyValue("--office-viewer-docx-media-width"),
    ).toBe("72pt");
    expect(
      container
        .querySelector("#complex")
        ?.classList.contains("office-viewer-docx-media-wrapper"),
    ).toBe(false);
    expect(
      Array.from(container.querySelectorAll("img")).every((image) =>
        image.classList.contains("office-viewer-docx-media"),
      ),
    ).toBe(true);
    const table = container.querySelector<HTMLElement>("#wide-table");
    expect(table?.classList.contains("office-viewer-docx-table")).toBe(true);
    expect(
      table?.style.getPropertyValue("--office-viewer-docx-table-width"),
    ).toBe("457.95pt");
    expect(
      container
        .querySelector<HTMLElement>("#narrow-column")
        ?.style.getPropertyValue("--office-viewer-docx-column-width"),
    ).toBe("25%");
    expect(
      container
        .querySelector<HTMLElement>("#wide-column")
        ?.style.getPropertyValue("--office-viewer-docx-column-width"),
    ).toBe("75%");
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

    const session = await adapter.open(bytes, model, {
      mode: "reading",
      signal,
    });
    expect(container.childElementCount).toBe(0);
    session.mount(container);

    expect(session.mode).toBe("reading");
    expect(session.supportedModes).toEqual(["reading", "layout"]);
    expect(session.paragraphAnchors.size).toBe(3);
    expect(session.paragraphAnchors.get(1)?.textContent).toContain(
      "Quarterly outlook",
    );
    expect(session.paragraphAnchors.get(3)?.textContent).toContain(
      "Table evidence",
    );
    expect(container.querySelectorAll("[data-docx-paragraph-ordinal]"))
      .toHaveLength(3);
    expect(container.querySelector(".office-viewer-docx--reading")).not.toBeNull();
    session.dispose();
    expect(container.childElementCount).toBe(0);
  });

  it("renders layout pages without mutating destination until mount", async () => {
    const bytes = await layoutPagesFixture();
    const signal = new AbortController().signal;
    const model = await inspectDocxPackage(bytes, signal);
    const container = document.createElement("div");
    container.textContent = "unchanged";
    const session = await createAdapter().open(bytes, model, {
      mode: "layout",
      signal,
    });
    expect(container.textContent).toBe("unchanged");
    session.mount(container);
    expect(session.mode).toBe("layout");
    expect(container.querySelector(".office-viewer-docx--layout")).not.toBeNull();
    expect(container.querySelectorAll("section.docx").length).toBeGreaterThan(1);
    expect(session.paragraphAnchors.size).toBe(model.paragraphs.length);
    session.dispose();
  });

  it("keeps a readable preview when only one hyperlink paragraph disagrees on whitespace", async () => {
    const zip = new JSZip();
    const R =
      "http://schemas.openxmlformats.org/package/2006/relationships";
    const PR =
      "http://schemas.openxmlformats.org/package/2006/content-types";
    const OR =
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8"?>
        <Types xmlns="${PR}">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/word/document.xml"
            ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        </Types>`,
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="${R}">
          <Relationship Id="rId1" Type="${OR}/officeDocument" Target="word/document.xml"/>
        </Relationships>`,
    );
    zip.file(
      "word/_rels/document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="${R}">
          <Relationship Id="rId1" Type="${OR}/hyperlink"
            Target="https://docs.qq.com/sheet/A" TargetMode="External"/>
        </Relationships>`,
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
        <w:document xmlns:w="${W}" xmlns:r="${OR}" xmlns:w14="${W14}">
          <w:body>
            <w:p w14:paraId="00000001">
              <w:r><w:t>Before</w:t></w:r>
            </w:p>
            <w:p w14:paraId="00000002">
              <w:r><w:t>【腾讯文档】记录</w:t></w:r>
              <w:r><w:br/></w:r>
              <w:hyperlink r:id="rId1">
                <w:r><w:t>https://docs.qq.com/sheet/A</w:t></w:r>
              </w:hyperlink>
            </w:p>
            <w:p w14:paraId="00000003">
              <w:r><w:t>After</w:t></w:r>
            </w:p>
            <w:sectPr/>
          </w:body>
        </w:document>`,
    );
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    const signal = new AbortController().signal;
    const model = await inspectDocxPackage(bytes, signal);
    const container = document.createElement("div");
    const session = await createAdapter().open(bytes, model, {
      mode: "reading",
      signal,
    });
    session.mount(container);
    expect(session.candidate).toBe("docx-preview");
    expect(session.paragraphAnchors.size).toBe(model.paragraphs.length);
    expect(container.textContent).toContain("【腾讯文档】记录");
    expect(container.textContent).toContain("https://docs.qq.com/sheet/A");
    session.dispose();
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
      createAdapter().open(bytes, model, {
        mode: "reading",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(container.textContent).toBe("unchanged");
  });
});
