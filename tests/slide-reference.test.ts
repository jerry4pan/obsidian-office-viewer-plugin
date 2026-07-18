import { describe, expect, it } from "vitest";
import {
  formatSlideReferenceFragment,
  formatSlideReferenceMarkup,
  parseSlideReferenceFragment,
  parseSlideReferenceLink,
} from "../src/slide-reference";

describe("slide reference fragment", () => {
  it("round-trips the stable identity and creation-time ordinal", () => {
    const fragment = formatSlideReferenceFragment({
      slideId: 256,
      createdSlideNumber: 12,
    });

    expect(fragment).toBe("#slide-id=256&slide=12");
    expect(parseSlideReferenceFragment(fragment)).toEqual({
      slideId: 256,
      createdSlideNumber: 12,
    });
  });

  it.each([
    "",
    "slide-id=256&slide=12",
    "#slide=12&slide-id=256",
    "#slide-id=0&slide=1",
    "#slide-id=256&slide=0",
    "#slide-id=0256&slide=1",
    "#slide-id=4294967296&slide=1",
    "#slide-id=256&slide=01",
    "#slide-id=256&slide=1&extra=true",
    "#slide-id=private&slide=1",
  ])("rejects non-canonical fragment %j", (fragment) => {
    expect(parseSlideReferenceFragment(fragment)).toBeNull();
  });

  it("rejects invalid values before formatting", () => {
    expect(() =>
      formatSlideReferenceFragment({ slideId: 0, createdSlideNumber: 1 })
    ).toThrow();
    expect(() =>
      formatSlideReferenceFragment({
        slideId: 256,
        createdSlideNumber: Number.NaN,
      })
    ).toThrow();
  });

  it("formats canonical reference and embed markup with a full Vault path", () => {
    const input = {
      sourcePath: "clients/acme/deck.pptx",
      alias: "deck — Slide 12",
      slideId: 256,
      createdSlideNumber: 12,
    } as const;

    expect(formatSlideReferenceMarkup({ ...input, embed: false })).toBe(
      "[[clients/acme/deck.pptx#slide-id=256&slide=12|deck — Slide 12]]",
    );
    expect(formatSlideReferenceMarkup({ ...input, embed: true })).toBe(
      "![[clients/acme/deck.pptx#slide-id=256&slide=12|deck — Slide 12]]",
    );
  });

  it("encodes wikilink path delimiters and escapes alias delimiters", () => {
    expect(formatSlideReferenceMarkup({
      sourcePath: "clients/a#b/[deck]|100%.pptx",
      alias: "deck | final]",
      slideId: 256,
      createdSlideNumber: 1,
      embed: false,
    })).toBe(
      "[[clients/a%23b/%5Bdeck%5D%7C100%25.pptx#slide-id=256&slide=1|deck \\| final\\]]]",
    );
  });

  it("parses the shared encoded source path and fragment contract", () => {
    expect(parseSlideReferenceLink(
      "clients/a%23b/%5Bdeck%5D%7C100%25.pptx#slide-id=256&slide=1",
    )).toEqual({
      sourcePath: "clients/a#b/[deck]|100%.pptx",
      target: { slideId: 256, createdSlideNumber: 1 },
    });
  });

  it.each([
    "deck.pptx",
    "../deck.pptx#slide-id=256&slide=1",
    "%ZZ.pptx#slide-id=256&slide=1",
    "deck.pptx#slide-id=0&slide=1",
    "deck.pptx#slide-id=256&slide=1&extra=true",
  ])("rejects malformed shared link target %j", (linktext) => {
    expect(parseSlideReferenceLink(linktext)).toBeNull();
  });

  it.each(["", "/deck.pptx", "../deck.pptx", "folder\\deck.pptx", "a//deck.pptx"])(
    "rejects non-normalized Vault path %j",
    (sourcePath) => {
      expect(() => formatSlideReferenceMarkup({
        sourcePath,
        alias: "deck — Slide 1",
        slideId: 256,
        createdSlideNumber: 1,
        embed: false,
      })).toThrow();
    },
  );
});
