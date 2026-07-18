import { describe, expect, it, vi } from "vitest";
import {
  createPresentationContentSearchIndex,
  createSlideContentSearchIndex,
  mergePresentationSearchSlides,
  normalizedDisplayMatchRange,
  searchSlideContent,
} from "../src/slide-content-search";

describe("Slide content search", () => {
  it("returns one result per slide with a representative match and count", () => {
    const results = searchSlideContent([
      {
        slideId: 256,
        text: ["Quarterly Revenue", "Revenue target: 100"],
      },
      { slideId: 257, text: ["Operating margin"] },
    ], "revenue");

    expect(results).toEqual([{
      slideId: 256,
      slideIndex: 0,
      matchCount: 2,
      snippet: {
        before: "Quarterly ",
        match: "Revenue",
        after: "",
      },
    }]);
  });

  it("normalizes case, compatibility characters, and whitespace", () => {
    const results = searchSlideContent([
      { slideId: 256, text: ["Other content"] },
      { slideId: 257, text: ["  ＲＥＶＥＮＵＥ\n   target  "] },
    ], "revenue target");

    expect(results).toEqual([expect.objectContaining({
      slideId: 257,
      slideIndex: 1,
      matchCount: 1,
      snippet: {
        before: "",
        match: "REVENUE target",
        after: "",
      },
    })]);
  });

  it("maps expanding Unicode lowercase matches back to the displayed text", () => {
    const slides = [
      { slideId: 256, text: ["AİBC"] },
    ];
    const results = searchSlideContent(slides, "bc");

    expect(results).toEqual([expect.objectContaining({
      matchCount: 1,
      snippet: {
        before: "Aİ",
        match: "BC",
        after: "",
      },
    })]);
    expect(searchSlideContent(slides, "i\u0307")[0]?.snippet.match).toBe("İ");
  });

  it("bounds snippet context around a match", () => {
    const results = searchSlideContent([
      {
        slideId: 256,
        text: [`${"a".repeat(500)}NEEDLE${"b".repeat(500)}`],
      },
    ], "needle");

    expect(results[0]?.snippet.before.length).toBeLessThanOrEqual(60);
    expect(results[0]?.snippet.after.length).toBeLessThanOrEqual(60);
    expect(results[0]?.snippet.match).toBe("NEEDLE");
  });

  it("normalizes source-authored text once for repeated session queries", () => {
    const normalize = vi.spyOn(String.prototype, "normalize");
    const index = createSlideContentSearchIndex([
      { slideId: 256, text: ["Needle text"] },
    ]);

    expect(index.search("needle")).toHaveLength(1);
    expect(index.search("missing")).toHaveLength(0);
    expect(normalize).toHaveBeenCalledTimes(3);
    normalize.mockRestore();
  });

  it("keeps a high-text-volume indexed query within an interactive budget", () => {
    const payload = "x".repeat(4 * 1024 * 1024);
    const index = createSlideContentSearchIndex(
      Array.from({ length: 4 }, (_, slideIndex) => ({
        slideId: 256 + slideIndex,
        text: [`${payload} marker-${slideIndex}`],
      })),
    );
    const startedAt = performance.now();

    expect(index.search("not present")).toHaveLength(0);
    expect(performance.now() - startedAt).toBeLessThanOrEqual(250);
  });
});

describe("Presentation content search", () => {
  it("keeps slide-only search when every notes entry is empty", () => {
    expect(
      mergePresentationSearchSlides(
        [
          { slideId: 256, text: ["Slide A"] },
          { slideId: 257, text: ["Slide B"] },
        ],
        [
          { slideId: 256, paragraphs: [] },
          { slideId: 257, paragraphs: [] },
        ],
      ),
    ).toBeUndefined();
  });

  const slides = [
    {
      slideId: 256,
      text: ["Visible revenue target"],
      noteParagraphs: ["Speaker note only marker NOTE_ONLY"],
    },
    {
      slideId: 257,
      text: ["Operating margin"],
      noteParagraphs: ["Margin context in notes"],
    },
    {
      slideId: 258,
      text: ["Shared needle on slide"],
      noteParagraphs: ["Shared needle in notes"],
    },
  ] as const;

  it("returns one result per slide with separate provenance for dual matches", () => {
    const results = createPresentationContentSearchIndex(slides).search(
      "needle",
      "all",
    );

    expect(results).toEqual([{
      slideId: 258,
      slideIndex: 2,
      matchCount: 2,
      snippet: {
        before: "Shared ",
        match: "needle",
        after: " on slide",
      },
      slideText: {
        matchCount: 1,
        snippet: {
          before: "Shared ",
          match: "needle",
          after: " on slide",
        },
      },
      speakerNotes: {
        matchCount: 1,
        snippet: {
          before: "Shared ",
          match: "needle",
          after: " in notes",
        },
      },
    }]);
  });

  it("finds notes-only matches under the default All scope", () => {
    const results = createPresentationContentSearchIndex(slides).search(
      "NOTE_ONLY",
    );

    expect(results).toEqual([expect.objectContaining({
      slideId: 256,
      slideIndex: 0,
      matchCount: 1,
      slideText: undefined,
      speakerNotes: expect.objectContaining({
        matchCount: 1,
        snippet: expect.objectContaining({ match: "NOTE_ONLY" }),
      }),
    })]);
  });

  it("filters the same index by All, Slides, and Notes scopes", () => {
    const index = createPresentationContentSearchIndex(slides);

    expect(index.search("needle", "all").map(({ slideId }) => slideId))
      .toEqual([258]);
    expect(index.search("needle", "slides")).toEqual([
      expect.objectContaining({
        slideId: 258,
        slideText: expect.anything(),
        speakerNotes: undefined,
      }),
    ]);
    expect(index.search("needle", "notes")).toEqual([
      expect.objectContaining({
        slideId: 258,
        slideText: undefined,
        speakerNotes: expect.anything(),
      }),
    ]);
    expect(index.search("NOTE_ONLY", "slides")).toEqual([]);
    expect(index.search("revenue", "notes")).toEqual([]);
  });

  it("keeps Unicode note matching display-safe", () => {
    const results = createPresentationContentSearchIndex([
      {
        slideId: 256,
        text: ["Slide canvas"],
        noteParagraphs: ["讲者备注标记 NOTE_ZH_HANS"],
      },
    ]).search("讲者备注标记");

    expect(results[0]?.speakerNotes?.snippet).toEqual({
      before: "",
      match: "讲者备注标记",
      after: " NOTE_ZH_HANS",
    });
  });

  it("maps normalized Unicode and collapsed whitespace matches back to raw text", () => {
    const raw = "Before ＡＢＣ\t  target After";
    const result = createPresentationContentSearchIndex([{
      slideId: 256,
      text: [],
      noteParagraphs: [raw],
    }]).search("abc target");
    const normalizedMatch = result[0]?.speakerNotes?.snippet.match;

    expect(normalizedMatch).toBe("ABC target");
    const range = normalizedDisplayMatchRange(raw, normalizedMatch!);
    expect(range).not.toBeNull();
    expect(raw.slice(range!.start, range!.end)).toBe("ＡＢＣ\t  target");
  });
});
