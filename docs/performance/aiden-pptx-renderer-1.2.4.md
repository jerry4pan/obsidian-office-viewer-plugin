# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 86.800 ms | 88.100 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.700 ms | 1.800 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `59.6, 87.5, 88.1, 88.1, 85.5, 87.2, 86.1, 86.9, 86.8, 86.6`
- Rendered page switch (ms): `1.6, 1.6, 1.6, 1.7, 1.6, 1.7, 1.8, 1.7, 1.6, 2.2, 1.7, 1.7, 1.8, 1.7, 1.7, 1.7, 1.7, 1.7, 1.7, 1.7, 1.6, 1.7, 1.8, 1.7, 1.7, 1.6, 1.7, 1.7, 1.7, 1.7, 1.7, 1.8, 1.7, 1.7, 1.4, 1.8, 1.8, 1.8, 1.8, 1.8`

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

- Production bundle: 1,172,397 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-11 | 35,719,024 | 347,979,776 |
| measured-1-steady | 26,486,588 | 364,740,608 |
| measured-1-post-close | 18,129,188 | 263,176,192 |
| measured-2-peak-actual-snapshot-21 | 22,551,924 | 305,954,816 |
| measured-2-steady | 22,551,924 | 305,954,816 |
| measured-2-post-close | 18,444,192 | 264,978,432 |
| measured-3-peak-actual-snapshot-22 | 23,541,348 | 303,267,840 |
| measured-3-steady | 23,541,348 | 303,267,840 |
| measured-3-post-close | 17,323,540 | 266,764,288 |
| measured-4-peak-actual-snapshot-22 | 23,191,340 | 302,235,648 |
| measured-4-steady | 23,191,340 | 302,235,648 |
| measured-4-post-close | 17,507,228 | 267,173,888 |
| measured-5-peak-actual-snapshot-21 | 23,435,620 | 302,514,176 |
| measured-5-steady | 23,435,620 | 302,514,176 |
| measured-5-post-close | 17,644,196 | 268,255,232 |
| measured-6-peak-actual-snapshot-21 | 20,840,448 | 303,726,592 |
| measured-6-steady | 20,840,448 | 303,726,592 |
| measured-6-post-close | 17,889,632 | 269,385,728 |
| measured-7-peak-actual-snapshot-20 | 23,808,288 | 304,627,712 |
| measured-7-steady | 23,808,288 | 304,627,712 |
| measured-7-post-close | 18,012,896 | 269,778,944 |
| measured-8-peak-actual-snapshot-21 | 23,882,328 | 304,103,424 |
| measured-8-steady | 23,882,328 | 304,103,424 |
| measured-8-post-close | 18,184,008 | 270,925,824 |
| measured-9-peak-actual-snapshot-21 | 22,369,448 | 308,969,472 |
| measured-9-steady | 22,369,448 | 308,969,472 |
| measured-9-post-close | 18,331,640 | 270,991,360 |
| measured-10-peak-actual-snapshot-20 | 24,130,084 | 304,152,576 |
| measured-10-steady | 24,130,084 | 304,152,576 |
| measured-10-post-close | 18,455,568 | 270,041,088 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 5.900 ms | yes | yes |
| 2 | 18.100 ms | yes | yes |
| 3 | 16.100 ms | yes | yes |
| 4 | 17.000 ms | yes | yes |
| 5 | 16.800 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,853.500 ms | yes | yes |
| 2 | 1,854.400 ms | yes | yes |
| 3 | 1,854.700 ms | yes | yes |
| 4 | 1,854.000 ms | yes | yes |
| 5 | 1,854.000 ms | yes | yes |
| 6 | 1,854.900 ms | yes | yes |
| 7 | 1,853.400 ms | yes | yes |
| 8 | 1,854.700 ms | yes | yes |
| 9 | 1,853.100 ms | yes | yes |
| 10 | 1,851.100 ms | yes | yes |
| 11 | 1,851.400 ms | yes | yes |
| 12 | 1,853.100 ms | yes | yes |
| 13 | 1,850.900 ms | yes | yes |
| 14 | 1,850.900 ms | yes | yes |
| 15 | 1,850.700 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 84.9 | 86.2 |
| First readable | 10/10 | 86.8 | 88.1 |
| Slide switch | 40/40 | 1.7 | 1.8 |
| First visible thumbnail ready | 10/10 | 151.40000009536743 | 156.19999992847443 |
| Mounted thumbnails | 10/10 | 10 | 10 |
| Cancellation / adapter-stop elapsed | 5/5 | 16.799999952316284 | 18.100000023841858 |
| Full resource completion elapsed | 15/15 | 1853.3999999761581 | 1854.8999999761581 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 23435620 | 35719024 | 304103424 | 347979776 |
| steady | 23435620 | 26486588 | 304103424 | 364740608 |
| postClose | 18012896 | 18455568 | 268255232 | 270991360 |

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
- M2 background stops: close=2.299999952316284 ms (pending=0, running=0, mounted=0); file-switch=17.5 ms (pending=0, running=0, mounted=0).
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
- Run selection policy: retain-all-require-two-consecutive-clean-runs-v1; retained attempts=7; failed attempts=3; consecutive clean runs=2/2; eligible for promotion=yes; accepted run IDs=7c1e65af-e7ce-42a8-8109-12f6779a95e9, 81fe9fd4-73bd-49da-abec-385f4982be21.
