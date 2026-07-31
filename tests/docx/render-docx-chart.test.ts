import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createSafeDocxRendererBuffer } from "../../src/docx/docx-semantic-model";
import {
  parseDocxChartXml,
  renderDocxChartToPng,
} from "../../src/docx/render-docx-chart";

const userDocx = path.resolve(
  "/Users/oulong/Library/Mobile Documents/com~apple~CloudDocs/Obsidian Vault/02 Areas/AI Agent/青少年限速_网络失败及业务失败告警复盘20240110.docx",
);

describe("DOCX chart rasterization", () => {
  it("parses and paints the alarm-review line chart", async () => {
    if (!existsSync(userDocx)) return;
    const zip = await JSZip.loadAsync(readFileSync(userDocx));
    const chartXml = await zip.file("word/charts/chart1.xml")!.async("string");
    const model = parseDocxChartXml(chartXml);
    expect(model).not.toBeNull();
    expect(model!.kind).toBe("line");
    expect(model!.title).toContain("分接口网络成功率统计");
    expect(model!.series.map((item) => item.name)).toEqual([
      "申请网络成功率",
      "删除网络成功率",
    ]);

    const png = renderDocxChartToPng(model!, 1000, 420);
    expect(png).not.toBeNull();
    expect(Array.from(png!.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(png!.byteLength).toBeGreaterThan(5_000);
  });

  it("rewrites the alarm-review chart drawing into a PNG picture", async () => {
    if (!existsSync(userDocx)) return;
    const original = Uint8Array.from(readFileSync(userDocx));
    const safe = await createSafeDocxRendererBuffer(
      original.buffer,
      new AbortController().signal,
    );
    const zip = await JSZip.loadAsync(safe);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    const heading = documentXml.indexOf("接口类型维度指标分析");
    const next = documentXml.indexOf("单用户业务交互流程分析");
    const mid = documentXml.slice(heading, next);
    expect(mid).not.toContain("<c:chart");
    expect(mid).toContain("a:blip");
    expect(
      Object.keys(zip.files).some((name) =>
        /^word\/media\/docx-chart-\d+\.png$/.test(name),
      ),
    ).toBe(true);
  });
});
