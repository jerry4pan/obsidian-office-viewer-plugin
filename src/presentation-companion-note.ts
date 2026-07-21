/**
 * Pure helpers for Presentation companion note paths and initial Markdown.
 * Relationship identity and Vault mutations live in the companion-note service.
 */

function isSafeVaultSegment(segment: string): boolean {
  return segment.length > 0 && segment !== "." && segment !== "..";
}

export function normalizeVaultRelativePath(path: string): string | undefined {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/.test(path)
  ) {
    return undefined;
  }

  const collapsed = path.replaceAll("\\", "/").replaceAll(/\/+/g, "/");
  if (collapsed.startsWith("/") || collapsed.endsWith("/")) {
    return undefined;
  }
  const segments = collapsed.split("/");
  if (!segments.every(isSafeVaultSegment)) {
    return undefined;
  }
  return collapsed;
}

export function isNormalizedPptxPath(path: string): boolean {
  return (
    normalizeVaultRelativePath(path) === path &&
    path.endsWith(".pptx")
  );
}

export function isNormalizedMarkdownPath(path: string): boolean {
  return (
    normalizeVaultRelativePath(path) === path &&
    path.endsWith(".md")
  );
}

export function canonicalCompanionNotePath(
  sourcePath: string,
): string | undefined {
  const normalized = normalizeVaultRelativePath(sourcePath);
  if (normalized === undefined || !normalized.endsWith(".pptx")) {
    return undefined;
  }
  return `${normalized.slice(0, -".pptx".length)}.md`;
}

export function isCompanionNotePathConflict(
  sourcePath: string,
  notePath: string,
): boolean {
  const canonical = canonicalCompanionNotePath(sourcePath);
  return canonical !== undefined && notePath !== canonical;
}

function basenameWithoutExtension(path: string): string {
  const fileName = path.slice(path.lastIndexOf("/") + 1);
  return fileName.slice(0, -".pptx".length);
}

function escapeMarkdownHeadingText(text: string): string {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll(/^#/g, "\\#");
}

function encodeWikilinkPath(path: string): string {
  return path
    .replaceAll("%", "%25")
    .replaceAll("#", "%23")
    .replaceAll("|", "%7C")
    .replaceAll("[", "%5B")
    .replaceAll("]", "%5D");
}

export function formatCompanionNoteMarkdown(sourcePath: string): string {
  const normalized = normalizeVaultRelativePath(sourcePath);
  if (normalized === undefined || !normalized.endsWith(".pptx")) {
    throw new TypeError(
      "Companion note source must be a normalized Vault-relative .pptx path",
    );
  }
  const title = escapeMarkdownHeadingText(basenameWithoutExtension(normalized));
  if (title.trim().length === 0 || /[\r\n]/.test(title)) {
    throw new TypeError("Companion note title must be non-empty and single-line");
  }
  return `# ${title}\n\n[[${encodeWikilinkPath(normalized)}]]\n`;
}
