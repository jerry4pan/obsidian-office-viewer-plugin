# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 30.600 ms | 33.500 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.800 ms | 2.500 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `25.2, 33.5, 32.9, 32.3, 31.3, 30.4, 29.9, 31.6, 30.6, 29.7`
- Rendered page switch (ms): `2.4, 2.2, 1.6, 1.5, 2.2, 2.2, 1.6, 1.5, 2.2, 2.3, 1.7, 1.6, 2.3, 2.2, 1.8, 1.6, 2.1, 2.1, 1.7, 1.6, 2.6, 2.5, 1.8, 1.6, 2.3, 2.2, 1.8, 1.7, 2.2, 2.2, 1.6, 1.7, 2.3, 2.1, 1.7, 1.6, 2.6, 2.2, 1.8, 1.6`

## Environment

| Field | Value |
| --- | --- |
| Device | panjieruideMacBook-Pro.local (Apple M4 Pro, 48 GiB) |
| OS | Darwin 24.6.0 arm64 |
| Obsidian | 1.12.7 |
| Electron | 39.8.3 |
| Renderer | @aiden0z/pptx-renderer@1.2.4 |
| Cold definition | First representative open after installed Obsidian launch; excluded from gates. |
| Warm definition | Same-process opens after closing the prior leaf; two warmups excluded, ten measured. |
| Warmups | 2 |
| Measured runs | 10 |

## Resources

- Production bundle: 1,146,002 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-9 | 27,174,172 | 279,265,280 |
| measured-1-steady | 27,174,172 | 279,265,280 |
| measured-1-post-close | 17,715,016 | 243,318,784 |
| measured-2-peak-actual-snapshot-10 | 23,059,140 | 253,280,256 |
| measured-2-steady | 23,059,140 | 253,280,256 |
| measured-2-post-close | 17,852,876 | 244,383,744 |
| measured-3-peak-actual-snapshot-10 | 22,102,300 | 252,952,576 |
| measured-3-steady | 22,102,300 | 252,952,576 |
| measured-3-post-close | 18,000,236 | 244,711,424 |
| measured-4-peak-actual-snapshot-10 | 22,071,156 | 253,050,880 |
| measured-4-steady | 22,071,156 | 253,050,880 |
| measured-4-post-close | 18,148,396 | 245,448,704 |
| measured-5-peak-actual-snapshot-10 | 21,572,356 | 253,640,704 |
| measured-5-steady | 21,572,356 | 253,640,704 |
| measured-5-post-close | 17,552,512 | 245,628,928 |
| measured-6-peak-actual-snapshot-10 | 21,102,024 | 253,657,088 |
| measured-6-steady | 21,102,024 | 253,657,088 |
| measured-6-post-close | 17,098,708 | 245,743,616 |
| measured-7-peak-actual-snapshot-10 | 21,160,128 | 254,099,456 |
| measured-7-steady | 21,160,128 | 254,099,456 |
| measured-7-post-close | 17,173,328 | 246,120,448 |
| measured-8-peak-actual-snapshot-10 | 21,240,768 | 254,246,912 |
| measured-8-steady | 21,240,768 | 254,246,912 |
| measured-8-post-close | 17,265,404 | 246,153,216 |
| measured-9-peak-actual-snapshot-10 | 21,432,508 | 254,296,064 |
| measured-9-steady | 21,432,508 | 254,296,064 |
| measured-9-post-close | 17,345,776 | 247,037,952 |
| measured-10-peak-actual-snapshot-10 | 21,509,812 | 255,131,648 |
| measured-10-steady | 21,509,812 | 255,131,648 |
| measured-10-post-close | 17,424,008 | 247,332,864 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 7.100 ms | yes | yes |
| 2 | 6.500 ms | yes | yes |
| 3 | 7.900 ms | yes | yes |
| 4 | 7.900 ms | yes | yes |
| 5 | 7.300 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,851.000 ms | yes | yes |
| 2 | 1,851.000 ms | yes | yes |
| 3 | 1,852.500 ms | yes | yes |
| 4 | 1,851.300 ms | yes | yes |
| 5 | 1,851.500 ms | yes | yes |
| 6 | 1,850.700 ms | yes | yes |
| 7 | 1,851.600 ms | yes | yes |
| 8 | 1,852.000 ms | yes | yes |
| 9 | 1,852.000 ms | yes | yes |
| 10 | 1,851.600 ms | yes | yes |
| 11 | 1,851.500 ms | yes | yes |
| 12 | 1,851.700 ms | yes | yes |
| 13 | 1,851.700 ms | yes | yes |
| 14 | 1,850.800 ms | yes | yes |
| 15 | 1,850.900 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 28.1 | 30.9 |
| First readable | 10/10 | 30.6 | 33.5 |
| Slide switch | 40/40 | 1.8 | 2.5 |
| Cancellation / adapter-stop elapsed | 5/5 | 7.299999952316284 | 7.899999976158142 |
| Full resource completion elapsed | 15/15 | 1851.5 | 1852.5 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 21509812 | 27174172 | 253657088 | 279265280 |
| steady | 21509812 | 27174172 | 253657088 | 279265280 |
| postClose | 17424008 | 18148396 | 245628928 | 247332864 |

### Budget misses and bottlenecks

None.

### Failure summary

None.

### Memory provenance and resource-return policy

- Every measured run starts a renderer-side 5 ms sampler before `leaf.openFile`; a MutationObserver adds an immediate snapshot at the real loading transition.
- One monotonic 10000 ms deadline covers open, all slide switches, and cleanup for each attempt; it is never reset between phases. Atomic progress evidence is replaced after every completed attempt.
- Peak means the single actual snapshot with maximum heap used between open start and the explicit steady capture. Its RSS is from that same instant; independent maxima are not combined.
- Post-close capture target: 1850 ms from the renderer timestamp immediately before detach; hard deadline: 2000 ms, including detach, CDP GC, adapter settlement, and post-close sampling.
- Heap release passes only when post-close heap is at or below the workload peak and retained incremental heap is no greater than 50% of the observed positive pre-open-to-workload increment. The allowance is capped by that measured increment; no uncalibrated floor is used. RSS is reported but not gated because Electron/Chromium allocators retain and share resident pages noisily.
- Memory attempts: 10; all have loading snapshot: yes.
- In-flight cancellation attempts: 5; all prove adapter-opening: yes; all adapter stops met deadline: yes; all full resource completions met deadline: yes.
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
