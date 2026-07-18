export interface SlideReferenceTarget {
  readonly slideId: number;
  readonly createdSlideNumber: number;
}

export interface SlideReferenceMarkupInput extends SlideReferenceTarget {
  readonly sourcePath: string;
  readonly alias: string;
  readonly embed: boolean;
}

export interface ParsedSlideReferenceLink {
  readonly sourcePath: string;
  readonly target: SlideReferenceTarget;
}

const MAX_OOXML_SLIDE_ID = 0xffff_ffff;
const CANONICAL_FRAGMENT = /^#slide-id=([1-9]\d*)&slide=([1-9]\d*)$/;

function isSlideId(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_OOXML_SLIDE_ID
  );
}

function isSlideNumber(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function formatSlideReferenceFragment(
  target: SlideReferenceTarget,
): string {
  if (!isSlideId(target.slideId)) {
    throw new RangeError("Slide identity must be a positive OOXML unsigned integer");
  }
  if (!isSlideNumber(target.createdSlideNumber)) {
    throw new RangeError("Creation-time slide number must be a positive integer");
  }
  return `#slide-id=${target.slideId}&slide=${target.createdSlideNumber}`;
}

export function parseSlideReferenceFragment(
  fragment: string,
): SlideReferenceTarget | null {
  const match = CANONICAL_FRAGMENT.exec(fragment);
  if (match === null) return null;
  const slideId = Number(match[1]);
  const createdSlideNumber = Number(match[2]);
  if (!isSlideId(slideId) || !isSlideNumber(createdSlideNumber)) return null;
  return { slideId, createdSlideNumber };
}

export function parseSlideReferenceLink(
  linktext: string,
): ParsedSlideReferenceLink | null {
  const fragmentIndex = linktext.indexOf("#");
  if (fragmentIndex < 1) return null;
  const target = parseSlideReferenceFragment(linktext.slice(fragmentIndex));
  if (target === null) return null;
  let sourcePath: string;
  try {
    sourcePath = decodeURIComponent(linktext.slice(0, fragmentIndex));
  } catch {
    return null;
  }
  if (!isNormalizedVaultPath(sourcePath)) return null;
  return { sourcePath, target };
}

function isNormalizedVaultPath(path: string): boolean {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\\") ||
    /^[A-Za-z]:\//.test(path)
  ) return false;
  const segments = path.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function encodeWikilinkPath(path: string): string {
  return path
    .replaceAll("%", "%25")
    .replaceAll("#", "%23")
    .replaceAll("|", "%7C")
    .replaceAll("[", "%5B")
    .replaceAll("]", "%5D");
}

function escapeWikilinkAlias(alias: string): string {
  return alias
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("]", "\\]");
}

export function formatSlideReferenceMarkup(
  input: SlideReferenceMarkupInput,
): string {
  if (!isNormalizedVaultPath(input.sourcePath)) {
    throw new TypeError("Slide reference source must be a normalized Vault-relative path");
  }
  if (input.alias.trim().length === 0 || /[\r\n]/.test(input.alias)) {
    throw new TypeError("Slide reference alias must be non-empty and single-line");
  }
  const fragment = formatSlideReferenceFragment(input);
  const prefix = input.embed ? "!" : "";
  return `${prefix}[[${encodeWikilinkPath(input.sourcePath)}${fragment}|${escapeWikilinkAlias(input.alias)}]]`;
}
