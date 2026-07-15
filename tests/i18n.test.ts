import { describe, expect, it } from "vitest";

import {
  createMessageTranslator,
  MESSAGE_CATALOGS,
  resolveMessageLocale,
} from "../src/i18n";

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/g)]
    .map((match) => match[1]!)
    .sort();
}

describe("message locale resolution", () => {
  it.each([
    ["en", "en"],
    ["en-US", "en"],
    ["EN_gb", "en"],
    ["zh", "zh-Hans"],
    ["zh-CN", "zh-Hans"],
    ["zh_SG", "zh-Hans"],
    ["zh-Hans", "zh-Hans"],
    ["zh-TW", "zh-Hant"],
    ["zh_HK", "zh-Hant"],
    ["zh-MO", "zh-Hant"],
    ["zh-Hant", "zh-Hant"],
    ["fr", "en"],
    ["", "en"],
    ["not a locale", "en"],
  ] as const)("resolves %j to %s", (input, expected) => {
    expect(resolveMessageLocale(input)).toBe(expected);
  });
});

describe("message catalog contract", () => {
  it.each(["zh-Hans", "zh-Hant"] as const)(
    "%s is complete against the English source catalog",
    (locale) => {
      const sourceEntries = Object.entries(MESSAGE_CATALOGS.en);
      const translatedEntries = Object.entries(MESSAGE_CATALOGS[locale]);

      expect(translatedEntries.map(([key]) => key).sort()).toEqual(
        sourceEntries.map(([key]) => key).sort(),
      );
      for (const [key, source] of sourceEntries) {
        const translated = MESSAGE_CATALOGS[locale][
          key as keyof typeof MESSAGE_CATALOGS.en
        ];
        expect(translated.trim(), `${locale}:${key}`).not.toBe("");
        expect(placeholders(translated), `${locale}:${key}`).toEqual(
          placeholders(source),
        );
      }
    },
  );

  it("interpolates named values", () => {
    const messages = createMessageTranslator("zh-CN");

    expect(messages.text("page.counter", { current: 2, total: 12 })).toBe(
      "2 / 12",
    );
  });

  it.each([{}, { "viewer.loading": "" }] as const)(
    "falls back to English for a missing or blank selected-locale value",
    (catalog) => {
      const messages = createMessageTranslator("zh-TW", catalog);

      expect(messages.text("viewer.loading")).toBe("Loading presentation…");
    },
  );
});
