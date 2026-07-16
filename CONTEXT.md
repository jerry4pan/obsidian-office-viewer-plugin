# Obsidian Office Viewer

Obsidian Office Viewer provides a trustworthy, local, read-only presentation
reading experience inside Obsidian.

## Knowledge workflow

**Knowledge material**:
A local Office document that a reader uses as input to knowledge work and
needs to locate, reference, or reuse inside Obsidian without changing the
source document. Format coverage is valuable only when it advances this
workflow, not as a standalone measure of product breadth.
_Avoid_: Supported file, Office file

**Knowledge reference loop**:
The complete reader journey from finding relevant content, opening its precise
location, copying or embedding it with its source, and returning to that
location later. A new document format is useful only when this loop works; a
standalone preview is not the completed journey.
_Avoid_: Preview flow, Open-file flow

## Globalization

**Supported locale**:
A plugin interface locale whose user-facing text has been reviewed by a human
proficient in that language, whose catalog is complete against the English
source catalog, and whose critical reading flows pass the locale acceptance
matrix. The first supported locales are English, Simplified Chinese, and
Traditional Chinese; English is the fallback when the Obsidian locale has no
supported match.
_Avoid_: Available language, translated language

**Message locale**:
The supported locale selected from Obsidian's language when the plugin loads
and used for plugin-owned interface text. English variants resolve to `en`,
Simplified Chinese variants to `zh-Hans`, and Traditional Chinese variants to
one region-neutral `zh-Hant`; unsupported or invalid values resolve to `en`.
Changing the Obsidian language takes effect when Obsidian or the plugin next
loads.
_Avoid_: Language setting, display language

**User-facing message**:
Plugin-owned text that a reader can see in the interface or that assistive
technology can announce, including controls, settings, status and validation
messages, error surfaces, tooltips, and accessible labels. Developer logs,
internal exceptions, diagnostic categories, and development reports are not
user-facing messages.
_Avoid_: Log message, diagnostic detail
