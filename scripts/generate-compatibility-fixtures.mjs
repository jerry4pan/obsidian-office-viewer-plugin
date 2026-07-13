import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";

const fixtureDir = path.resolve("tests/fixtures/compatibility");
const vaultDir = path.resolve("tests/vault/compatibility");
const force = process.argv.includes("--force");

await mkdir(fixtureDir, { recursive: true });
await mkdir(vaultDir, { recursive: true });

function presentation(layout = "LAYOUT_WIDE") {
  const pptx = new PptxGenJS();
  pptx.author = "Obsidian Office Viewer";
  pptx.company = "Obsidian Office Viewer";
  pptx.subject = "MIT compatibility corpus fixture";
  pptx.lang = "en-US";
  pptx.layout = layout;
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial", lang: "en-US" };
  return pptx;
}

function title(slide, text) {
  slide.addText(text, { x: 0.6, y: 0.35, w: 12.1, h: 0.55, fontFace: "Arial", fontSize: 24, bold: true, color: "172554", margin: 0 });
}

function svgData(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function writePresentation(id, build, { patchGroup = false } = {}) {
  const target = path.join(fixtureDir, `${id}.pptx`);
  const exists = await access(target).then(() => true, () => false);
  if (force || !exists) {
    const pptx = await build();
    pptx.title = id;
    await pptx.writeFile({ fileName: target, compression: true });
    if (patchGroup) await addNativeGroup(target);
  }
  await copyFile(target, path.join(vaultDir, `${id}.pptx`));
}

async function addNativeGroup(filePath) {
  const zip = await JSZip.loadAsync(await readFile(filePath));
  const slideFile = zip.file("ppt/slides/slide1.xml");
  if (!slideFile) throw new Error("group fixture is missing slide1.xml");
  let xml = await slideFile.async("string");
  const shapes = xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? [];
  const grouped = shapes.filter((shape) => ["Discover", "Decide", "Deliver"].some((marker) => shape.includes(marker)));
  if (grouped.length !== 3) throw new Error(`expected 3 group members, found ${grouped.length}`);
  for (const shape of grouped) xml = xml.replace(shape, "");
  const group = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="99" name="Workflow group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/><a:chOff x="0" y="0"/><a:chExt cx="12192000" cy="6858000"/></a:xfrm></p:grpSpPr>${grouped.join("")}</p:grpSp>`;
  xml = xml.replace("</p:spTree>", `${group}</p:spTree>`);
  zip.file("ppt/slides/slide1.xml", xml);
  await writeFile(filePath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

await writePresentation("text-theme-wide", async () => {
  const pptx = presentation();
  pptx.defineSlideMaster({
    title: "CORPUS_MASTER",
    background: { color: "F8FAFC" },
    objects: [{ text: { text: "Theme footer", options: { x: 0.6, y: 7.05, w: 4, h: 0.22, fontFace: "Arial", fontSize: 9, color: "64748B", margin: 0 } } }],
  });
  const slide = pptx.addSlide({ masterName: "CORPUS_MASTER" });
  title(slide, "Quarterly Brief");
  slide.addText("Revenue grew 24%", { x: 0.8, y: 2.1, w: 6, h: 0.9, fontFace: "Arial", fontSize: 32, bold: true, color: "0F766E", margin: 0 });
  slide.addText("Theme-aware headline · regular · italic", { x: 0.8, y: 3.2, w: 8, h: 0.5, fontFace: "Arial", fontSize: 18, italic: true, color: "334155", margin: 0 });
  return pptx;
});

await writePresentation("images-transparency-standard", async () => {
  const pptx = presentation("LAYOUT_4x3");
  const slide = pptx.addSlide();
  slide.background = { color: "FFF7ED" };
  title(slide, "Layered Product");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260"><rect width="480" height="260" rx="32" fill="#0f766e"/><circle cx="120" cy="130" r="72" fill="#fbbf24"/><path d="M230 75h190v28H230zm0 56h150v28H230zm0 56h180v28H230z" fill="#fff"/></svg>`;
  slide.addImage({ data: svgData(svg), x: 0.8, y: 1.5, w: 5.2, h: 2.8 });
  slide.addShape(pptx.ShapeType.rect, { x: 3.8, y: 2.4, w: 4.8, h: 2.2, fill: { color: "2563EB", transparency: 50 }, line: { color: "1D4ED8", transparency: 20 } });
  slide.addText("50% transparency", { x: 4.25, y: 3.1, w: 3.8, h: 0.45, fontFace: "Arial", fontSize: 20, bold: true, color: "FFFFFF", align: "center", margin: 0 });
  slide.addText("Embedded SVG", { x: 0.8, y: 4.55, w: 3, h: 0.35, fontFace: "Arial", fontSize: 14, color: "7C2D12", margin: 0 });
  return pptx;
});

await writePresentation("tables-charts", async () => {
  const pptx = presentation();
  const slide = pptx.addSlide();
  title(slide, "Regional performance");
  slide.addTable([["Region", "FY25", "FY26 plan"], ["North", "18", "24"], ["South", "14", "21"]], {
    x: 0.7, y: 1.35, w: 5.2, h: 2.3, border: { color: "CBD5E1", pt: 1 }, fill: "F8FAFC", color: "1E293B", fontFace: "Arial", fontSize: 15, margin: 0.08, rowH: 0.6,
  });
  slide.addChart(pptx.ChartType.bar, [{ name: "FY26 plan", labels: ["North", "South"], values: [24, 21] }], {
    x: 6.3, y: 1.3, w: 6.2, h: 4.8, catAxisLabelFontFace: "Arial", valAxisLabelFontFace: "Arial", showLegend: false, showTitle: true, title: "FY26 plan", chartColors: ["2563EB"],
  });
  return pptx;
});

await writePresentation("grouped-rotated", async () => {
  const pptx = presentation();
  const slide = pptx.addSlide();
  title(slide, "Grouped workflow");
  const stages = [["Discover", 1.0, "DBEAFE"], ["Decide", 4.75, "D1FAE5"], ["Deliver", 8.5, "FEF3C7"]];
  for (const [label, x, color] of stages) {
    slide.addText(label, { x, y: 2.4, w: 2.8, h: 1.25, shape: pptx.ShapeType.roundRect, fill: { color }, line: { color: "64748B", width: 1.5 }, fontFace: "Arial", fontSize: 20, bold: true, align: "center", valign: "mid", margin: 0 });
  }
  slide.addText("45°", { x: 5.45, y: 4.35, w: 2, h: 0.55, rotate: 45, fontFace: "Arial", fontSize: 22, bold: true, color: "BE123C", align: "center", margin: 0 });
  return pptx;
}, { patchGroup: true });

await writePresentation("complex-drawing", async () => {
  const pptx = presentation();
  const slide = pptx.addSlide();
  title(slide, "Architecture map");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="430" viewBox="0 0 1000 430"><defs><filter id="s"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-opacity=".18"/></filter><linearGradient id="g" x1="0" x2="1"><stop stop-color="#2563eb"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><path d="M250 215h120m260 0h120" stroke="#64748b" stroke-width="12" stroke-linecap="round"/><path d="M350 190l30 25-30 25m380-50 30 25-30 25" fill="none" stroke="#64748b" stroke-width="12"/><g filter="url(#s)"><rect x="30" y="105" width="220" height="220" rx="40" fill="#dbeafe"/><rect x="380" y="65" width="250" height="300" rx="40" fill="url(#g)"/><rect x="750" y="105" width="220" height="220" rx="40" fill="#d1fae5"/></g><circle cx="505" cy="215" r="58" fill="#fff" fill-opacity=".2"/><text x="140" y="230" text-anchor="middle" font-family="Arial" font-size="42" font-weight="700" fill="#1e3a8a">Client</text><text x="505" y="230" text-anchor="middle" font-family="Arial" font-size="42" font-weight="700" fill="#fff">Plugin</text><text x="860" y="230" text-anchor="middle" font-family="Arial" font-size="38" font-weight="700" fill="#065f46">Renderer</text></svg>`;
  slide.addImage({ data: svgData(svg), x: 0.75, y: 1.45, w: 11.85, h: 5.1 });
  for (const [text, x] of [["Client", 1], ["Plugin", 5.9], ["Renderer", 10.7]]) {
    slide.addText(text, { x, y: 6.7, w: 1.5, h: 0.3, fontFace: "Arial", fontSize: 9, color: "64748B", margin: 0 });
  }
  return pptx;
});
