import type { PptxSpeakerNoteContent } from "./renderer/pptx-renderer-adapter";

export function hasUsableSpeakerNoteContent(
  entries: readonly PptxSpeakerNoteContent[] | undefined,
): boolean {
  return (
    entries !== undefined &&
    entries.some((entry) => entry.paragraphs.length > 0)
  );
}

export function indexSpeakerNoteContent(
  slideIdentities: readonly number[],
  entries: readonly PptxSpeakerNoteContent[] | undefined,
): ReadonlyMap<number, readonly string[]> | undefined {
  if (entries === undefined || entries.length !== slideIdentities.length) {
    return undefined;
  }
  const bySlideId = new Map<number, readonly string[]>();
  for (const entry of entries) {
    if (bySlideId.has(entry.slideId)) return undefined;
    bySlideId.set(entry.slideId, entry.paragraphs);
  }
  if (slideIdentities.some((slideId) => !bySlideId.has(slideId))) {
    return undefined;
  }
  return bySlideId;
}
