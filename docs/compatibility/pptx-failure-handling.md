# PPTX failure handling baseline

- Ticket: #3
- Runtime path: installed Obsidian → Vault binary read → shared preflight adapter → candidate renderer adapter → file view
- Source policy: read-only; no source path, filename, text, image, or author metadata is included in an error message

## Stable classifications

| Category | Trigger | User-visible behavior |
| --- | --- | --- |
| `unsupported-legacy` | A legacy `.ppt` file is routed to Office Viewer | Explicit unsupported-format explanation without reading or parsing the source, original-file safety note, external-open fallback |
| `malformed` | Invalid/truncated ZIP, invalid OOXML XML, missing required package part or missing internal relationship target | Damaged/incomplete explanation, retry, original-file safety note, external-open fallback |
| `protected` | Compound File Binary container with the standard `EncryptionInfo` and `EncryptedPackage` streams | Encrypted/password-protected explanation and the same safe actions |
| `incompatible` | Structurally readable package that contains active/embedded content or that the renderer cannot safely display | Compatibility explanation and the same safe actions |
| `resource-exhausted` | Entry count, individual entry, XML, media, or total expanded package exceeds a fixed safety limit | Resource-limit explanation and the same safe actions |
| `cancelled` | The current open rejects with an abort outside normal replacement/close lifecycle | Cancelled-load explanation and safe retry |
| `unknown` | Unexpected Vault read or host failure before a stable package/renderer classification exists | Generic explanation without leaking filesystem or candidate-library details |

Normal lifecycle cancellation is not shown as an error. Reopening, closing the
view, or unloading the plugin makes the generation stale; a renderer session
that resolves afterward is disposed rather than mounted. `cancelled` is only a
stable current-generation failure category.

## Repository-authored corpus

The committed `tests/fixtures/failure/` corpus contains no third-party or private
presentation content:

| Fixture | Expected category | Construction |
| --- | --- | --- |
| `malformed-zip.pptx` | `malformed` | Truncated repository-authored PPTX ZIP |
| `malformed-xml.pptx` | `malformed` | Invalid `ppt/presentation.xml` in an otherwise ZIP-readable package |
| `missing-media.pptx` | `malformed` | Internal image relationship whose target part was removed |
| `protected-encrypted.pptx` | `protected` | Repository-authored PPTX encrypted with ECMA-376 Agile Encryption and a test-only password |
| `active-content.pptx` | `incompatible` | Usable-slide package containing inert VBA bytes that preflight must reject before the renderer |
| `renderer-resource-limit.pptx` | `resource-exhausted` | Usable-slide package that exceeds the shared per-entry limit |
| `preflight-xml-limit.pptx` | `resource-exhausted` | Usable-slide package with an XML entry too large to inspect safely |
| `preflight-entry-limit.pptx` | `resource-exhausted` | Usable-slide package with more ZIP entries than the shared safety limit |
| `external-relationship-safe.pptx` | renders normally | Usable-slide package with a slide-referenced standard external hyperlink that must not cause a network request |
| `external-image-blocked.pptx` | `incompatible` | Usable-slide package with a standard external image relationship rejected before the renderer can fetch it |
| `external-image-type-spoof-blocked.pptx` | `incompatible` | External image reference disguised with a hyperlink relationship type; rejected by owner-XML reference-context validation |

`scripts/generate-failure-fixtures.mjs` creates the corpus with PptxGenJS 4.0.1
and JSZip 3.10.1 (both MIT). The protected fixture is encrypted by
msoffcrypto-tool 6.0.0 (MIT), pinned in `scripts/requirements-fixtures.txt`.
Install that Python requirement and set `MSOFFCRYPTO_PYTHON` when the desired
Python is not on `PATH`. Normal verification
copies committed bytes into the test Vault without regenerating them. Intentional
regeneration requires `npm run fixtures:failure:regenerate`.

## Automated evidence

- Package tests enforce central-directory size/count limits before XML decompression, parse allowed OOXML XML parts sequentially without retaining every DOM, exercise all classifications, reject active content and external media (including relationship-type spoofing) before rendering, validate encrypted CFB stream structure, and prove the allowed hyperlink relationship is referenced only from hyperlink nodes and does not invoke `fetch` or `eval`.
- Adapter tests prove classified failures leave no renderer DOM.
- Session tests cover retry, external-open injection, candidate-detail redaction, cancellation, and disposal after rendering failure.
- The installed Obsidian 1.12.7 E2E suite opens every abnormal fixture, verifies its user-visible category and actions, compares source SHA-256 before/after, enforces the network guard, keeps a healthy view usable while another view fails/retries/closes, renders the external-relationship fixture, and unloads the plugin from an abnormal state to verify all viewer DOM is removed.

The preflight is a shared adapter decorator rather than Aiden-specific logic.
Ticket #6 must wrap the second candidate with the same decorator and run this
corpus and error contract unchanged.
