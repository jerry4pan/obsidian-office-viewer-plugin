const CHART_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/chart";
const DRAWINGML_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/main";

const SERIES_COLORS = [
  "#5B9BD5",
  "#ED7D31",
  "#A5A5A5",
  "#FFC000",
  "#4472C4",
  "#70AD47",
] as const;

export interface DocxChartSeries {
  readonly name: string;
  readonly categories: readonly string[];
  readonly values: readonly number[];
}

export interface DocxChartModel {
  readonly title: string;
  readonly kind: "line" | "bar" | "unknown";
  readonly series: readonly DocxChartSeries[];
}

function textContent(element: Element | null): string {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function firstChild(parent: Element, localName: string): Element | null {
  for (const child of parent.children) {
    if (child.localName === localName) return child;
  }
  return null;
}

function pointValues(cache: Element | null): string[] {
  if (cache === null) return [];
  const values: string[] = [];
  for (const point of cache.getElementsByTagNameNS(CHART_NAMESPACE, "pt")) {
    const value = firstChild(point, "v");
    values.push(textContent(value));
  }
  return values;
}

function seriesName(series: Element): string {
  const tx = firstChild(series, "tx");
  if (tx === null) return "Series";
  const richTexts = Array.from(
    tx.getElementsByTagNameNS(DRAWINGML_NAMESPACE, "t"),
  ).map((node) => textContent(node));
  if (richTexts.some((value) => value.length > 0)) {
    return richTexts.join("");
  }
  const cached = tx.getElementsByTagNameNS(CHART_NAMESPACE, "v")[0] ?? null;
  const value = textContent(cached);
  return value.length > 0 ? value : "Series";
}

function parseSeries(series: Element): DocxChartSeries | null {
  const cat = firstChild(series, "cat");
  const val = firstChild(series, "val");
  const categories = pointValues(
    cat?.getElementsByTagNameNS(CHART_NAMESPACE, "strCache")[0] ??
      cat?.getElementsByTagNameNS(CHART_NAMESPACE, "numCache")[0] ??
      null,
  );
  const rawValues = pointValues(
    val?.getElementsByTagNameNS(CHART_NAMESPACE, "numCache")[0] ?? null,
  );
  const values = rawValues.map((value) => Number(value));
  if (
    categories.length === 0 ||
    values.length === 0 ||
    values.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }
  const length = Math.min(categories.length, values.length);
  return {
    name: seriesName(series),
    categories: categories.slice(0, length),
    values: values.slice(0, length),
  };
}

function chartTitle(chart: Element): string {
  const title = firstChild(chart, "title");
  if (title === null) return "";
  return Array.from(title.getElementsByTagNameNS(DRAWINGML_NAMESPACE, "t"))
    .map((node) => textContent(node))
    .join("");
}

function detectKind(plotArea: Element): DocxChartModel["kind"] {
  if (firstChild(plotArea, "lineChart") !== null) return "line";
  if (
    firstChild(plotArea, "barChart") !== null ||
    firstChild(plotArea, "bar3DChart") !== null
  ) {
    return "bar";
  }
  return "unknown";
}

export function parseDocxChartXml(xml: string): DocxChartModel | null {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) return null;
  const chart =
    document.getElementsByTagNameNS(CHART_NAMESPACE, "chart")[0] ?? null;
  if (chart === null) return null;
  const plotArea = firstChild(chart, "plotArea");
  if (plotArea === null) return null;
  const kind = detectKind(plotArea);
  const seriesElements = Array.from(
    plotArea.getElementsByTagNameNS(CHART_NAMESPACE, "ser"),
  );
  const series: DocxChartSeries[] = [];
  for (const element of seriesElements) {
    const parsed = parseSeries(element);
    if (parsed !== null) series.push(parsed);
  }
  if (series.length === 0) return null;
  return {
    title: chartTitle(chart),
    kind,
    series,
  };
}

function pngBytesFromDataUrl(dataUrl: string): Uint8Array | null {
  const marker = "base64,";
  const index = dataUrl.indexOf(marker);
  if (index < 0) return null;
  const binary = atob(dataUrl.slice(index + marker.length));
  const bytes = new Uint8Array(binary.length);
  for (let offset = 0; offset < binary.length; offset += 1) {
    bytes[offset] = binary.charCodeAt(offset);
  }
  return bytes;
}

function formatTick(value: number): string {
  if (Math.abs(value) <= 1 && seriesLooksLikeRatio(value)) {
    return `${(value * 100).toFixed(value * 100 >= 99.9 ? 2 : 1)}%`;
  }
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function seriesLooksLikeRatio(sample: number): boolean {
  return sample >= 0 && sample <= 1.5;
}

function valuesLookLikeRatios(series: readonly DocxChartSeries[]): boolean {
  return series.every((item) =>
    item.values.every((value) => value >= 0 && value <= 1.5),
  );
}

/**
 * Render a parsed OOXML chart (cached numeric series) to PNG.
 * Supports common line/bar business charts used in body-led DOCX reports.
 */
export function renderDocxChartToPng(
  chart: DocxChartModel,
  widthPx: number,
  heightPx: number,
): Uint8Array | null {
  if (typeof document === "undefined") return null;
  if (chart.kind !== "line" && chart.kind !== "bar") return null;
  const width = Math.max(320, Math.round(widthPx));
  const height = Math.max(200, Math.round(heightPx));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return null;

  const pad = { top: 36, right: 24, bottom: 48, left: 56 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  if (plotWidth < 40 || plotHeight < 40) return null;

  const categories = chart.series[0]?.categories ?? [];
  const allValues = chart.series.flatMap((item) => item.values);
  if (categories.length === 0 || allValues.length === 0) return null;

  const asPercent = valuesLookLikeRatios(chart.series);
  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  if (asPercent) {
    min = Math.min(0.9, min);
    max = Math.max(1, max);
  } else if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min || 1;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#d0d0d0";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  if (chart.title.length > 0) {
    ctx.fillStyle = "#333333";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(chart.title, width / 2, 22, width - 24);
  }

  ctx.strokeStyle = "#c8c8c8";
  ctx.fillStyle = "#666666";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  const ticks = 5;
  for (let index = 0; index <= ticks; index += 1) {
    const ratio = index / ticks;
    const value = max - span * ratio;
    const y = pad.top + plotHeight * ratio;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotWidth, y);
    ctx.stroke();
    ctx.fillText(
      asPercent ? `${(value * 100).toFixed(0)}%` : formatTick(value),
      pad.left - 8,
      y + 4,
    );
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const n = Math.max(categories.length, 1);
  for (let index = 0; index < categories.length; index += 1) {
    const x =
      n === 1
        ? pad.left + plotWidth / 2
        : pad.left + (plotWidth * index) / (n - 1);
    ctx.fillText(categories[index] ?? "", x, pad.top + plotHeight + 10, 72);
  }

  const yAt = (value: number) =>
    pad.top + ((max - value) / span) * plotHeight;
  const xAt = (index: number) =>
    n === 1
      ? pad.left + plotWidth / 2
      : pad.left + (plotWidth * index) / (n - 1);

  chart.series.forEach((item, seriesIndex) => {
    const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length]!;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    if (chart.kind === "line") {
      ctx.beginPath();
      item.values.forEach((value, index) => {
        const x = xAt(index);
        const y = yAt(value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      item.values.forEach((value, index) => {
        const x = xAt(index);
        const y = yAt(value);
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#333333";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(
          asPercent ? `${(value * 100).toFixed(2)}%` : formatTick(value),
          x,
          y - 6,
        );
        ctx.fillStyle = color;
      });
    } else {
      const groupWidth = plotWidth / n;
      const barWidth = Math.max(4, (groupWidth * 0.7) / chart.series.length);
      item.values.forEach((value, index) => {
        const x =
          pad.left +
          groupWidth * index +
          groupWidth * 0.15 +
          barWidth * seriesIndex;
        const y = yAt(value);
        const barHeight = pad.top + plotHeight - y;
        ctx.fillRect(x, y, barWidth, barHeight);
      });
    }
  });

  const legendY = height - 16;
  let legendX = pad.left;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  chart.series.forEach((item, seriesIndex) => {
    const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length]!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(legendX + 4, legendY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#333333";
    ctx.fillText(item.name, legendX + 12, legendY);
    legendX += ctx.measureText(item.name).width + 36;
  });

  return pngBytesFromDataUrl(canvas.toDataURL("image/png"));
}

export function emuToCssPx(emu: string | null | undefined): number | null {
  if (emu === null || emu === undefined || emu.length === 0) return null;
  const value = Number(emu);
  if (!Number.isFinite(value) || value <= 0) return null;
  return (value * 96) / 914_400;
}
