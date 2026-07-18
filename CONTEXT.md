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

**Knowledge reference loop technical exploration**:
A bounded engineering phase that tests the technical feasibility of supporting
the **Knowledge reference loop** for **Knowledge material**. It may finish while
post-release validation remains open, but it does not establish real-reader
workflow value or commit the project to ship a complete v0.2 product.
_Avoid_: v0.2 implementation, Workflow validation, M4 completion

**Slide content search**:
A local search within one open PPTX **Knowledge material** that returns matching
reader-visible slide text as precise slide locations, allowing the reader to
continue through the **Knowledge reference loop**. Speaker notes are not part of
the initial search surface. Matches derived from OCR must be distinguishable
from source-authored text because recognition may be wrong. The search does not
imply a persistent or Vault-wide content index; its query, extracted or
recognized text, and results do not outlive the active reading session.
_Avoid_: Vault search, File search

**Source-authored slide text**:
Reader-visible text directly authored in a slide's own titles, body content,
text boxes, shapes, or table cells. It excludes speaker notes, master or layout
text, chart or SmartArt data, and text contained in images.
_Avoid_: Extracted text, All slide text

**Slide search result**:
One slide-level result from **Slide content search**, anchored to the slide's
stable identity and summarizing one or more matches within that slide. Multiple
matches do not create separate results for character positions.
_Avoid_: Text occurrence, Search hit

**Slide reference**:
A source-preserving Obsidian reference to one precise slide in a PPTX
**Knowledge material**. It follows the slide's stable identity when the source
presentation is reordered and distinguishes the creation-time ordinal from the
current ordinal. Following it returns the reader to that presentation and
slide, while a deleted target is reported as unavailable rather than silently
redirected to the same ordinal position.
_Avoid_: Page link, Deep link, PPTX link

**Slide embed**:
An inline, read-only view of the current local source slide identified by a
**Slide reference** inside an Obsidian note. It reflects source changes when the
note is viewed again and preserves the source relationship instead of becoming
an unrelated screenshot or copied asset.
_Avoid_: Screenshot, Image attachment, Full-deck embed

## Example dialogue

> **Developer:** Does opening another Office format advance the Knowledge
> reference loop?
>
> **Domain expert:** Not by itself. First use Knowledge reference loop technical
> exploration to prove that a Slide reference and Slide embed can safely return
> to a precise location. Real-reader workflow value still needs separate
> validation.

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
