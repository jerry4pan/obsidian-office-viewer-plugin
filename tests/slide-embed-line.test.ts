import { describe, expect, it } from "vitest";
import { matchStandaloneSlideEmbedLine } from "../src/slide-embed-line";

describe("matchStandaloneSlideEmbedLine", () => {
  it("accepts a canonical standalone embed with leading and trailing whitespace", () => {
    const embed =
      "![[folder/deck.pptx#slide-id=261&slide=4|deck — Slide 4]]";
    const line = `  ${embed}  `;
    expect(matchStandaloneSlideEmbedLine(line)).toEqual({
      sourcePath: "folder/deck.pptx",
      target: { slideId: 261, createdSlideNumber: 4 },
      fromOffset: 2,
      toOffset: 2 + embed.length,
    });
  });

  it("accepts a canonical embed without an alias", () => {
    const embed = "![[deck.pptx#slide-id=256&slide=1]]";
    expect(matchStandaloneSlideEmbedLine(embed)).toEqual({
      sourcePath: "deck.pptx",
      target: { slideId: 256, createdSlideNumber: 1 },
      fromOffset: 0,
      toOffset: embed.length,
    });
  });

  it.each([
    ["adjacent prose before", "see ![[deck.pptx#slide-id=256&slide=1]]"],
    ["adjacent prose after", "![[deck.pptx#slide-id=256&slide=1]] here"],
    ["two embeds on one line", "![[a.pptx#slide-id=256&slide=1]] ![[b.pptx#slide-id=256&slide=1]]"],
    ["plain pptx embed", "![[deck.pptx]]"],
    ["non-pptx embed", "![[note.md#slide-id=256&slide=1]]"],
    ["wikilink without embed marker", "[[deck.pptx#slide-id=256&slide=1]]"],
    ["partial typed syntax", "![[deck.pptx#slide-id=256&slide=1"],
    ["malformed fragment", "![[deck.pptx#slide=1]]"],
    ["empty line", ""],
    ["ordinary text", "hello"],
  ])("rejects %s", (_label, line) => {
    expect(matchStandaloneSlideEmbedLine(line)).toBeNull();
  });
});
