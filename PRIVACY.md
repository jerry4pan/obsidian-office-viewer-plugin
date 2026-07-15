# Privacy

Office Viewer processes presentation files locally inside desktop Obsidian.
The normal viewing path does not upload files, call a cloud renderer, follow
external media relationships, or send telemetry or analytics.

The plugin reads `.pptx` source bytes through Obsidian's Vault API and never
writes back to the presentation. Optional reading-position history stores only
a Vault-relative path, file size, modification time, zero-based slide index,
and update timestamp in the plugin data store. It can be disabled and cleared
from settings.

The user-triggered diagnostic summary contains plugin, Obsidian, renderer, and
operating-system versions; source byte size; slide count when known; timings;
stable warning/error categories; and anonymous feature flags. It excludes
filenames, paths, presentation text, images, author metadata, URLs, raw errors,
and rendered content. Copying the summary writes it only to the local clipboard.

**Open in default application** is an explicit action. After it is selected,
the operating system and chosen application control any subsequent processing
or network behavior.
