import {
  canonicalCompanionNotePath,
  formatCompanionNoteMarkdown,
  isCompanionNotePathConflict,
  isNormalizedMarkdownPath,
  isNormalizedPptxPath,
  normalizeVaultRelativePath,
} from "../src/presentation-companion-note";

describe("presentation companion note paths", () => {
  it("derives the same-directory same-basename Markdown path", () => {
    expect(canonicalCompanionNotePath("deck.pptx")).toBe("deck.md");
    expect(canonicalCompanionNotePath("Talks/Q1 Review.pptx")).toBe(
      "Talks/Q1 Review.md",
    );
    expect(canonicalCompanionNotePath("nested/deep/报告.pptx")).toBe(
      "nested/deep/报告.md",
    );
  });

  it("rejects absolute, traversal, empty, and non-pptx sources", () => {
    expect(canonicalCompanionNotePath("")).toBeUndefined();
    expect(canonicalCompanionNotePath("/abs/deck.pptx")).toBeUndefined();
    expect(canonicalCompanionNotePath("C:\\deck.pptx")).toBeUndefined();
    expect(canonicalCompanionNotePath("../deck.pptx")).toBeUndefined();
    expect(canonicalCompanionNotePath("folder/../deck.pptx")).toBeUndefined();
    expect(canonicalCompanionNotePath("deck.ppt")).toBeUndefined();
    expect(canonicalCompanionNotePath("deck.md")).toBeUndefined();
  });

  it("normalizes separators and rejects unsafe Vault paths", () => {
    expect(normalizeVaultRelativePath("Talks\\deck.pptx")).toBe(
      "Talks/deck.pptx",
    );
    expect(normalizeVaultRelativePath("./Talks/deck.pptx")).toBeUndefined();
    expect(normalizeVaultRelativePath("Talks//deck.pptx")).toBe(
      "Talks/deck.pptx",
    );
    expect(isNormalizedPptxPath("Talks/deck.pptx")).toBe(true);
    expect(isNormalizedPptxPath("Talks/deck.PPTX")).toBe(false);
    expect(isNormalizedMarkdownPath("Talks/deck.md")).toBe(true);
    expect(isNormalizedMarkdownPath("Talks/deck.markdown")).toBe(false);
  });

  it("derives path conflict from canonical mismatch without a status field", () => {
    expect(
      isCompanionNotePathConflict("Talks/a.pptx", "Talks/a.md"),
    ).toBe(false);
    expect(
      isCompanionNotePathConflict("Talks/a.pptx", "Notes/a.md"),
    ).toBe(true);
  });
});

describe("presentation companion note markdown", () => {
  it("creates only a heading and ordinary source wikilink", () => {
    expect(formatCompanionNoteMarkdown("Talks/Q1 Review.pptx")).toBe(
      "# Q1 Review\n\n[[Talks/Q1 Review.pptx]]\n",
    );
  });

  it("escapes Markdown-sensitive and wikilink-sensitive characters", () => {
    expect(formatCompanionNoteMarkdown("folder/# Hash | Pipe].pptx")).toBe(
      "# \\# Hash | Pipe]\n\n[[folder/%23 Hash %7C Pipe%5D.pptx]]\n",
    );
  });
});
