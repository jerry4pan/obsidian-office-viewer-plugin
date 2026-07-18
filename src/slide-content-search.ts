import type { PptxSlideContent } from "./renderer/pptx-renderer-adapter";

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
  slides: readonly PptxSlideContent[],
  query: string,
): readonly SlideSearchResult[] {
  const comparableQuery = comparableText(query);
  if (!comparableQuery) return [];

  const results: SlideSearchResult[] = [];
  slides.forEach((slide, slideIndex) => {
    let matchCount = 0;
    let snippet: SlideSearchSnippet | undefined;
    for (const paragraph of slide.text) {
      const display = displayText(paragraph);
      const comparable = display.toLowerCase();
      const firstMatch = comparable.indexOf(comparableQuery);
      if (firstMatch < 0) continue;
      matchCount += occurrenceCount(comparable, comparableQuery);
      snippet ??= {
        before: display.slice(0, firstMatch),
        match: display.slice(firstMatch, firstMatch + comparableQuery.length),
        after: display.slice(firstMatch + comparableQuery.length),
      };
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
