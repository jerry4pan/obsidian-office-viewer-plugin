import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import PptxGenJS from "pptxgenjs";

const fixtureDir = path.resolve("tests/fixtures/performance");
const vaultDir = path.resolve("tests/vault/performance");
const force = process.argv.includes("--force");

await mkdir(fixtureDir, { recursive: true });
await mkdir(vaultDir, { recursive: true });

function presentation(title, subject) {
  const pptx = new PptxGenJS();
  pptx.author = "Obsidian Office Viewer";
  pptx.company = "Obsidian Office Viewer";
  pptx.title = title;
  pptx.subject = subject;
  pptx.lang = "en-US";
  pptx.layout = "LAYOUT_WIDE";
  pptx.theme = {
    headFontFace: "Arial",
    bodyFontFace: "Arial",
    lang: "en-US",
  };
  return pptx;
}

function svgData(slideNumber) {
  const accent = slideNumber % 2 === 0 ? "2563eb" : "0f766e";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><rect width="640" height="320" rx="32" fill="#${accent}"/><circle cx="140" cy="160" r="82" fill="#fbbf24"/><path d="M270 92h270v30H270zm0 66h210v30H270zm0 66h245v30H270z" fill="#fff"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function addSlideHeading(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.65,
    y: 0.4,
    w: 12,
    h: 0.5,
    fontFace: "Arial",
    fontSize: 24,
    bold: true,
    color: "172554",
    margin: 0,
  });
  slide.addText(subtitle, {
    x: 0.65,
    y: 1.02,
    w: 12,
    h: 0.35,
    fontFace: "Arial",
    fontSize: 13,
    color: "475569",
    margin: 0,
  });
}

async function buildRepresentative() {
  const pptx = presentation(
    "Representative 12-slide benchmark deck",
    "MIT performance benchmark fixture with text, shapes, tables and images",
  );
  for (let slideNumber = 1; slideNumber <= 12; slideNumber += 1) {
    const slide = pptx.addSlide();
    slide.background = { color: slideNumber % 2 === 0 ? "F8FAFC" : "FFFFFF" };
    addSlideHeading(
      slide,
      `Representative benchmark slide ${slideNumber}`,
      `Repository-authored content sample ${String(slideNumber).padStart(2, "0")}`,
    );
    slide.addText(`Section ${slideNumber}`, {
      x: 0.7,
      y: 1.65,
      w: 2.35,
      h: 0.75,
      shape: pptx.ShapeType.roundRect,
      fill: { color: slideNumber % 2 === 0 ? "DBEAFE" : "D1FAE5" },
      line: { color: "64748B", width: 1.25 },
      fontFace: "Arial",
      fontSize: 20,
      bold: true,
      align: "center",
      valign: "mid",
      margin: 0,
    });
    slide.addTable(
      [
        ["Metric", "Current", "Target"],
        ["Readability", `${90 + (slideNumber % 10)}%`, "100%"],
        ["Slide", String(slideNumber), "12"],
      ],
      {
        x: 0.7,
        y: 2.75,
        w: 5.4,
        h: 2.25,
        border: { color: "CBD5E1", pt: 1 },
        fill: "F8FAFC",
        color: "1E293B",
        fontFace: "Arial",
        fontSize: 14,
        margin: 0.08,
        rowH: 0.55,
      },
    );
    slide.addImage({
      data: svgData(slideNumber),
      x: 6.55,
      y: 1.65,
      w: 5.8,
      h: 2.9,
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 6.55,
      y: 5.25,
      w: 5.8,
      h: 0,
      line: { color: "94A3B8", width: 2 },
    });
    slide.addText(`Unique representative marker ${slideNumber}`, {
      x: 6.55,
      y: 5.48,
      w: 5.8,
      h: 0.4,
      fontFace: "Arial",
      fontSize: 15,
      color: "334155",
      align: "center",
      margin: 0,
    });
  }
  return pptx;
}

async function buildStress() {
  const pptx = presentation(
    "200-slide cancellation and memory stress deck",
    "MIT performance stress fixture with unique text and shapes",
  );
  for (let slideNumber = 1; slideNumber <= 200; slideNumber += 1) {
    const slide = pptx.addSlide();
    slide.background = { color: slideNumber % 2 === 0 ? "F1F5F9" : "FFFFFF" };
    addSlideHeading(
      slide,
      `Stress benchmark slide ${slideNumber}`,
      `Unique stress marker ${String(slideNumber).padStart(3, "0")}`,
    );
    for (let shapeIndex = 0; shapeIndex < 6; shapeIndex += 1) {
      const color = ["DBEAFE", "D1FAE5", "FEF3C7", "FCE7F3"][
        (slideNumber + shapeIndex) % 4
      ];
      slide.addText(`${slideNumber}.${shapeIndex + 1}`, {
        x: 0.75 + shapeIndex * 2.05,
        y: 2 + (shapeIndex % 2) * 1.8,
        w: 1.65,
        h: 1.1,
        shape: shapeIndex % 2 === 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.ellipse,
        fill: { color },
        line: { color: "64748B", width: 1 },
        fontFace: "Arial",
        fontSize: 17,
        bold: true,
        color: "1E293B",
        align: "center",
        valign: "mid",
        margin: 0,
      });
    }
    slide.addText(`Stress payload ${slideNumber}: local deterministic benchmark content`, {
      x: 1.25,
      y: 5.75,
      w: 10.8,
      h: 0.55,
      fontFace: "Arial",
      fontSize: 18,
      color: "475569",
      align: "center",
      margin: 0,
    });
  }
  return pptx;
}

async function ensureFixture(id, build) {
  const fixturePath = path.join(fixtureDir, `${id}.pptx`);
  const fixtureExists = await access(fixturePath).then(
    () => true,
    () => false,
  );
  if (force || !fixtureExists) {
    const pptx = await build();
    await pptx.writeFile({ fileName: fixturePath, compression: true });
  }
  await copyFile(fixturePath, path.join(vaultDir, `${id}.pptx`));
}

await ensureFixture("representative-12-slides", buildRepresentative);
await ensureFixture("stress-200-slides", buildStress);
