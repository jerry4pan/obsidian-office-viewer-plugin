import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import PptxGenJS from "pptxgenjs";

const fixtureDir = path.resolve("tests/fixtures");
const vaultDir = path.resolve("tests/vault");
const fixturePath = path.join(fixtureDir, "minimal.pptx");
const vaultPath = path.join(vaultDir, "minimal.pptx");

await mkdir(fixtureDir, { recursive: true });
await mkdir(vaultDir, { recursive: true });

const pptx = new PptxGenJS();
pptx.author = "Obsidian Office Viewer";
pptx.company = "Obsidian Office Viewer";
pptx.subject = "Renderer smoke-test fixture";
pptx.title = "Minimal PPTX fixture";
pptx.lang = "en-US";
pptx.layout = "LAYOUT_WIDE";
pptx.theme = {
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  lang: "en-US"
};

const slide = pptx.addSlide();
slide.background = { color: "FFFFFF" };
slide.addText("Obsidian PPTX smoke test", {
  x: 1,
  y: 2.9,
  w: 11.333,
  h: 0.7,
  align: "center",
  color: "1F2937",
  fontFace: "Arial",
  fontSize: 28,
  bold: true,
  margin: 0,
  breakLine: false
});

await pptx.writeFile({ fileName: fixturePath, compression: true });
await copyFile(fixturePath, vaultPath);
