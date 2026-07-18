import { describe, expect, it } from "vitest";
import { searchSlideContent } from "../src/slide-content-search";

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
});
