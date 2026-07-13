# Second PPTX renderer candidate screen

Date: 2026-07-13

## Screening decision

Advance [`pptx-preview@1.0.7`](https://www.npmjs.com/package/pptx-preview) to the Ticket #6 acceptance run. This is a PoC decision, not a shipping recommendation.

The package exposes an `ArrayBuffer` API, single-slide rendering, slide count, and disposal hook, so it can be placed behind the existing renderer adapter without candidate-specific product UI. Its npm metadata declares ISC and its README says the published npm package is free for personal and commercial use.

The license/maintenance position is still a material risk:

- the package has one npm maintainer and no repository metadata;
- its README says the source is not open and restricts republishing or modifying it into another open-source project;
- the latest release is 1.0.7 from 2025-10-17;
- its parser has no `AbortSignal` or package-resource-limit option, so project-owned preflight can bound input but cannot interrupt parsing internally;
- the distributed implementation uses a module-global event registry for chart cleanup, which may couple multiple simultaneous viewer sessions.

Ticket #6 must therefore treat cancellation, cleanup, multi-session isolation, bundle size, and the exact redistribution interpretation as decision inputs rather than assuming the npm `license` field is sufficient.

## Candidates screened out before PoC

### `@docmentis/udoc-viewer@0.7.8`

The [official repository](https://github.com/docMentis/docmentis-udoc-viewer) is active and the JavaScript wrapper is MIT, but the separately licensed WASM runtime is roughly 19 MB. More importantly for this product, the documented runtime sends telemetry once per document open, and disabling telemetry is a paid-license capability. That conflicts with the M0 zero-network/private-local boundary, so it is eliminated before compatibility or performance benchmarking.

### `react-pptx-preview-kit@0.1.9`

The [npm package](https://www.npmjs.com/package/react-pptx-preview-kit) is MIT and accepts an `ArrayBuffer`, but it has no repository metadata, is tied to React/ReactDOM, has one maintainer, and versions 0.1.0 through 0.1.9 were published in one short release burst on 2026-03-31. That evidence is too weak to justify adding a second UI runtime before testing the smaller candidate-neutral surface of `pptx-preview`.

## Reproducibility

```sh
npm view pptx-preview@1.0.7 --json
npm view @docmentis/udoc-viewer@0.7.8 --json
npm view react-pptx-preview-kit@0.1.9 --json
npm pack pptx-preview@1.0.7
```

The comparison must pin exact versions and preserve raw compatibility, failure, and performance evidence even if the candidate is eliminated.

## Final Ticket #6 outcome

Eliminated for M0 after the shared acceptance run. The candidate reached the
compatibility gate at exactly 16 / 20 readable units, but failed all 13 opens
of the unchanged representative 12-slide performance presentation and
therefore produced no valid first-readable or slide-switch samples. The raw
failure evidence remains committed, and the exact package stays in
`devDependencies` only for reproducibility. See
`docs/research/renderer-comparison.md` for the full decision.
