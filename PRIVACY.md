# Privacy

Office Viewer processes presentation files locally inside desktop Obsidian.
The normal viewing path does not upload files, call a cloud renderer, follow
external media relationships, or send telemetry or analytics.

The plugin reads `.pptx` source bytes through Obsidian's Vault API and never
writes back to the presentation. Optional reading-position history stores only
a Vault-relative path, file size, modification time, zero-based slide index,
and update timestamp in the plugin data store. It can be disabled and cleared
from settings.

**Diagnostic summary** is off by default. When you enable it, detectable
compatibility warnings and the copy control appear on the next open, retry, or
reload of a file. Enabling the setting does not upload data or submit a report
automatically.

The user-triggered diagnostic summary contains plugin, Obsidian, renderer, and
operating-system versions; source byte size; slide count when known; timings;
stable warning/error categories; and anonymous feature flags. It excludes
filenames, paths, presentation text, images, author metadata, URLs, raw errors,
and rendered content. Copying the summary writes it only to the local clipboard.

Compatibility-check results exist only for the current view lifecycle and are
not persisted as a document archive.

Slide content search is local to one open presentation and one view lifecycle.
The query, source-authored slide text read from slide XML, normalized text,
snippets, and results are not written to plugin data, diagnostics, logs,
Markdown, or the source presentation. Search performance evidence contains
only elapsed time and mounted-result counts.

**Open in default application** is an explicit action. After it is selected,
the operating system and chosen application control any subsequent processing
or network behavior.
