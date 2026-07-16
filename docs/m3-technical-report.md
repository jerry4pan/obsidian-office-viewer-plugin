# M3 Technical Report

> Post-release amendment (2026-07-16): diagnostic-summary default-off behavior
> and optional non-blocking compatibility warnings are defined in
> `docs/superpowers/specs/2026-07-16-v0.1-post-release-alignment-design.md`
> and the revised PRD. Historical measurements in this report are unchanged.

Date: 2026-07-15

## Outcome

M3 compatibility, diagnostics, and release-quality code is implemented. Human
approval of the new Simplified and Traditional Chinese messages remains a
release-readiness requirement; its checklist is in
`docs/globalization/m3-message-review.md`. The existing M2 preflight and
installed-test seams were extended instead of adding
a parallel inspection path. Public release creation, beta recruitment, and
Community Plugins submission remain M4 work.

## Current-code adjustments

The implementation makes four deliberate adjustments to the PRD framing:

1. M2 package inspection, failure fixtures, source-integrity checks, and
   lifecycle evidence are reused as M3 foundations.
2. Bounded package-limit failures use `resource-exhausted` rather than the
   broader `incompatible` category.
3. Every M3 user-facing string participates in the English, Simplified Chinese,
   and Traditional Chinese catalog and installed smoke tests.
4. M3 builds and verifies immutable release assets but does not publish them;
   publishing remains an M4 external-state action.

## Requirement evidence

| M3 requirement | Evidence |
| --- | --- |
| Compatibility warnings and stable errors | Persistent `unsupported-content` and `font-substitution` warnings; stable legacy, protected, malformed, incompatible, resource, cancellation, and unknown failure categories |
| Protected, corrupt, legacy PPT, and resource failures | Package preflight and installed failure corpus; `.ppt` is routed to an explanatory read-only failure view without parsing the source |
| Content-free diagnostics | Deterministic schema-versioned JSON exposed in ready, degraded, and error states; tests prohibit filename, path, document text, URLs, and raw exceptions |
| Settings, privacy, security, compatibility | Translated settings explanations plus `PRIVACY.md`, `SECURITY.md`, and compatibility documentation |
| README, license, contribution, reporting | Updated README, MIT `LICENSE`, `CONTRIBUTING.md`, and security/reporting guidance |
| CI and release assets | Push/PR verification workflow, tag asset workflow, version/tag consistency check, and deterministic ZIP packaging |
| Clean Vault lifecycle | Exact ZIP clean install, package-overwrite upgrade, disable, and removal rehearsal in installed Obsidian |

## Compatibility evidence

The selected `@aiden0z/pptx-renderer@1.2.4` corpus remains 90% readable: three
fixtures supported, two explicitly degraded, and none failed. The known SVG
fidelity limitation remains visible and documented. Every fixture has an
explicit expected runtime warning list. Three intentional screenshot changes
only add the persistent warning area; the slide content remains fitted and all
other baselines are unchanged.

Updated baseline SHA-256 values:

- `text-theme-wide`: `5a1949c75081d7401d0f3f5b7e6320dd090fac37c9813fccfa8eb764363d4b9a`
- `images-transparency-standard`: `2b4b94b63e69120116a5dacb72847e80d9473224f9d8b401b461998e260706ad`
- `complex-drawing`: `6cfb3690a7665a6872f295ca569f6302a270fd89b59544b7a0a5986d2fba072d`

## Performance evidence

The final production bundle is 1,198,789 bytes. Two consecutive clean installed
Electron runs of the same bundle and representative fixture were retained and
accepted:

| Run | First readable p95 | Slide switch p95 | Result |
| --- | ---: | ---: | --- |
| `1a9744a2-cc53-41dd-8f9f-3f3ff82ae0cc` | 90.1 ms | 1.8 ms | Pass |
| `1f54c57e-a1ed-4b88-9e97-b9d54821db8d` | 91.2 ms | 1.9 ms | Pass |

Budgets remain 3,000 ms for first readable and 100 ms for rendered page
switching. Cancellation, resource completion, bounded thumbnail mounting, and
post-close memory evidence also pass the existing M2 gates.

## Release evidence

`release:check` validates package, manifest, `versions.json`, supported
extensions, required public documents and licenses, desktop-only declarations,
and optional `vX.Y.Z` tag consistency. `release:package` emits a deterministic
ZIP containing `main.js`, `manifest.json`, `styles.css`, the project license and
notice, and the bundled renderer's Apache-2.0 license. The lifecycle suite installs that
exact ZIP into an empty Vault, opens a PPTX without network or source mutation,
rehearses an overwrite upgrade, and removes the plugin cleanly.

## Verification commands

- `npm run verify`
- `npm run test:e2e`
- `npm run test:compatibility`
- `npm run test:performance` (two consecutive clean runs)
- `npm run test:performance:baseline`
- `npm run test:release`
- `npm run release:check`
- `git diff --check`

## Remaining M4 boundary

M3 does not claim real-user beta evidence, a public v0.1.0 GitHub Release,
Community Plugins submission, seven-day release-candidate monitoring, or the
v0.2 continue/stop decision. Those require external coordination and remain
assigned to M4.

The pending M3 language approvals are not M4 scope and must be recorded before
M3 is declared release-ready.
