# Obsidian Office Viewer

An experimental, desktop-only Obsidian plugin for opening local `.pptx` files
without converting them to PDF or uploading them to a service.

The current M0 tracer bullet opens a PPTX from the Vault and renders slide 1.
It is not yet a public release and does not represent a final renderer choice.

## Development

Requirements: Node.js 22 and npm.

```bash
npm install
npm run fixtures
npm run verify
npm run test:e2e
```

`npm run test:e2e` downloads and launches a sandboxed Obsidian instance. It
does not use the normal Obsidian configuration or a personal Vault.

## Current boundaries

- `.pptx` only; legacy `.ppt` is not supported.
- Read-only and local; the plugin never writes back to the source file.
- No Office, LibreOffice, PDF conversion, cloud renderer, or document server.
- Only the first-slide tracer bullet is implemented. Navigation, thumbnails,
  compatibility warnings, and performance work belong to later M0/M1 tickets.

## Test fixture

The committed minimal presentation is generated from repository-authored
content with PptxGenJS. See `tests/fixtures/README.md` for provenance.
