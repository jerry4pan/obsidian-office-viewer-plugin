# pptx-preview 1.0.7 compatibility result

Date: 2026-07-13
Ticket: #6
Decision status: second candidate meets the M0 readability gate at the exact boundary

## PPTX compatibility run

M0 gate: **PASS** (required 80.0%).
Readable main content: **16 / 20 (80.0%)**.
Classifications: 1 supported, 4 degraded, 0 failed.

| Fixture | Classification | Readable content | Visual diff |
| --- | --- | ---: | ---: |
| text-theme-wide | degraded | 4 / 5 | 0.000% |
| images-transparency-standard | degraded | 3 / 4 | 0.000% |
| tables-charts | degraded | 4 / 5 | 0.000% |
| grouped-rotated | supported | 4 / 4 | 0.000% |
| complex-drawing | degraded | 1 / 2 | 0.000% |

## Review notes

- **text-theme-wide:** Body text and both font samples are readable, but the theme master footer is missing.
- **images-transparency-standard:** Labels and transparency render, but the embedded SVG product illustration is broken.
- **tables-charts:** The table text and chart container render, but the chart categories and data bars are empty or incorrect.
- **grouped-rotated:** All three native group members and the rotated callout are fully visible.
- **complex-drawing:** The complex SVG drawing is replaced by a broken-image placeholder.

## Evidence and method

The result uses the same five repository-authored fixtures, 80% readability
gate, fixed 1024 × 800 Electron viewport, and zero-pixel visual drift threshold
as the first candidate. The candidate-specific human review is stored in the
corpus manifest. In particular, a chart container alone does not establish
readability: `Chart fully visible` is explicitly unreadable because visual
review found missing or incorrect chart categories and data bars.

The five approved PNGs live under
`tests/compatibility/baselines/pptx-preview-1.0.7/`. Their SHA-256 hashes and
approval reasons are bound to `pptx-preview` in the corpus manifest. Ordinary
candidate runs do not update baselines and reject any changed pixel.

The committed machine-readable result and deterministic summary are
`tests/compatibility/results/pptx-preview-1.0.7.json` and
`tests/compatibility/results/pptx-preview-1.0.7.md`. Unit tests recompute the
summary from fixture observations, compare its Markdown byte for byte, and
verify every committed PNG against the approved candidate hash.

## Reproduce

```bash
npm run test:compatibility:pptx-preview
```

Baseline-update mode is only for an intentional visual review:

```bash
UPDATE_COMPATIBILITY_BASELINES=1 npm run test:compatibility:pptx-preview
```

After an approved update, replace the candidate-specific hash, reason, and
committed result together. The 80% gate and zero-diff threshold remain shared
across candidates.
