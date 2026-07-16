# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 90.800 ms | 109.000 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.800 ms | 2.000 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `109, 91.9, 90.8, 94.7, 89.9, 91.2, 90.2, 89, 88.3, 90.8`
- Rendered page switch (ms): `1.8, 1.9, 1.7, 1.8, 1.7, 1.8, 1.9, 1.6, 1.9, 1.8, 2, 1.9, 2, 1.9, 1.8, 2, 1.8, 2.1, 1.9, 1.7, 1.9, 1.9, 1.7, 1.8, 1.9, 1.9, 1.8, 2.1, 1.8, 1.8, 2, 1.8, 1.8, 1.8, 1.8, 1.7, 1.7, 1.7, 1.8, 1.7`

## Environment

| Field | Value |
| --- | --- |
| Device | panjieruideMacBook-Pro.local (Apple M4 Pro, 48 GiB) |
| OS | Darwin 24.6.0 arm64 |
| Obsidian | 1.12.7 |
| Electron | 39.8.3 |
| Renderer | @aiden0z/pptx-renderer@1.2.4 |
| Cold definition | First 50-slide representative open after installed Obsidian launch; excluded from gates. |
| Warm definition | Same-process 50-slide opens after closing the prior leaf; two warmups excluded, ten measured. |
| Warmups | 2 |
| Measured runs | 10 |

## Resources

- Production bundle: 1,200,758 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-26 | 34,726,672 | 338,345,984 |
| measured-1-steady | 34,726,672 | 338,345,984 |
| measured-1-post-close | 17,461,240 | 252,723,200 |
| measured-2-peak-actual-snapshot-21 | 20,632,592 | 266,960,896 |
| measured-2-steady | 20,305,232 | 295,256,064 |
| measured-2-post-close | 17,622,668 | 254,853,120 |
| measured-3-peak-actual-snapshot-21 | 20,168,596 | 269,418,496 |
| measured-3-steady | 19,099,548 | 295,665,664 |
| measured-3-post-close | 16,367,592 | 255,721,472 |
| measured-4-peak-actual-snapshot-22 | 19,447,396 | 270,123,008 |
| measured-4-steady | 19,126,060 | 296,026,112 |
| measured-4-post-close | 16,471,272 | 257,310,720 |
| measured-5-peak-actual-snapshot-22 | 22,257,700 | 296,534,016 |
| measured-5-steady | 22,257,700 | 296,534,016 |
| measured-5-post-close | 16,519,272 | 258,392,064 |
| measured-6-peak-actual-snapshot-22 | 20,791,704 | 285,786,112 |
| measured-6-steady | 20,791,704 | 285,786,112 |
| measured-6-post-close | 16,685,980 | 258,965,504 |
| measured-7-peak-actual-snapshot-21 | 19,906,460 | 272,990,208 |
| measured-7-steady | 19,461,264 | 297,123,840 |
| measured-7-post-close | 16,728,836 | 258,818,048 |
| measured-8-peak-actual-snapshot-22 | 24,788,616 | 297,746,432 |
| measured-8-steady | 24,788,616 | 297,746,432 |
| measured-8-post-close | 16,800,768 | 259,866,624 |
| measured-9-peak-actual-snapshot-22 | 24,764,248 | 297,893,888 |
| measured-9-steady | 24,764,248 | 297,893,888 |
| measured-9-post-close | 16,836,916 | 261,324,800 |
| measured-10-peak-actual-snapshot-21 | 22,614,820 | 297,598,976 |
| measured-10-steady | 22,614,820 | 297,598,976 |
| measured-10-post-close | 16,873,368 | 261,095,424 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 13.000 ms | yes | yes |
| 2 | 16.400 ms | yes | yes |
| 3 | 16.700 ms | yes | yes |
| 4 | 17.500 ms | yes | yes |
| 5 | 18.000 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,853.200 ms | yes | yes |
| 2 | 1,854.000 ms | yes | yes |
| 3 | 1,854.000 ms | yes | yes |
| 4 | 1,854.700 ms | yes | yes |
| 5 | 1,853.800 ms | yes | yes |
| 6 | 1,853.300 ms | yes | yes |
| 7 | 1,854.400 ms | yes | yes |
| 8 | 1,854.000 ms | yes | yes |
| 9 | 1,853.500 ms | yes | yes |
| 10 | 1,853.300 ms | yes | yes |
| 11 | 1,851.900 ms | yes | yes |
| 12 | 1,851.700 ms | yes | yes |
| 13 | 1,852.100 ms | yes | yes |
| 14 | 1,852.100 ms | yes | yes |
| 15 | 1,852.100 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 88.7 | 107 |
| First readable | 10/10 | 90.8 | 109 |
| Slide switch | 40/40 | 1.8 | 2 |
| First visible thumbnail ready | 10/10 | 152.29999995231628 | 166.20000004768372 |
| Mounted thumbnails | 10/10 | 10 | 10 |
| Cancellation / adapter-stop elapsed | 5/5 | 16.700000047683716 | 18 |
| Full resource completion elapsed | 15/15 | 1853.2999999523163 | 1854.6999998092651 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 20791704 | 34726672 | 285786112 | 338345984 |
| steady | 20791704 | 34726672 | 296534016 | 338345984 |
| postClose | 16728836 | 17622668 | 258392064 | 261324800 |

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
- M2 thumbnail observations: 10; mounted counts strictly below 50: yes.
- Thumbnail readiness source: project-owned `data-ready-thumbnail-count` after renderer resource readiness; all measured attempts carry raw proof: yes.
- Rendered-page switch provenance: every measured attempt performs 4 untimed rendered visits first; all timed switches reference a warmup visit: yes.
- M2 background stops: close=1.6999998092651367 ms (pending=0, running=0, mounted=0); file-switch=18.700000047683716 ms (pending=0, running=0, mounted=0).
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
- Run selection policy: retain-all-require-two-consecutive-clean-runs-v1; retained attempts=6; failed attempts=0; consecutive clean runs=6/2; eligible for promotion=yes; accepted run IDs=ab365edd-8a70-4a6d-b505-ecc7a3455646, 0a20df3d-2393-4989-b605-560bfe8fbd28.
