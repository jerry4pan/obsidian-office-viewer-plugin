import {
  parseSlideReferenceLink,
  type SlideReferenceTarget,
} from "./slide-reference";

export interface StandaloneSlideEmbedMatch {
  readonly sourcePath: string;
  readonly target: SlideReferenceTarget;
  /** Offset of `![[` within the line text. */
  readonly fromOffset: number;
  /** Offset after `]]` within the line text. */
  readonly toOffset: number;
}

/**
 * Detect a canonical PPTX single-slide embed that is the sole non-whitespace
 * content on a Markdown line. Returns null for prose mixtures, plain PPTX
 * embeds, non-PPTX embeds, malformed syntax, and partial typing.
 */
export function matchStandaloneSlideEmbedLine(
  lineText: string,
): StandaloneSlideEmbedMatch | null {
  const trimmed = lineText.trim();
  if (trimmed.length === 0) return null;
  if (!trimmed.startsWith("![[") || !trimmed.endsWith("]]")) return null;
  const inner = trimmed.slice(3, -2);
  if (inner.includes("]]") || inner.includes("![[") || inner.includes("\n")) {
    return null;
  }
  const pipe = inner.indexOf("|");
  const linktext = pipe === -1 ? inner : inner.slice(0, pipe);
  const parsed = parseSlideReferenceLink(linktext);
  if (parsed === null || !parsed.sourcePath.toLowerCase().endsWith(".pptx")) {
    return null;
  }
  const fromOffset = lineText.indexOf(trimmed);
  if (fromOffset < 0) return null;
  return {
    sourcePath: parsed.sourcePath,
    target: parsed.target,
    fromOffset,
    toOffset: fromOffset + trimmed.length,
  };
}
