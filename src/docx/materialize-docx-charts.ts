import type JSZip from "jszip";
import {
  emuToCssPx,
  parseDocxChartXml,
  renderDocxChartToPng,
} from "./render-docx-chart";

const WORDPROCESSING_NAMESPACE =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const OFFICE_RELATIONSHIP_NAMESPACE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_RELATIONSHIP_NAMESPACE =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const DRAWINGML_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/main";
const WORDPROCESSING_DRAWING_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const PICTURE_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/picture";
const IMAGE_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const CHART_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
const CHART_EX_RELATIONSHIP =
  "http://schemas.microsoft.com/office/2014/relationships/chartEx";

function isChartRelationshipType(type: string | null | undefined): boolean {
  return type === CHART_RELATIONSHIP || type === CHART_EX_RELATIONSHIP;
}

function isChartGraphicElement(element: Element): boolean {
  return element.localName === "chart" || element.localName === "chartEx";
}

function closestElement(
  element: Element,
  namespace: string,
  localName: string,
): Element | null {
  let candidate: Element | null = element;
  while (candidate !== null) {
    if (
      candidate.namespaceURI === namespace &&
      candidate.localName === localName
    ) {
      return candidate;
    }
    candidate = candidate.parentElement;
  }
  return null;
}

function resolveWordPartPath(target: string): string {
  const normalized = target.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.startsWith("word/")) return normalized;
  return `word/${normalized}`;
}

function nextRelationshipId(used: ReadonlySet<string>): string {
  let index = 1;
  while (used.has(`rId${index}`) || used.has(`rChartImg${index}`)) {
    index += 1;
  }
  return `rChartImg${index}`;
}

function extentOfDrawing(drawing: Element): {
  readonly cx: string;
  readonly cy: string;
} {
  for (const extent of drawing.getElementsByTagNameNS(
    WORDPROCESSING_DRAWING_NAMESPACE,
    "extent",
  )) {
    const cx = extent.getAttribute("cx");
    const cy = extent.getAttribute("cy");
    if (cx !== null && cy !== null) return { cx, cy };
  }
  return { cx: "5486400", cy: "3200400" };
}

function createPictureDrawing(
  ownerDocument: Document,
  relationshipId: string,
  cx: string,
  cy: string,
  name: string,
): Element {
  const safeName = name.replace(/"/g, "");
  const markup = `
    <w:drawing xmlns:w="${WORDPROCESSING_NAMESPACE}"
      xmlns:r="${OFFICE_RELATIONSHIP_NAMESPACE}"
      xmlns:wp="${WORDPROCESSING_DRAWING_NAMESPACE}"
      xmlns:a="${DRAWINGML_NAMESPACE}"
      xmlns:pic="${PICTURE_NAMESPACE}">
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="${cx}" cy="${cy}"/>
        <wp:docPr id="1" name="${safeName}"/>
        <a:graphic>
          <a:graphicData uri="${PICTURE_NAMESPACE}">
            <pic:pic>
              <pic:nvPicPr>
                <pic:cNvPr id="0" name="${safeName}"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${relationshipId}"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="${cx}" cy="${cy}"/>
                </a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>`;
  const parsed = new DOMParser().parseFromString(markup, "application/xml");
  return ownerDocument.importNode(parsed.documentElement, true);
}

async function ensurePngContentType(zip: JSZip): Promise<void> {
  const part = zip.file("[Content_Types].xml");
  if (part === null) return;
  let text = await part.async("string");
  if (/Extension="png"/i.test(text)) return;
  text = text.replace(
    /<Types([^>]*)>/,
    '<Types$1><Default Extension="png" ContentType="image/png"/>',
  );
  zip.file("[Content_Types].xml", text);
}

/**
 * Replace native Office chart drawings with rasterized PNG pictures so
 * docx-preview can display them. Charts without usable cached series data are
 * removed so they do not leave sized empty boxes.
 */
export async function materializeDocxChartsAsImages(
  zip: JSZip,
  document: Document,
  relationshipsDocument: Document | null,
  signal: AbortSignal,
): Promise<{ readonly replaced: number; readonly removed: number }> {
  if (relationshipsDocument === null) {
    return { replaced: 0, removed: 0 };
  }

  const relationshipById = new Map<
    string,
    { readonly type: string; readonly target: string }
  >();
  const usedIds = new Set<string>();
  for (const relationship of relationshipsDocument.getElementsByTagNameNS(
    "*",
    "Relationship",
  )) {
    const id = relationship.getAttribute("Id");
    const type = relationship.getAttribute("Type");
    const target = relationship.getAttribute("Target");
    if (id === null) continue;
    usedIds.add(id);
    if (type === null || target === null) continue;
    relationshipById.set(id, { type, target });
  }

  const chartElements = Array.from(document.getElementsByTagName("*")).filter(
    (element) => isChartGraphicElement(element),
  );
  let replaced = 0;
  let removed = 0;
  let mediaIndex = 1;

  for (const chartElement of chartElements) {
    signal.throwIfAborted();
    const drawing = closestElement(
      chartElement,
      WORDPROCESSING_NAMESPACE,
      "drawing",
    );
    if (drawing === null) {
      chartElement.remove();
      removed += 1;
      continue;
    }

    const relationshipId =
      chartElement.getAttributeNS(OFFICE_RELATIONSHIP_NAMESPACE, "id") ??
      chartElement.getAttributeNS(OFFICE_RELATIONSHIP_NAMESPACE, "embed");
    const relationship =
      relationshipId === null
        ? undefined
        : relationshipById.get(relationshipId);
    if (
      relationship === undefined ||
      !isChartRelationshipType(relationship.type)
    ) {
      drawing.remove();
      removed += 1;
      continue;
    }

    const chartPart = zip.file(resolveWordPartPath(relationship.target));
    if (chartPart === null) {
      drawing.remove();
      removed += 1;
      continue;
    }
    const chartXml = await chartPart.async("string");
    const model = parseDocxChartXml(chartXml);
    const { cx, cy } = extentOfDrawing(drawing);
    const width = Math.max(480, Math.round((emuToCssPx(cx) ?? 480) * 2));
    const height = Math.max(240, Math.round((emuToCssPx(cy) ?? 240) * 2));
    const png =
      model === null ? null : renderDocxChartToPng(model, width, height);
    if (png === null) {
      drawing.remove();
      removed += 1;
      continue;
    }

    while (zip.file(`word/media/docx-chart-${mediaIndex}.png`) !== null) {
      mediaIndex += 1;
    }
    const mediaTarget = `media/docx-chart-${mediaIndex}.png`;
    mediaIndex += 1;
    zip.file(`word/${mediaTarget}`, png);

    const imageRelId = nextRelationshipId(usedIds);
    usedIds.add(imageRelId);
    const relRoot = relationshipsDocument.documentElement;
    const rel = relationshipsDocument.createElementNS(
      PACKAGE_RELATIONSHIP_NAMESPACE,
      "Relationship",
    );
    rel.setAttribute("Id", imageRelId);
    rel.setAttribute("Type", IMAGE_RELATIONSHIP);
    rel.setAttribute("Target", mediaTarget);
    relRoot.append(rel);

    const picture = createPictureDrawing(
      document,
      imageRelId,
      cx,
      cy,
      model?.title || "Chart",
    );
    drawing.replaceWith(picture);
    replaced += 1;
  }

  if (replaced > 0) {
    await ensurePngContentType(zip);
  }
  return { replaced, removed };
}
