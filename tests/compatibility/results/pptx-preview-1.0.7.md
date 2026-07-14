# PPTX compatibility run

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
