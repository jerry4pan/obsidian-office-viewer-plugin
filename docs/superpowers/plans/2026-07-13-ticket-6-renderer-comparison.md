# Ticket #6: Second renderer comparison implementation plan

**Goal:** Evaluate one license-screened second PPTX renderer through the same installed Obsidian adapter, compatibility, safety, and performance acceptance path as the current Aiden candidate, then record a reproducible keep/eliminate decision.

**Candidate:** `pptx-preview@1.0.7`. `docmentis-udoc-viewer` is screened out before PoC because its documented telemetry/no-telemetry licensing conflicts with the local-only boundary. `react-pptx-preview-kit` is screened out for its unproven release history and React-specific integration surface.

**Invariant:** Candidate selection is build-time only. The product view and renderer adapter contract remain candidate-neutral, and neither test corpus nor acceptance thresholds may vary by candidate.

## Task 1: Candidate-neutral composition root

- Add an exact-pinned `pptx-preview@1.0.7` dependency.
- Add renderer metadata and a build-time candidate selector.
- Move `PptxFileView` construction to a shared adapter factory so both candidates use `PreflightPptxRendererAdapter` and the same view/session UI.
- Add unit tests proving selection, metadata, and invalid-candidate failure.

## Task 2: `pptx-preview` adapter

- Implement `PptxPreviewRendererAdapter` behind `PptxRendererAdapter`.
- Validate zero-based navigation, slide count, abort-before-open, abort-after-parse, parse failure classification, disposal, and DOM cleanup.
- Run every Ticket #3 failure fixture through `PreflightPptxRendererAdapter` and preserve the same stable categories.
- If the library cannot satisfy cancellation or cleanup, preserve the failing evidence and mark the candidate eliminated instead of weakening the contract.

## Task 3: Candidate-aware installed acceptance entry

- Build a single selected renderer into `main.js` using an esbuild define so the unused candidate is tree-shaken.
- Add candidate-specific scripts for build, E2E, compatibility, and performance while retaining the existing Aiden defaults.
- Parameterize compatibility/performance artifact names and renderer metadata; protocol, corpus, environment, and gates remain shared.

## Task 4: Compatibility and safety evidence

- Run the five-fixture Ticket #4 corpus in installed Obsidian with network interception enabled.
- Capture candidate-specific approved screenshots only after visual inspection.
- Commit the candidate-specific JSON/Markdown compatibility summary and deterministic baseline validator.
- Run all Ticket #3 E2E failure fixtures and confirm the same UI classification/action behavior.

## Task 5: Performance/resource evidence

- Run the Ticket #5 cold/warm/measured, navigation, memory, cancellation, cleanup, and bundle protocol unchanged.
- Commit candidate-specific raw JSON and byte-reproducible Markdown.
- Validate raw-attempt completeness, selected snapshot provenance, bundle size, deadlines, and resource return using the existing validator.

## Task 6: Comparison and decision

- Record readability, visual review, first-readable p50/p95, slide-switch p50/p95, heap/cancellation/cleanup, bundle size, license, maintenance, and adapter complexity for both candidates.
- Link every claim to committed evidence or an official source.
- State a keep/eliminate recommendation and the conditions that would reverse it.
- Run the complete verification matrix and request a final branch review before publishing Ticket #6.
