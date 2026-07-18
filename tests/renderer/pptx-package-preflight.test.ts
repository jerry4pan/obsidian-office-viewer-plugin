import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import CFB from "cfb";
import JSZip from "jszip";
import { inspectPptxPackage } from "../../src/renderer/pptx-package-preflight";
import type { PptxOpenErrorCategory } from "../../src/pptx-open-error";
import {
  expectedFailureFixtures,
  fixturePath,
  safeRenderFixtures,
} from "../failure/failure-fixtures";

async function loadFixture(relativePath: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path.resolve(relativePath));
  return Uint8Array.from(bytes).buffer;
}

describe("PPTX package preflight", () => {
  afterEach(() => vi.restoreAllMocks());

  it("accepts the supported smoke-test package", async () => {
    await expect(
      inspectPptxPackage(
        await loadFixture("tests/fixtures/minimal.pptx"),
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      declaredFonts: ["Arial"],
      slideIdentities: [256],
      sourceAuthoredSlideText: [{
        slideId: 256,
        text: ["Obsidian PPTX smoke test"],
      }],
      warningCategories: [],
    });
  });

  it("reports ordered unique native slide identities", async () => {
    const inspection = await inspectPptxPackage(
      await loadFixture(
        "tests/fixtures/performance/m2-representative-50-slides.pptx",
      ),
      new AbortController().signal,
    );

    expect(inspection.slideIdentities).toHaveLength(50);
    expect(new Set(inspection.slideIdentities).size).toBe(50);
    expect(inspection.slideIdentities.slice(0, 3)).toEqual([256, 257, 258]);
    expect(inspection.sourceAuthoredSlideText!.map(({ slideId }) => slideId))
      .toEqual(inspection.slideIdentities);
  });

  it("collects only source-authored slide text", async () => {
    const zip = await JSZip.loadAsync(
      await loadFixture("tests/fixtures/compatibility/tables-charts.pptx"),
    );
    const chart = zip.file("ppt/charts/chart1.xml")!;
    zip.file(
      "ppt/charts/chart1.xml",
      (await chart.async("text")).replace(
        "<c:v>FY26 plan</c:v>",
        "<c:v>Chart only secret</c:v>",
      ),
    );
    const notes = zip.file("ppt/notesSlides/notesSlide1.xml")!;
    zip.file(
      "ppt/notesSlides/notesSlide1.xml",
      (await notes.async("text")).replace(
        "</p:spTree>",
        "<p:sp><p:txBody><a:p><a:r><a:t>Notes only secret</a:t></a:r></a:p></p:txBody></p:sp></p:spTree>",
      ),
    );
    const master = zip.file("ppt/slideMasters/slideMaster1.xml")!;
    zip.file(
      "ppt/slideMasters/slideMaster1.xml",
      (await master.async("text")).replace(
        "</p:spTree>",
        "<p:sp><p:txBody><a:p><a:r><a:t>Master only secret</a:t></a:r></a:p></p:txBody></p:sp></p:spTree>",
      ),
    );

    const inspection = await inspectPptxPackage(
      await zip.generateAsync({ type: "arraybuffer" }),
      new AbortController().signal,
    );
    const text = inspection.sourceAuthoredSlideText![0]?.text ?? [];

    expect(text).toContain("Regional performance");
    expect(text).toContain("FY26 plan");
    expect(text).toContain("North");
    expect(text).not.toContain("Chart only secret");
    expect(text).not.toContain("Notes only secret");
    expect(text).not.toContain("Master only secret");
  });

  it("keeps optional source-authored text extraction failure non-fatal", async () => {
    const original = Document.prototype.getElementsByTagNameNS;
    vi.spyOn(Document.prototype, "getElementsByTagNameNS").mockImplementation(
      function (this: Document, namespace, localName) {
        if (localName === "p" && this.documentElement?.localName === "sld") {
          throw new Error("optional text extraction failed");
        }
        return original.call(this, namespace, localName);
      },
    );

    await expect(inspectPptxPackage(
      await loadFixture("tests/fixtures/minimal.pptx"),
      new AbortController().signal,
    )).resolves.toMatchObject({
      slideIdentities: [256],
      sourceAuthoredSlideText: undefined,
    });
  });

  it("rejects duplicate native slide identities", async () => {
    const zip = await JSZip.loadAsync(
      await loadFixture(
        "tests/fixtures/performance/representative-12-slides.pptx",
      ),
    );
    const presentation = zip.file("ppt/presentation.xml")!;
    const xml = await presentation.async("text");
    const ids = [...xml.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)];
    expect(ids.length).toBeGreaterThan(1);
    zip.file(
      "ppt/presentation.xml",
      xml.replace(`id="${ids[1]![1]}"`, `id="${ids[0]![1]}"`),
    );

    await expect(
      inspectPptxPackage(
        await zip.generateAsync({ type: "arraybuffer" }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "malformed" });
  });

  it("ignores PowerPoint section-extension slide identity references", async () => {
    const zip = await JSZip.loadAsync(
      await loadFixture("tests/fixtures/minimal.pptx"),
    );
    const presentation = zip.file("ppt/presentation.xml")!;
    const xml = await presentation.async("text");
    zip.file(
      "ppt/presentation.xml",
      xml.replace(
        "</p:presentation>",
        '<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"><p14:section name="Section 1" id="{00000000-0000-0000-0000-000000000001}"><p14:sldIdLst><p14:sldId id="256"/></p14:sldIdLst></p14:section></p14:sectionLst></p:ext></p:extLst></p:presentation>',
      ),
    );

    await expect(inspectPptxPackage(
      await zip.generateAsync({ type: "arraybuffer" }),
      new AbortController().signal,
    )).resolves.toMatchObject({ slideIdentities: [256] });
  });

  it.each([255, 2_147_483_648])(
    "rejects out-of-range native slide identity %s",
    async (invalidId) => {
      const zip = await JSZip.loadAsync(
        await loadFixture("tests/fixtures/minimal.pptx"),
      );
      const presentation = zip.file("ppt/presentation.xml")!;
      const xml = await presentation.async("text");
      zip.file(
        "ppt/presentation.xml",
        xml.replace('id="256"', `id="${invalidId}"`),
      );

      await expect(inspectPptxPackage(
        await zip.generateAsync({ type: "arraybuffer" }),
        new AbortController().signal,
      )).rejects.toMatchObject({ category: "malformed" });
    },
  );

  it("reports known unsupported media without exposing document content", async () => {
    await expect(
      inspectPptxPackage(
        await loadFixture(
          "tests/fixtures/compatibility/images-transparency-standard.pptx",
        ),
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      warningCategories: ["unsupported-content"],
    });
  });

  it("reports directly declared slide fonts for local availability checks", async () => {
    const inspection = await inspectPptxPackage(
      await loadFixture("tests/fixtures/compatibility/text-theme-wide.pptx"),
      new AbortController().signal,
    );

    expect(inspection.declaredFonts).toEqual([
      "Arial",
      "Definitely Missing Font",
      "Times New Roman",
    ]);
  });

  it("reports concrete theme fonts used through presentation font references", async () => {
    const zip = await JSZip.loadAsync(
      await loadFixture("tests/fixtures/minimal.pptx"),
    );
    const theme = zip.file("ppt/theme/theme1.xml")!;
    const themeXml = await theme.async("text");
    zip.file(
      "ppt/theme/theme1.xml",
      themeXml.replace(
        '<a:latin typeface="Arial"/>',
        '<a:latin typeface="Theme Only Missing Font"/>',
      ),
    );

    const inspection = await inspectPptxPackage(
      await zip.generateAsync({ type: "arraybuffer" }),
      new AbortController().signal,
    );

    expect(inspection.declaredFonts).toEqual([
      "Arial",
      "Theme Only Missing Font",
    ]);
  });

  it("accepts inert embedded chart data used by the compatibility corpus", async () => {
    await expect(
      inspectPptxPackage(
        await loadFixture("tests/fixtures/compatibility/tables-charts.pptx"),
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ warningCategories: [] });
  });

  it("keeps the performance fixture font set bounded", async () => {
    await expect(
      inspectPptxPackage(
        await loadFixture(
          "tests/fixtures/performance/m2-representative-50-slides.pptx",
        ),
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ declaredFonts: ["Arial"] });
  });

  it("rejects a single ZIP entry above the shared candidate-neutral limit", async () => {
    const fixture = expectedFailureFixtures.find(
      ({ id }) => id === "renderer-resource-limit",
    )!;

    await expect(
      inspectPptxPackage(
        await loadFixture(fixturePath(fixture)),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      name: "PptxOpenError",
      category: "resource-exhausted",
    });
  });

  for (const fixture of expectedFailureFixtures) {
    it(`classifies ${fixture.id} as ${fixture.category}`, async () => {
      const inspection = inspectPptxPackage(
        await loadFixture(fixturePath(fixture)),
        new AbortController().signal,
      );
      await expect(inspection).rejects.toMatchObject({
        name: "PptxOpenError",
        category: fixture.category satisfies PptxOpenErrorCategory,
      });
    });
  }

  it("does not evaluate active content", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network access is forbidden"));
    const evalSpy = vi.spyOn(globalThis, "eval");
    const fixture = expectedFailureFixtures.find(
      ({ id }) => id === "active-content",
    )!;

    await expect(
      inspectPptxPackage(
        await loadFixture(fixturePath(fixture)),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "incompatible" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(evalSpy).not.toHaveBeenCalled();
  });

  it("blocks external image relationships before they can trigger a network request", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network access is forbidden"));
    for (const id of [
      "external-image-blocked",
      "external-image-type-spoof-blocked",
    ]) {
      const fixture = expectedFailureFixtures.find((entry) => entry.id === id)!;
      await expect(
        inspectPptxPackage(
          await loadFixture(fixturePath(fixture)),
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ category: "incompatible" });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts an external hyperlink without fetching it", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network access is forbidden"));
    const fixture = safeRenderFixtures.find(
      ({ id }) => id === "external-relationship-safe",
    )!;

    await expect(
      inspectPptxPackage(
        await loadFixture(fixturePath(fixture)),
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ warningCategories: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not misclassify an arbitrary compound file as protected", async () => {
    const compoundFile = CFB.utils.cfb_new();
    CFB.utils.cfb_add(compoundFile, "/LegacyPayload", Buffer.from("not encrypted"));
    const bytes = CFB.write(compoundFile, { type: "buffer" });

    await expect(
      inspectPptxPackage(
        Uint8Array.from(bytes).buffer,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "malformed" });
  });

  it("requires valid encryption stream structure before classifying a compound file as protected", async () => {
    const compoundFile = CFB.utils.cfb_new();
    CFB.utils.cfb_add(
      compoundFile,
      "/EncryptionInfo",
      Buffer.from("not encryption metadata"),
    );
    CFB.utils.cfb_add(
      compoundFile,
      "/EncryptedPackage",
      Buffer.from("not an encrypted package"),
    );
    const bytes = CFB.write(compoundFile, { type: "buffer" });

    await expect(
      inspectPptxPackage(
        Uint8Array.from(bytes).buffer,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "malformed" });
  });

  it("stops before parsing when the caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      inspectPptxPackage(
        await loadFixture("tests/fixtures/minimal.pptx"),
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
