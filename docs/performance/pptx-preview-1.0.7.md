# Installed PPTX performance run

Overall result: **FAIL**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | n/a | n/a | <= 3,000.000 ms | FAIL |
| Rendered page switch | n/a | n/a | <= 100.000 ms | FAIL |

## Raw observations

- First readable slide (ms): ``
- Rendered page switch (ms): ``

## Environment

| Field | Value |
| --- | --- |
| Device | panjieruideMacBook-Pro.local (Apple M4 Pro, 48 GiB) |
| OS | Darwin 24.6.0 arm64 |
| Obsidian | 1.12.7 |
| Electron | 39.8.3 |
| Renderer | pptx-preview@1.0.7 |
| Cold definition | First representative open after installed Obsidian launch; excluded from gates. |
| Warm definition | Same-process opens after closing the prior leaf; two warmups excluded, ten measured. |
| Warmups | 2 |
| Measured runs | 10 |

## Resources

- Production bundle: 1,409,791 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 0
- Cancellation observations: 5
- Cleanup observations: 5

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 11.200 ms | yes | yes |
| 2 | 12.100 ms | yes | yes |
| 3 | 8.800 ms | yes | yes |
| 4 | 9.700 ms | yes | yes |
| 5 | 14.600 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,853.200 ms | yes | yes |
| 2 | 1,850.600 ms | yes | yes |
| 3 | 1,850.900 ms | yes | yes |
| 4 | 1,850.800 ms | yes | yes |
| 5 | 1,853.100 ms | yes | yes |

## Failures

- `cold-open` sample 1: installed PPTX view reached error state
- `warmup-open` sample 1: installed PPTX view reached error state
- `warmup-open` sample 2: installed PPTX view reached error state
- `measured-open` sample 1: installed PPTX view reached error state
- `memory` sample 1: required pre-open/peak/steady/post-close snapshot missing
- `measured-open` sample 2: installed PPTX view reached error state
- `memory` sample 2: required pre-open/peak/steady/post-close snapshot missing
- `measured-open` sample 3: installed PPTX view reached error state
- `memory` sample 3: required pre-open/peak/steady/post-close snapshot missing
- `measured-open` sample 4: installed PPTX view reached error state
- `memory` sample 4: required pre-open/peak/steady/post-close snapshot missing
- `measured-open` sample 5: installed PPTX view reached error state
- `memory` sample 5: required pre-open/peak/steady/post-close snapshot missing
- `measured-open` sample 6: installed PPTX view reached error state
- `memory` sample 6: required pre-open/peak/steady/post-close snapshot missing
- `measured-open` sample 7: installed PPTX view reached error state
- `memory` sample 7: required pre-open/peak/steady/post-close snapshot missing
- `measured-open` sample 8: installed PPTX view reached error state
- `memory` sample 8: required pre-open/peak/steady/post-close snapshot missing
- `measured-open` sample 9: installed PPTX view reached error state
- `memory` sample 9: required pre-open/peak/steady/post-close snapshot missing
- `measured-open` sample 10: installed PPTX view reached error state
- `memory` sample 10: required pre-open/peak/steady/post-close snapshot missing
- `first-readable`: Expected 10 performance samples but received 0; 10 missing.
- `slide-switch`: Expected 40 performance samples but received 0; 40 missing.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 0/10 | n/a | n/a |
| First readable | 0/10 | n/a | n/a |
| Slide switch | 0/40 | n/a | n/a |
| Cancellation / adapter-stop elapsed | 5/5 | 11.200000047683716 | 14.600000023841858 |
| Full resource completion elapsed | 5/15 | 1850.8999999761581 | 1853.2000000476837 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | n/a | n/a | n/a | n/a |
| steady | n/a | n/a | n/a | n/a |
| postClose | n/a | n/a | n/a | n/a |

### Budget misses and bottlenecks

None.

### Failure summary

- cold-open: 1 failure(s), samples=1; installed PPTX view reached error state
- warmup-open: 2 failure(s), samples=1, 2; installed PPTX view reached error state; installed PPTX view reached error state
- measured-open: 10 failure(s), samples=1, 2, 3, 4, 5, 6, 7, 8, 9, 10; installed PPTX view reached error state; installed PPTX view reached error state; installed PPTX view reached error state; installed PPTX view reached error state; installed PPTX view reached error state; installed PPTX view reached error state; installed PPTX view reached error state; installed PPTX view reached error state; installed PPTX view reached error state; installed PPTX view reached error state
- memory: 10 failure(s), samples=1, 2, 3, 4, 5, 6, 7, 8, 9, 10; required pre-open/peak/steady/post-close snapshot missing; required pre-open/peak/steady/post-close snapshot missing; required pre-open/peak/steady/post-close snapshot missing; required pre-open/peak/steady/post-close snapshot missing; required pre-open/peak/steady/post-close snapshot missing; required pre-open/peak/steady/post-close snapshot missing; required pre-open/peak/steady/post-close snapshot missing; required pre-open/peak/steady/post-close snapshot missing; required pre-open/peak/steady/post-close snapshot missing; required pre-open/peak/steady/post-close snapshot missing
- first-readable: 1 failure(s), samples=n/a; Expected 10 performance samples but received 0; 10 missing.
- slide-switch: 1 failure(s), samples=n/a; Expected 40 performance samples but received 0; 40 missing.

### Memory provenance and resource-return policy

- Every measured run starts a renderer-side 5 ms sampler before `leaf.openFile`; a MutationObserver adds an immediate snapshot at the real loading transition.
- One monotonic 10000 ms deadline covers open, all slide switches, and cleanup for each attempt; it is never reset between phases. Atomic progress evidence is replaced after every completed attempt.
- Peak means the single actual snapshot with maximum heap used between open start and the explicit steady capture. Its RSS is from that same instant; independent maxima are not combined.
- Post-close capture target: 1850 ms from the renderer timestamp immediately before detach; hard deadline: 2000 ms, including detach, CDP GC, adapter settlement, and post-close sampling.
- Heap release passes only when post-close heap is at or below the workload peak and retained incremental heap is no greater than 50% of the observed positive pre-open-to-workload increment. The allowance is capped by that measured increment; no uncalibrated floor is used. RSS is reported but not gated because Electron/Chromium allocators retain and share resident pages noisily.
- Memory attempts: 10; all have loading snapshot: yes.
- In-flight cancellation attempts: 5; all prove adapter-opening: yes; all adapter stops met deadline: yes; all full resource completions met deadline: yes.
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
