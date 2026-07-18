import { describe, expect, it, vi } from "vitest";
import {
  createSlideContentSearchIndex,
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
