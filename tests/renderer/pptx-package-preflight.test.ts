import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import CFB from "cfb";
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
      warningCategories: [],
    });
  });

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

  it("accepts inert embedded chart data used by the compatibility corpus", async () => {
    await expect(
      inspectPptxPackage(
        await loadFixture("tests/fixtures/compatibility/tables-charts.pptx"),
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ warningCategories: [] });
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
