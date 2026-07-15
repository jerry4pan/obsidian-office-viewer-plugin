# Multilingual UI Definition

- Status: Approved
- Approved: 2026-07-15
- Scope: First multilingual release of the Obsidian Office Viewer interface

## Purpose

Office Viewer must present its plugin-owned interface in English, Simplified
Chinese, or Traditional Chinese by following Obsidian's language. This work is
limited to multilingual interface text. It does not broaden into general
internationalization or localization work.

This definition narrows the v0.1 product requirements without changing the
local, read-only PPTX rendering boundary in
[ADR-0001](../adr/0001-select-aiden-pptx-renderer-for-m0.md). The domain
meanings of supported locale, message locale, and user-facing message are
authoritative in [`CONTEXT.md`](../../CONTEXT.md).

## Supported message locales

The first supported message locales are:

| Message locale | User-facing language | Catalog role |
| --- | --- | --- |
| `en` | English | Source catalog and runtime fallback |
| `zh-Hans` | Simplified Chinese | Complete, human-reviewed translation |
| `zh-Hant` | Region-neutral Traditional Chinese | Complete, human-reviewed translation shared by Traditional Chinese regions |

A language is supported only when its complete catalog has passed human review
and its critical interface flows pass the locale acceptance matrix. Merely
shipping a partial or machine-generated catalog does not make a language
supported.

## Locale selection

The plugin resolves its message locale once when it loads by reading
Obsidian's language. It does not expose a separate language setting and does
not attempt live language switching. A changed Obsidian language takes effect
when Obsidian or the plugin next loads.

Locale matching is case-insensitive and treats underscores as hyphens before
matching:

| Obsidian language | Message locale |
| --- | --- |
| `en` and English region variants | `en` |
| `zh`, `zh-CN`, `zh-SG`, `zh-Hans` and equivalent normalized variants | `zh-Hans` |
| `zh-TW`, `zh-HK`, `zh-MO`, `zh-Hant` and equivalent normalized variants | `zh-Hant` |
| Unsupported, empty, or invalid value | `en` |

English fallback applies at two levels:

1. an unsupported Obsidian language selects the English catalog;
2. an unexpectedly missing message in a selected catalog resolves to the
   English message rather than an empty string or a message key.

The second fallback is a runtime safety net. Catalog validation must prevent a
supported locale with missing messages from reaching release.

## Translation surface

Translate every plugin-owned user-facing message, including text visible in
the interface and text announced by assistive technology. The current surface
includes:

- the empty, loading, ready, degraded, and blocking-error states;
- previous, next, page jump, thumbnail, full-screen, retry, and external-open
  controls;
- current-page, validation, navigation-failure, full-screen-failure, and
  external-open-failure messages;
- all stable user-facing PPTX open-error explanations and the source-safety
  assurance;
- thumbnail rail labels, thumbnail labels, and unavailable-preview text;
- the thumbnail resize separator's accessible label, title, and value text;
- accessible labels, live-region messages, tooltips, and other
  plugin-authored accessible descriptions;
- the plugin view's fallback display title;
- setting names and descriptions.

Do not translate presentation content, filenames, Vault-relative paths, or
text produced by the PPTX itself. Product names and technical identifiers such
as `Obsidian`, `Office Viewer`, and `PPTX` remain unchanged.

The following English text remains outside the translation surface:

- console messages and non-fatal developer logging;
- internal exception messages and renderer-specific details;
- stable diagnostic and error category identifiers;
- compatibility, performance, and other development reports;
- test-fixture content.

Internal errors must continue to be mapped to translated, stable user-facing
messages at the existing product boundary. Candidate-specific or sensitive
details must not leak merely because a message is translated.

## Message catalog contract

Use a small project-owned translation layer with no new runtime i18n
dependency. It must provide one typed message lookup entry point and package
all three catalogs with the plugin.

The English catalog is the only source catalog. Simplified and Traditional
Chinese catalogs must contain exactly the same message keys and named
placeholders. Dynamic values use named placeholders such as `{slide}` and
`{total}` rather than positional substitution. Interpolation produces text,
not HTML.

Catalog validation must reject:

- a missing or extra key in either Chinese catalog;
- missing, extra, or renamed placeholders;
- an empty translated value;
- an unknown message key at a typed call site.

The first release does not introduce ICU messages, plural rules, gender rules,
date formatting, number formatting, unit formatting, runtime catalog loading,
or online translation downloads. Those capabilities require a later, concrete
product need.

## Terminology and human review

Translation quality is a release requirement:

- Obsidian-owned concepts use terminology from
  [Obsidian's official translations](https://github.com/obsidianmd/obsidian-translations)
  when an upstream term exists.
- Office Viewer maintains a short English/Simplified Chinese/Traditional
  Chinese terminology table for plugin-owned concepts.
- Translators may rewrite sentence structure for natural language, but must
  not silently replace approved terms.
- Machine or AI translation may create a draft only. It cannot approve a
  supported catalog.

Every pull request that adds or changes an English user-facing message must
update both Chinese catalogs in the same pull request. Each Chinese catalog
requires approval from at least one person proficient in that written
language. One reviewer may approve both catalogs only when qualified to review
both. The pull request or release evidence must retain that approval; catalog
structure passing CI is not a substitute for language review.

## Test matrix

### Fast contract tests

For every change, automated tests must prove:

- all specified Obsidian language variants resolve to the expected message
  locale;
- unsupported, empty, and invalid values resolve to English;
- message lookup falls back to the English value if a runtime catalog lookup
  unexpectedly misses;
- the catalogs have identical keys and named placeholders, with no empty
  values;
- interpolation fills named values without exposing raw message keys.

### DOM tests

The existing deterministic DOM seams run in `en`, `zh-Hans`, and `zh-Hant` and
cover at least:

- empty and loading states;
- ready-view navigation and page-jump validation;
- degraded navigation and action failure messages;
- all stable blocking-error categories, retry, safety, and external-open text;
- thumbnail rail, unavailable thumbnail, resize separator, tooltip, and
  accessible-label text;
- settings names and descriptions;
- full-screen enter/exit labels.

Assertions target plugin-owned elements and attributes so presentation or
fixture text is not mistaken for an untranslated plugin message. Each locale
must show the expected message, not merely any non-empty text.

### Installed Obsidian smoke tests

Run one critical installed path for each message locale. Each path proves that
the packaged plugin follows the Obsidian language, opens a local PPTX, renders
the expected translated controls, navigates, and retains the existing
read-only and offline behavior.

The complete installed behavior, compatibility, and performance suites do not
need to be duplicated for every locale. They remain authoritative for product
behavior and run once through their existing default configuration.

## Acceptance criteria

The first multilingual release is complete only when all of the following are
true:

1. Every in-scope plugin-owned user-facing message is retrieved through the
   translation layer; no in-scope hard-coded English UI literal remains.
2. The locale resolver passes the complete mapping table and English fallback
   cases.
3. All three catalogs pass key, placeholder, and non-empty-value validation.
4. A missing runtime translation safely returns the corresponding English
   message and never displays a blank value or raw message key.
5. English, Simplified Chinese, and Traditional Chinese DOM matrices pass for
   the complete translation surface.
6. The installed Obsidian smoke path passes once for each supported message
   locale.
7. Simplified and Traditional Chinese catalogs have recorded human approval,
   including the project terminology table.
8. Existing type checking, unit, installed E2E, compatibility, and performance
   verification remain green without weaker gates.

## Explicit non-goals

This work does not include:

- any language beyond English, Simplified Chinese, and Traditional Chinese;
- a plugin-specific language selector or live language switching;
- separate Traditional Chinese catalogs for Taiwan, Hong Kong, or Macau;
- RTL layout or any claim of support for an RTL language;
- font availability, font substitution, complex-script shaping, or
  presentation-text compatibility work;
- locale-sensitive dates, numbers, percentages, units, collation, or sorting;
- IME or keyboard-layout-specific behavior;
- new accessibility behavior beyond translating existing user-facing
  accessible text;
- localized README files, manifest/store copy, release notes, screenshots, or
  other publishing documentation;
- translation of PPTX content, filenames, or user data;
- localization of logs, internal exceptions, diagnostics, or development
  reports;
- visual screenshot matrices, RTL tests, font tests, IME tests, or regional
  formatting tests;
- an external i18n framework, ICU message system, remote catalog service, or
  automatic translation pipeline.

Any future request in these areas is a separate scope decision and does not
retroactively expand what this multilingual release promises.
