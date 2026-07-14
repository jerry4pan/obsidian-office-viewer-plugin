# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 81.700 ms | 86.900 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.900 ms | 2.300 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `64.7, 86.9, 81.5, 81.7, 78, 86, 84.9, 85, 81, 86.5`
- Rendered page switch (ms): `1.8, 1.8, 1.8, 1.9, 2.1, 2, 2, 2.1, 1.7, 2.4, 1.6, 1.7, 2.1, 1.8, 2, 2.3, 1.9, 2.3, 2.1, 2, 1.8, 2, 1.9, 1.7, 1.9, 2.1, 1.9, 1.8, 1.7, 1.9, 1.8, 1.8, 1.8, 1.8, 1.8, 1.9, 1.8, 1.9, 2, 1.9`

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

- Production bundle: 1,171,580 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-13 | 35,584,340 | 329,482,240 |
| measured-1-steady | 29,362,584 | 340,885,504 |
| measured-1-post-close | 18,267,896 | 268,320,768 |
| measured-2-peak-actual-snapshot-20 | 21,427,716 | 282,165,248 |
| measured-2-steady | 20,974,864 | 305,364,992 |
| measured-2-post-close | 18,583,432 | 272,744,448 |
| measured-3-peak-actual-snapshot-20 | 25,478,124 | 303,333,376 |
| measured-3-steady | 25,478,124 | 303,333,376 |
| measured-3-post-close | 17,510,668 | 272,482,304 |
| measured-4-peak-actual-snapshot-19 | 20,543,396 | 286,375,936 |
| measured-4-steady | 20,202,836 | 302,006,272 |
| measured-4-post-close | 17,634,344 | 273,645,568 |
| measured-5-peak-actual-snapshot-20 | 24,915,760 | 302,530,560 |
| measured-5-steady | 24,915,760 | 302,530,560 |
| measured-5-post-close | 17,795,488 | 274,989,056 |
| measured-6-peak-actual-snapshot-20 | 21,039,968 | 289,046,528 |
| measured-6-steady | 20,466,792 | 303,644,672 |
| measured-6-post-close | 18,050,676 | 276,234,240 |
| measured-7-peak-actual-snapshot-21 | 25,220,928 | 303,497,216 |
| measured-7-steady | 25,220,928 | 303,497,216 |
| measured-7-post-close | 18,151,472 | 277,610,496 |
| measured-8-peak-actual-snapshot-21 | 21,403,568 | 301,481,984 |
| measured-8-steady | 21,403,568 | 301,481,984 |
| measured-8-post-close | 18,368,756 | 277,938,176 |
| measured-9-peak-actual-snapshot-20 | 25,578,744 | 304,398,336 |
| measured-9-steady | 25,578,744 | 304,398,336 |
| measured-9-post-close | 18,410,740 | 279,609,344 |
| measured-10-peak-actual-snapshot-20 | 21,569,076 | 292,929,536 |
| measured-10-steady | 21,115,304 | 305,348,608 |
| measured-10-post-close | 18,623,076 | 280,297,472 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 6.100 ms | yes | yes |
| 2 | 19.500 ms | yes | yes |
| 3 | 15.000 ms | yes | yes |
| 4 | 14.100 ms | yes | yes |
| 5 | 14.300 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,851.500 ms | yes | yes |
| 2 | 1,853.600 ms | yes | yes |
| 3 | 1,851.500 ms | yes | yes |
| 4 | 1,852.800 ms | yes | yes |
| 5 | 1,852.100 ms | yes | yes |
| 6 | 1,852.900 ms | yes | yes |
| 7 | 1,853.600 ms | yes | yes |
| 8 | 1,853.600 ms | yes | yes |
| 9 | 1,853.600 ms | yes | yes |
| 10 | 1,853.800 ms | yes | yes |
| 11 | 1,850.700 ms | yes | yes |
| 12 | 1,851.700 ms | yes | yes |
| 13 | 1,850.700 ms | yes | yes |
| 14 | 1,851.700 ms | yes | yes |
| 15 | 1,850.400 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 79.7 | 84.7 |
| First readable | 10/10 | 81.7 | 86.9 |
| Slide switch | 40/40 | 1.9 | 2.3 |
| First visible thumbnail ready | 10/10 | 159.20000004768372 | 170.89999997615814 |
| Mounted thumbnails | 10/10 | 10 | 10 |
| Cancellation / adapter-stop elapsed | 5/5 | 14.299999952316284 | 19.5 |
| Full resource completion elapsed | 15/15 | 1852.1000000238419 | 1853.8000000715256 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 21569076 | 35584340 | 301481984 | 329482240 |
| steady | 21403568 | 29362584 | 303497216 | 340885504 |
| postClose | 18151472 | 18623076 | 274989056 | 280297472 |

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
- M2 background stops: close=1 ms (pending=0, running=0, mounted=0); file-switch=18.799999952316284 ms (pending=0, running=0, mounted=0).
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
