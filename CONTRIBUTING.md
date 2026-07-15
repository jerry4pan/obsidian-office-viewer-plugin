# Contributing

## Development

Use Node.js 22 and run:

```bash
npm ci
npm run verify
npm run test:e2e
npm run test:compatibility
npm run test:performance:baseline
npm run release:check
```

Keep renderer-specific objects behind `PptxRendererAdapter`, read presentation
bytes only through the Vault API, and do not add network, conversion, editing,
telemetry, or source-write behavior. Any English user-facing message change
must update the Simplified and Traditional Chinese catalogs and retain the
human-review evidence described in `docs/globalization/multilingual-ui.md`.

## Bug reports and feature requests

Use GitHub Issues. Before reporting a bug, retry in the latest version and use
**Copy diagnostic summary** in the affected viewer. Include:

- exact Office Viewer and Obsidian versions;
- operating system;
- steps to reproduce;
- expected and actual behavior;
- the content-free diagnostic summary;
- whether **Open in default application** displays the file correctly.

Do not upload confidential presentations, screenshots containing sensitive
content, filenames, paths, extracted text, or raw renderer errors. If a minimal
file is needed, create a repository-authored reproduction with synthetic data.

Compatibility changes must update the corpus expectation, visual evidence, and
known-limit documentation together. Performance misses are evidence and must
not be hidden by loosening a budget.
