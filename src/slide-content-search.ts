import type { PptxSourceAuthoredSlideText } from "./renderer/pptx-renderer-adapter";

export interface SlideSearchSnippet {
  readonly before: string;
  readonly match: string;
  readonly after: string;
}

export interface SlideSearchResult {
  readonly slideId: number;
  readonly slideIndex: number;
  readonly matchCount: number;
  readonly snippet: SlideSearchSnippet;
}

export interface SlideContentSearchIndex {
  search(query: string): readonly SlideSearchResult[];
}

interface IndexedParagraph {
  readonly display: string;
  readonly comparable: string;
}

interface IndexedSlide {
  readonly slideId: number;
  readonly text: readonly IndexedParagraph[];
}

const MAX_SNIPPET_CONTEXT_CHARACTERS = 60;

function snippetContext(
  display: string,
  matchStart: number,
  matchLength: number,
): SlideSearchSnippet {
  const boundedContext = MAX_SNIPPET_CONTEXT_CHARACTERS - 1;
  const beforeStart = Math.max(0, matchStart - boundedContext);
  const afterStart = matchStart + matchLength;
  const afterEnd = Math.min(display.length, afterStart + boundedContext);
  return {
    before: `${beforeStart > 0 ? "…" : ""}${display.slice(beforeStart, matchStart)}`,
    match: display.slice(matchStart, afterStart),
    after: `${display.slice(afterStart, afterEnd)}${afterEnd < display.length ? "…" : ""}`,
  };
}

function displayText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function comparableText(value: string): string {
  return displayText(value).toLowerCase();
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

export function searchSlideContent(
  slides: readonly PptxSourceAuthoredSlideText[],
  query: string,
): readonly SlideSearchResult[] {
  return createSlideContentSearchIndex(slides).search(query);
}

export function createSlideContentSearchIndex(
  slides: readonly PptxSourceAuthoredSlideText[],
): SlideContentSearchIndex {
  const indexedSlides: readonly IndexedSlide[] = slides.map((slide) => ({
    slideId: slide.slideId,
    text: slide.text.map((paragraph) => {
      const display = displayText(paragraph);
      return { display, comparable: display.toLowerCase() };
    }),
  }));
  return {
    search: (query) => searchIndexedSlideContent(indexedSlides, query),
  };
}

function searchIndexedSlideContent(
  slides: readonly IndexedSlide[],
  query: string,
): readonly SlideSearchResult[] {
  const comparableQuery = comparableText(query);
  if (!comparableQuery) return [];

  const results: SlideSearchResult[] = [];
  slides.forEach((slide, slideIndex) => {
    let matchCount = 0;
    let snippet: SlideSearchSnippet | undefined;
    for (const { display, comparable } of slide.text) {
      const firstMatch = comparable.indexOf(comparableQuery);
      if (firstMatch < 0) continue;
      matchCount += occurrenceCount(comparable, comparableQuery);
      snippet ??= snippetContext(display, firstMatch, comparableQuery.length);
    }
    if (snippet) {
      results.push({
        slideId: slide.slideId,
        slideIndex,
        matchCount,
        snippet,
      });
    }
  });
  return results;
}
