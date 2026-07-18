import JSZip, { type JSZipObject } from "jszip";
import CFB from "cfb";
import { PptxOpenError } from "../pptx-open-error";
import type {
  PptxCompatibilityWarningCategory,
  PptxSlideContent,
} from "./pptx-renderer-adapter";
import { isOoxmlSlideId } from "../slide-identity";

const oleCompoundFileSignature = [
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
] as const;
const zipLocalFileSignature = [0x50, 0x4b, 0x03, 0x04] as const;
const requiredParts = [
  "[Content_Types].xml",
  "_rels/.rels",
  "ppt/presentation.xml",
  "ppt/_rels/presentation.xml.rels",
] as const;
export const PPTX_ZIP_LIMITS = Object.freeze({
  maxEntries: 4_000,
  maxEntryUncompressedBytes: 32 * 1024 * 1024,
  maxTotalUncompressedBytes: 256 * 1024 * 1024,
  maxMediaBytes: 192 * 1024 * 1024,
  maxConcurrency: 8,
});
const maxPreflightXmlPartBytes = 8 * 1024 * 1024;
const maxPreflightXmlBytes = 32 * 1024 * 1024;
const renderedFontPartPrefixes = [
  "ppt/slides/",
  "ppt/slideLayouts/",
  "ppt/slideMasters/",
  "ppt/theme/",
  "ppt/charts/",
] as const;
const compoundFileStreamEntryType = 2;
const hyperlinkRelationshipType =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";
const slideRelationshipType =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const officeRelationshipNamespace =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const drawingMainNamespace =
  "http://schemas.openxmlformats.org/drawingml/2006/main";
const presentationMainNamespace =
  "http://schemas.openxmlformats.org/presentationml/2006/main";

interface RelationshipReferences {
  readonly hyperlinkIds: Set<string>;
  readonly otherIds: Set<string>;
}

type SizedZipObject = JSZipObject & {
  _data?: { uncompressedSize?: number };
};

function hasSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function malformed(message: string, cause?: unknown): PptxOpenError {
  return new PptxOpenError("malformed", message, { cause });
}

function incompatible(message: string, cause?: unknown): PptxOpenError {
  return new PptxOpenError("incompatible", message, { cause });
}

function resourceExhausted(message: string): PptxOpenError {
  return new PptxOpenError("resource-exhausted", message);
}

export interface PptxPackageInspection {
  readonly declaredFonts: readonly string[];
  readonly slideIdentities: readonly number[];
  readonly slideContents: readonly PptxSlideContent[];
  readonly warningCategories: readonly PptxCompatibilityWarningCategory[];
}

function compoundStreamBytes(
  container: CFB.CFB$Container,
  name: string,
): Uint8Array | null {
  const entry = CFB.find(container, name);
  return entry?.type === compoundFileStreamEntryType
    ? new Uint8Array(entry.content)
    : null;
}

function isEncryptedOoxmlCompoundFile(bytes: Uint8Array): boolean {
  let container: CFB.CFB$Container;
  try {
    container = CFB.parse(bytes, { WTF: true });
  } catch (error) {
    throw malformed("Unable to parse compound-file input", error);
  }
  const encryptionInfo = compoundStreamBytes(container, "EncryptionInfo");
  const encryptedPackage = compoundStreamBytes(container, "EncryptedPackage");
  if (!encryptionInfo || encryptionInfo.byteLength < 8) return false;
  if (!encryptedPackage || encryptedPackage.byteLength < 16) return false;

  const info = new DataView(
    encryptionInfo.buffer,
    encryptionInfo.byteOffset,
    encryptionInfo.byteLength,
  );
  const majorVersion = info.getUint16(0, true);
  const minorVersion = info.getUint16(2, true);
  const hasKnownEncryptionVersion =
    (majorVersion === 4 && minorVersion === 4) ||
    ((majorVersion === 3 || majorVersion === 4) && minorVersion === 2);
  if (!hasKnownEncryptionVersion) return false;

  const encrypted = new DataView(
    encryptedPackage.buffer,
    encryptedPackage.byteOffset,
    encryptedPackage.byteLength,
  );
  const declaredPackageBytes =
    encrypted.getUint32(0, true) + encrypted.getUint32(4, true) * 2 ** 32;
  return (
    Number.isSafeInteger(declaredPackageBytes) &&
    declaredPackageBytes > 0 &&
    declaredPackageBytes <= encryptedPackage.byteLength - 8
  );
}

function uncompressedSize(part: JSZipObject): number {
  const size = (part as SizedZipObject)._data?.uncompressedSize;
  if (!Number.isSafeInteger(size) || size === undefined || size < 0) {
    throw malformed(`Invalid ZIP size metadata for ${part.name}`);
  }
  return size;
}

function enforceZipLimits(zip: JSZip): void {
  const entries = Object.values(zip.files).filter((part) => !part.dir);
  if (entries.length > PPTX_ZIP_LIMITS.maxEntries) {
    throw resourceExhausted("The PPTX package contains too many ZIP entries");
  }

  let totalBytes = 0;
  let mediaBytes = 0;
  let preflightXmlBytes = 0;
  for (const part of entries) {
    const size = uncompressedSize(part);
    if (size > PPTX_ZIP_LIMITS.maxEntryUncompressedBytes) {
      throw resourceExhausted(`OOXML part ${part.name} exceeds the safe size limit`);
    }
    totalBytes += size;
    if (part.name.startsWith("ppt/media/")) mediaBytes += size;
    if (part.name.endsWith(".xml") || part.name.endsWith(".rels")) {
      if (size > maxPreflightXmlPartBytes) {
        throw resourceExhausted(`OOXML part ${part.name} exceeds the safe size limit`);
      }
      preflightXmlBytes += size;
    }
  }
  if (totalBytes > PPTX_ZIP_LIMITS.maxTotalUncompressedBytes) {
    throw resourceExhausted("The PPTX package exceeds the safe expanded-size limit");
  }
  if (mediaBytes > PPTX_ZIP_LIMITS.maxMediaBytes) {
    throw resourceExhausted("The PPTX package exceeds the safe media-size limit");
  }
  if (preflightXmlBytes > maxPreflightXmlBytes) {
    throw resourceExhausted("The PPTX package contains too much XML to inspect safely");
  }
}

async function readXml(part: JSZipObject, signal: AbortSignal): Promise<Document> {
  signal.throwIfAborted();
  let xml: string;
  try {
    xml = await part.async("text");
  } catch (error) {
    throw malformed(`Unable to read OOXML part ${part.name}`, error);
  }
  signal.throwIfAborted();
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw malformed(`Invalid XML in OOXML part ${part.name}`);
  }
  return document;
}

function relationshipOwnerDirectory(relationshipsPath: string): string {
  const marker = "/_rels/";
  const markerIndex = relationshipsPath.indexOf(marker);
  if (markerIndex === -1) return "";
  const ownerDirectory = relationshipsPath.slice(0, markerIndex);
  return ownerDirectory;
}

function relationshipOwnerPartPath(relationshipsPath: string): string | null {
  const marker = "/_rels/";
  const markerIndex = relationshipsPath.indexOf(marker);
  if (markerIndex === -1 || !relationshipsPath.endsWith(".rels")) return null;
  const ownerDirectory = relationshipsPath.slice(0, markerIndex);
  const ownerName = relationshipsPath
    .slice(markerIndex + marker.length)
    .slice(0, -".rels".length);
  return `${ownerDirectory}/${ownerName}`;
}

function collectRelationshipReferences(document: Document): RelationshipReferences {
  const references: RelationshipReferences = {
    hyperlinkIds: new Set<string>(),
    otherIds: new Set<string>(),
  };
  for (const element of document.getElementsByTagName("*")) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.namespaceURI !== officeRelationshipNamespace) continue;
      const isHyperlinkReference =
        (element.localName === "hlinkClick" ||
          element.localName === "hlinkMouseOver") &&
        attribute.localName === "id";
      (isHyperlinkReference
        ? references.hyperlinkIds
        : references.otherIds
      ).add(attribute.value);
    }
  }
  return references;
}

function normalizePartPath(baseDirectory: string, rawTarget: string): string {
  const targetWithoutFragment = rawTarget.split(/[?#]/, 1)[0] ?? "";
  let decodedTarget: string;
  try {
    decodedTarget = decodeURIComponent(targetWithoutFragment);
  } catch (error) {
    throw malformed(`Invalid relationship target ${rawTarget}`, error);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(decodedTarget)) {
    throw malformed(`Internal relationship uses an external URI: ${rawTarget}`);
  }
  const segments = decodedTarget.startsWith("/")
    ? decodedTarget.slice(1).split("/")
    : `${baseDirectory}/${decodedTarget}`.split("/");
  const normalized: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (normalized.length === 0) {
        throw malformed(`Relationship target escapes the package: ${rawTarget}`);
      }
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }
  return normalized.join("/");
}

function verifyRelationships(
  zip: JSZip,
  part: JSZipObject,
  document: Document,
  referencesByOwner: ReadonlyMap<string, RelationshipReferences>,
): void {
  const baseDirectory = relationshipOwnerDirectory(part.name);
  for (const relationship of document.getElementsByTagNameNS("*", "Relationship")) {
    if (relationship.getAttribute("TargetMode")?.toLowerCase() === "external") {
      const relationshipId = relationship.getAttribute("Id");
      const ownerPath = relationshipOwnerPartPath(part.name);
      const references = ownerPath
        ? referencesByOwner.get(ownerPath)
        : undefined;
      if (
        relationship.getAttribute("Type") === hyperlinkRelationshipType &&
        relationshipId &&
        references?.hyperlinkIds.has(relationshipId) &&
        !references.otherIds.has(relationshipId)
      ) {
        continue;
      }
      throw incompatible(
        `External content relationship in ${part.name} cannot be displayed offline`,
      );
    }
    const target = relationship.getAttribute("Target");
    if (!target) throw malformed(`Relationship in ${part.name} has no target`);
    const resolved = normalizePartPath(baseDirectory, target);
    if (!zip.file(resolved)) {
      throw malformed(`Relationship in ${part.name} points to missing part ${resolved}`);
    }
  }
}

function rejectUnsafeActiveContent(
  zip: JSZip,
  contentTypes: Document,
): void {
  const partNames = Object.values(zip.files)
    .filter((part) => !part.dir)
    .map((part) => part.name.toLowerCase());
  const declaredTypes = Array.from(
    contentTypes.getElementsByTagNameNS("*", "Override"),
    (element) => element.getAttribute("ContentType")?.toLowerCase() ?? "",
  );
  const hasActivePart = partNames.some(
    (name) =>
      name.endsWith("/vbaproject.bin") ||
      name.startsWith("ppt/activex/"),
  );
  const declaresActiveContent = declaredTypes.some(
    (contentType) =>
      contentType.includes("vbaproject") ||
      contentType.includes("macroenabled") ||
      contentType.includes("activex"),
  );
  if (hasActivePart || declaresActiveContent) {
    throw new PptxOpenError(
      "incompatible",
      "The package contains active content that this viewer will not process",
    );
  }
}

function orderedSlideIdentities(presentation: Document): readonly number[] {
  const identities: number[] = [];
  const seen = new Set<number>();
  for (const slide of presentation.getElementsByTagNameNS(
    presentationMainNamespace,
    "sldId",
  )) {
    const rawIdentity = slide.getAttribute("id");
    if (rawIdentity === null || !/^[1-9]\d*$/.test(rawIdentity)) {
      throw malformed("Presentation contains an invalid native slide identity");
    }
    const identity = Number(rawIdentity);
    if (
      !isOoxmlSlideId(identity) ||
      seen.has(identity)
    ) {
      throw malformed("Presentation contains a duplicate or invalid native slide identity");
    }
    identities.push(identity);
    seen.add(identity);
  }
  return identities;
}

function orderedSlideContents(
  presentation: Document,
  presentationRelationships: Document,
  documentsByPath: ReadonlyMap<string, Document>,
): readonly PptxSlideContent[] {
  const relationships = new Map<string, Element>();
  for (const relationship of presentationRelationships.getElementsByTagNameNS(
    "*",
    "Relationship",
  )) {
    const id = relationship.getAttribute("Id");
    if (id) relationships.set(id, relationship);
  }

  const contents: PptxSlideContent[] = [];
  for (const slide of presentation.getElementsByTagNameNS(
    presentationMainNamespace,
    "sldId",
  )) {
    const rawIdentity = slide.getAttribute("id");
    const relationshipId = slide.getAttributeNS(officeRelationshipNamespace, "id");
    const relationship = relationshipId
      ? relationships.get(relationshipId)
      : undefined;
    if (
      rawIdentity === null ||
      relationship?.getAttribute("Type") !== slideRelationshipType
    ) {
      throw malformed("Presentation slide identity has no slide relationship");
    }
    const target = relationship.getAttribute("Target");
    if (!target) throw malformed("Presentation slide relationship has no target");
    const slidePath = normalizePartPath("ppt", target);
    const document = documentsByPath.get(slidePath);
    if (!document) throw malformed(`Missing parsed slide part ${slidePath}`);
    const text = Array.from(
      document.getElementsByTagNameNS(drawingMainNamespace, "p"),
      (paragraph) => Array.from(
        paragraph.getElementsByTagNameNS(drawingMainNamespace, "t"),
        (run) => run.textContent ?? "",
      ).join(""),
    ).filter((paragraph) => paragraph.trim().length > 0);
    contents.push({ slideId: Number(rawIdentity), text });
  }
  return contents;
}

async function inspectXmlParts(
  zip: JSZip,
  signal: AbortSignal,
): Promise<{
  presentation: Document;
  presentationRelationships: Document;
  contentTypes: Document;
  declaredFonts: readonly string[];
  documentsByPath: ReadonlyMap<string, Document>;
}> {
  let presentation: Document | undefined;
  let presentationRelationships: Document | undefined;
  let contentTypes: Document | undefined;
  const referencesByOwner = new Map<string, RelationshipReferences>();
  const documentsByPath = new Map<string, Document>();
  const declaredFonts = new Set<string>();
  const documentParts = Object.values(zip.files).filter(
    (part) => !part.dir && part.name.endsWith(".xml"),
  );
  for (const part of documentParts) {
    const document = await readXml(part, signal);
    documentsByPath.set(part.name, document);
    if (part.name === "ppt/presentation.xml") presentation = document;
    else if (part.name === "[Content_Types].xml") contentTypes = document;
    referencesByOwner.set(part.name, collectRelationshipReferences(document));
    const canDeclareRenderedFont = renderedFontPartPrefixes.some((prefix) =>
      part.name.startsWith(prefix)
    );
    if (canDeclareRenderedFont) {
      const walker = document.createTreeWalker(document.documentElement, 1);
      let element = walker.nextNode() as Element | null;
      while (element) {
        if (
          element.namespaceURI === drawingMainNamespace &&
          (element.localName === "latin" ||
            element.localName === "ea" ||
            element.localName === "cs")
        ) {
          const typeface = element.getAttribute("typeface")?.trim();
          if (typeface && !typeface.startsWith("+")) {
            declaredFonts.add(typeface);
          }
        }
        element = walker.nextNode() as Element | null;
      }
    }
  }
  const relationshipParts = Object.values(zip.files).filter(
    (part) => !part.dir && part.name.endsWith(".rels"),
  );
  for (const part of relationshipParts) {
    const document = await readXml(part, signal);
    if (part.name === "ppt/_rels/presentation.xml.rels") {
      presentationRelationships = document;
    }
    verifyRelationships(zip, part, document, referencesByOwner);
  }
  if (!presentation) throw malformed("Missing presentation XML");
  if (!presentationRelationships) {
    throw malformed("Missing presentation relationships XML");
  }
  if (!contentTypes) throw malformed("Missing content types XML");
  return {
    presentation,
    presentationRelationships,
    contentTypes,
    declaredFonts: [...declaredFonts].sort((left, right) =>
      left.localeCompare(right, "en")),
    documentsByPath,
  };
}

export async function inspectPptxPackage(
  buffer: ArrayBuffer,
  signal: AbortSignal,
): Promise<PptxPackageInspection> {
  signal.throwIfAborted();
  const bytes = new Uint8Array(buffer);
  if (hasSignature(bytes, oleCompoundFileSignature)) {
    if (isEncryptedOoxmlCompoundFile(bytes)) {
      throw new PptxOpenError(
        "protected",
        "Encrypted or protected OOXML compound-file container",
      );
    }
    throw malformed("Compound-file input is not an encrypted OOXML package");
  }
  if (!hasSignature(bytes, zipLocalFileSignature)) {
    throw malformed("PPTX input is not a ZIP-based OOXML package");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (error) {
    throw malformed("Unable to parse the PPTX ZIP container", error);
  }
  signal.throwIfAborted();
  enforceZipLimits(zip);

  for (const partPath of requiredParts) {
    if (!zip.file(partPath)) throw malformed(`Missing required OOXML part ${partPath}`);
  }

  const {
    presentation,
    presentationRelationships,
    contentTypes,
    declaredFonts,
    documentsByPath,
  } = await inspectXmlParts(zip, signal);
  rejectUnsafeActiveContent(zip, contentTypes);
  signal.throwIfAborted();

  if (presentation.getElementsByTagNameNS("*", "sldId").length === 0) {
    throw new PptxOpenError(
      "incompatible",
      "The renderer cannot display a PPTX package with no usable slides",
    );
  }
  const slideIdentities = orderedSlideIdentities(presentation);
  const slideContents = orderedSlideContents(
    presentation,
    presentationRelationships,
    documentsByPath,
  );

  const unsupportedMediaPattern = /\.(?:svg|emf|wmf|pdf)$/i;
  const hasUnsupportedMedia = Object.values(zip.files).some(
    (part) => !part.dir && unsupportedMediaPattern.test(part.name),
  );
  return {
    declaredFonts,
    slideIdentities,
    slideContents,
    warningCategories: hasUnsupportedMedia ? ["unsupported-content"] : [],
  };
}
