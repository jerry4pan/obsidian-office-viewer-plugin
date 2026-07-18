import type {
  PptxSourceAuthoredSlideText,
  PptxSpeakerNoteContent,
} from "./renderer/pptx-renderer-adapter";
import {
  hasUsableSpeakerNoteContent,
  indexSpeakerNoteContent,
} from "./speaker-note-content";

export interface SlideSearchSnippet {
  readonly before: string;
  readonly match: string;
  readonly after: string;
}

export type PresentationSearchScope = "all" | "slides" | "notes";

export interface PresentationSearchSurfaceMatch {
  readonly matchCount: number;
  readonly snippet: SlideSearchSnippet;
}

export interface SlideSearchResult {
  readonly slideId: number;
  readonly slideIndex: number;
  readonly matchCount: number;
  readonly snippet: SlideSearchSnippet;
  readonly slideText?: PresentationSearchSurfaceMatch;
  readonly speakerNotes?: PresentationSearchSurfaceMatch;
}

export interface SlideContentSearchIndex {
  search(query: string): readonly SlideSearchResult[];
}

export interface PresentationContentSearchIndex {
  search(
    query: string,
    scope?: PresentationSearchScope,
  ): readonly SlideSearchResult[];
}

export interface PresentationSearchableSlide {
  readonly slideId: number;
  readonly text: readonly string[];
  readonly noteParagraphs?: readonly string[];
}

interface IndexedParagraph {
  readonly display: string;
  readonly comparable: string;
}

interface IndexedSlide {
  readonly slideId: number;
  readonly text: readonly IndexedParagraph[];
  readonly notes: readonly IndexedParagraph[];
}

const MAX_SNIPPET_CONTEXT_CHARACTERS = 60;
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

interface RawTextRange {
  readonly start: number;
  readonly end: number;
}

function mappedDisplayText(value: string): {
  readonly display: string;
  readonly rawRanges: readonly RawTextRange[];
} {
  let display = "";
  const rawRanges: RawTextRange[] = [];
  for (const segment of graphemeSegmenter.segment(value)) {
    const normalized = segment.segment.normalize("NFKC");
    const rawRange = {
      start: segment.index,
      end: segment.index + segment.segment.length,
    };
    for (const symbol of normalized) {
      if (/\s/u.test(symbol)) {
        if (display.length === 0) continue;
        if (display.endsWith(" ")) {
          const last = rawRanges.at(-1);
          if (last) rawRanges[rawRanges.length - 1] = {
            start: last.start,
            end: rawRange.end,
          };
          continue;
        }
        display += " ";
        rawRanges.push(rawRange);
        continue;
      }
      display += symbol;
      for (let offset = 0; offset < symbol.length; offset += 1) {
        rawRanges.push(rawRange);
      }
    }
  }
  if (display.endsWith(" ")) {
    display = display.slice(0, -1);
    rawRanges.pop();
  }
  return { display, rawRanges };
}

function snippetContext(
  display: string,
  matchStart: number,
  matchEnd: number,
): SlideSearchSnippet {
  const boundedContext = MAX_SNIPPET_CONTEXT_CHARACTERS - 1;
  const beforeStart = Math.max(0, matchStart - boundedContext);
  const afterEnd = Math.min(display.length, matchEnd + boundedContext);
  return {
    before: `${beforeStart > 0 ? "…" : ""}${display.slice(beforeStart, matchStart)}`,
    match: display.slice(matchStart, matchEnd),
    after: `${display.slice(matchEnd, afterEnd)}${afterEnd < display.length ? "…" : ""}`,
  };
}

function displayRangeForComparableMatch(
  display: string,
  comparableStart: number,
  comparableLength: number,
): { readonly start: number; readonly end: number } {
  const comparableEnd = comparableStart + comparableLength;
  let displayOffset = 0;
  let comparableOffset = 0;
  let start: number | undefined;
  for (const symbol of display) {
    const nextDisplayOffset = displayOffset + symbol.length;
    const nextComparableOffset = comparableOffset + symbol.toLowerCase().length;
    if (start === undefined && comparableStart < nextComparableOffset) {
      start = displayOffset;
    }
    if (comparableEnd <= nextComparableOffset) {
      return { start: start ?? displayOffset, end: nextDisplayOffset };
    }
    displayOffset = nextDisplayOffset;
    comparableOffset = nextComparableOffset;
  }
  return { start: start ?? display.length, end: display.length };
}

function displayText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function comparableText(value: string): string {
  return displayText(value).toLowerCase();
}

export function normalizedDisplayMatchRange(
  value: string,
  normalizedMatch: string,
): RawTextRange | null {
  const mapped = mappedDisplayText(value);
  const comparableMatch = comparableText(normalizedMatch);
  if (!comparableMatch) return null;
  const comparableStart = mapped.display.toLowerCase().indexOf(comparableMatch);
  if (comparableStart < 0) return null;
  const displayRange = displayRangeForComparableMatch(
    mapped.display,
    comparableStart,
    comparableMatch.length,
  );
  const start = mapped.rawRanges[displayRange.start]?.start;
  const end = mapped.rawRanges[displayRange.end - 1]?.end;
  return start === undefined || end === undefined ? null : { start, end };
}

function occurrenceCount(text: string, query: string): number {
  let count = 0;
  let offset = 0;
  while (offset <= text.length - query.length) {
    const match = text.indexOf(query, offset);
    if (match < 0) break;
    count += 1;
    offset = match + query.length;
  }
  return count;
}

function indexParagraphs(
  paragraphs: readonly string[],
): readonly IndexedParagraph[] {
  return paragraphs.map((paragraph) => {
    const display = displayText(paragraph);
    return { display, comparable: display.toLowerCase() };
  });
}

function matchSurface(
  paragraphs: readonly IndexedParagraph[],
  comparableQuery: string,
): PresentationSearchSurfaceMatch | undefined {
  let matchCount = 0;
  let snippet: SlideSearchSnippet | undefined;
  for (const { display, comparable } of paragraphs) {
    const firstMatch = comparable.indexOf(comparableQuery);
    if (firstMatch < 0) continue;
    matchCount += occurrenceCount(comparable, comparableQuery);
    if (snippet === undefined) {
      const match = displayRangeForComparableMatch(
        display,
        firstMatch,
        comparableQuery.length,
      );
      snippet = snippetContext(display, match.start, match.end);
    }
  }
  return snippet === undefined ? undefined : { matchCount, snippet };
}

export function searchSlideContent(
  slides: readonly PptxSourceAuthoredSlideText[],
  query: string,
): readonly SlideSearchResult[] {
  return createSlideContentSearchIndex(slides).search(query);
}

export function createSlideContentSearchIndex(
  slides: readonly PptxSourceAuthoredSlideText[],
): SlideContentSearchIndex {
  const index = createPresentationContentSearchIndex(
    slides.map((slide) => ({
      slideId: slide.slideId,
      text: slide.text,
    })),
  );
  return {
    search: (query) =>
      index.search(query, "slides").map(({
        slideId,
        slideIndex,
        matchCount,
        snippet,
      }) => ({
        slideId,
        slideIndex,
        matchCount,
        snippet,
      })),
  };
}

export function createPresentationContentSearchIndex(
  slides: readonly PresentationSearchableSlide[],
): PresentationContentSearchIndex {
  const indexedSlides: readonly IndexedSlide[] = slides.map((slide) => ({
    slideId: slide.slideId,
    text: indexParagraphs(slide.text),
    notes: indexParagraphs(slide.noteParagraphs ?? []),
  }));
  return {
    search: (query, scope = "all") =>
      searchIndexedPresentationContent(indexedSlides, query, scope),
  };
}

export function mergePresentationSearchSlides(
  slideText: readonly PptxSourceAuthoredSlideText[],
  speakerNotes: readonly PptxSpeakerNoteContent[] | undefined,
): readonly PresentationSearchableSlide[] | undefined {
  if (
    slideText.length === 0 ||
    !hasUsableSpeakerNoteContent(speakerNotes)
  ) {
    return undefined;
  }
  const notesBySlideId = indexSpeakerNoteContent(
    slideText.map(({ slideId }) => slideId),
    speakerNotes,
  );
  if (notesBySlideId === undefined) return undefined;
  return slideText.map((slide) => ({
    slideId: slide.slideId,
    text: slide.text,
    noteParagraphs: notesBySlideId.get(slide.slideId) ?? [],
  }));
}

function searchIndexedPresentationContent(
  slides: readonly IndexedSlide[],
  query: string,
  scope: PresentationSearchScope,
): readonly SlideSearchResult[] {
  const comparableQuery = comparableText(query);
  if (!comparableQuery) return [];

  const includeSlides = scope === "all" || scope === "slides";
  const includeNotes = scope === "all" || scope === "notes";
  const results: SlideSearchResult[] = [];

  slides.forEach((slide, slideIndex) => {
    const slideText = includeSlides
      ? matchSurface(slide.text, comparableQuery)
      : undefined;
    const speakerNotes = includeNotes
      ? matchSurface(slide.notes, comparableQuery)
      : undefined;
    if (slideText === undefined && speakerNotes === undefined) return;

    const primary = slideText ?? speakerNotes!;
    results.push({
      slideId: slide.slideId,
      slideIndex,
      matchCount: (slideText?.matchCount ?? 0) + (speakerNotes?.matchCount ?? 0),
      snippet: primary.snippet,
      slideText,
      speakerNotes,
    });
  });
  return results;
}
