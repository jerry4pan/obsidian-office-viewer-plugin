import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";

import {
  convertWindowsMetafileToPng,
  getWindowsMetafileActions,
  isPlaceableOrRawWmf,
} from "../../src/docx/convert-windows-metafile";
import { createSafeDocxRendererBuffer } from "../../src/docx/docx-semantic-model";

const sampleWmf = path.resolve(
  "tests/fixtures/docx-exploration/sample-placeable.wmf",
);
const userDocx = path.resolve(
  "/Users/oulong/Library/Mobile Documents/com~apple~CloudDocs/Obsidian Vault/02 Areas/AI Agent/青少年限速_网络失败及业务失败告警复盘20240110.docx",
);

describe("Windows metafile conversion", () => {
  it("detects placeable WMF payloads", () => {
    const bytes = Uint8Array.from(readFileSync(sampleWmf));
    expect(isPlaceableOrRawWmf(bytes)).toBe(true);
    expect(isPlaceableOrRawWmf(Uint8Array.from([0, 1, 2, 3]))).toBe(false);
  });

  it("converts the alarm-review embedded table WMF into a PNG", async () => {
    if (!existsSync(userDocx)) return;
    const zip = await JSZip.loadAsync(readFileSync(userDocx));
    const part = zip.file("word/media/image7.emf");
    expect(part).not.toBeNull();
    const bytes = new Uint8Array(await part!.async("arraybuffer"));
    expect(isPlaceableOrRawWmf(bytes)).toBe(true);

    const actions = getWindowsMetafileActions(bytes);
    expect(actions).not.toBeNull();
    const texts = actions!
      .filter((action) => action.t === "text")
      .map((action) => String((action as { v: string }).v));
    expect(texts.some((text) => text.includes("告警"))).toBe(true);

    const png = convertWindowsMetafileToPng(bytes);
    expect(png).not.toBeNull();
    expect(Array.from(png!.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(png!.byteLength).toBeGreaterThan(10_000);
  });

  it("rewrites placeable WMF media to PNG inside the safe renderer buffer", async () => {
    if (!existsSync(userDocx)) return;
    const original = Uint8Array.from(readFileSync(userDocx));
    const safe = await createSafeDocxRendererBuffer(
      original.buffer,
      new AbortController().signal,
    );
    const zip = await JSZip.loadAsync(safe);
    expect(zip.file("word/media/image7.png")).not.toBeNull();
    expect(zip.file("word/media/image7.emf")).toBeNull();
    const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
    expect(rels).toContain("media/image7.png");
    expect(rels).not.toContain("media/image7.emf");
  });
});
