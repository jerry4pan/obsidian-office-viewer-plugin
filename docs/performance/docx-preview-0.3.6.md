# Installed DOCX performance baseline

- Status: PASS
- Captured: 2026-08-02
- Environment: macOS 15.7.3 arm64, Obsidian 1.12.7, installer 1.12.7,
  Chromium 142.0.7444.265
- Renderer: `docx-preview@0.3.6` with the project-owned bounded semantic mode
- Raw evidence: `tests/performance/baselines/docx-preview-0.3.6.json`

Five installed runs used the fixed 1,000-paragraph representative fixture.
The 5,000-paragraph stress fixture was opened separately in the bounded mode.

| Gate | Observed | Budget | Result |
| --- | ---: | ---: | --- |
| First readable p95 | 43.2 ms | 3,000 ms | PASS |
| Search ready p95 | 18.7 ms | 3,000 ms | PASS |
| Broad 1,000-result query p95 | 1.3 ms | 100 ms | PASS |
| Cleanup p95 | 2 ms | 2,000 ms | PASS |
| Stress body DOM elements | 244 | 1,200 | PASS |
| Stress heap delta | 790,628 bytes | 268,435,456 bytes | PASS |

The run installed the production bundle into a sandboxed Vault, blocked and
recorded HTTP(S), WebSocket, Fetch, and XHR paths, and completed with no network
requests. The baseline test recomputes the p95 values, verifies the exact fixture
hashes, and constrains production bundle growth to five percent.
