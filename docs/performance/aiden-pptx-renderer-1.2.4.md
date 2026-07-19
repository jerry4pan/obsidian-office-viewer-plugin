# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 115.100 ms | 120.800 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 2.400 ms | 2.800 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `110.5, 117.7, 120.8, 115.1, 114.8, 116.3, 119.6, 114.7, 114.4, 115.8`
- Rendered page switch (ms): `2.1, 2.1, 2.4, 2.8, 2.9, 2.4, 2.7, 2.2, 2.5, 2.6, 2.3, 2.2, 2.6, 2.4, 2.2, 2.3, 2.7, 2.8, 2.5, 2.3, 2.3, 2.4, 2.4, 2.3, 2.4, 2.4, 2.3, 2.2, 2.6, 2.4, 2.2, 2.5, 2.3, 2.3, 2.2, 2.5, 2.7, 2.3, 2.9, 2.5`

## Environment

| Field | Value |
| --- | --- |
| Device | oulongdeMac-mini.local (Apple M2, 16 GiB) |
| OS | Darwin 23.6.0 arm64 |
| Obsidian | 1.12.7 |
| Electron | 39.8.3 |
| Renderer | @aiden0z/pptx-renderer@1.2.4 |
| Cold definition | First 50-slide representative open after installed Obsidian launch; excluded from gates. |
| Warm definition | Same-process 50-slide opens after closing the prior leaf; two warmups excluded, ten measured. |
| Warmups | 2 |
| Measured runs | 10 |

## Resources

- Production bundle: 1,264,110 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-15 | 35,945,844 | 355,909,632 |
| measured-1-steady | 33,856,916 | 340,230,144 |
| measured-1-post-close | 17,868,136 | 248,266,752 |
| measured-2-peak-actual-snapshot-26 | 21,282,548 | 263,782,400 |
| measured-2-steady | 20,992,288 | 292,208,640 |
| measured-2-post-close | 18,043,644 | 250,347,520 |
| measured-3-peak-actual-snapshot-27 | 21,043,496 | 280,444,928 |
| measured-3-steady | 21,043,496 | 280,444,928 |
| measured-3-post-close | 16,806,260 | 250,200,064 |
| measured-4-peak-actual-snapshot-25 | 20,134,212 | 265,273,344 |
| measured-4-steady | 19,844,512 | 292,585,472 |
| measured-4-post-close | 16,888,288 | 251,510,784 |
| measured-5-peak-actual-snapshot-27 | 20,627,760 | 280,559,616 |
| measured-5-steady | 20,627,760 | 280,559,616 |
| measured-5-post-close | 16,943,372 | 251,330,560 |
| measured-6-peak-actual-snapshot-26 | 20,428,680 | 266,616,832 |
| measured-6-steady | 20,127,208 | 292,372,480 |
| measured-6-post-close | 17,149,220 | 251,854,848 |
| measured-7-peak-actual-snapshot-28 | 21,386,784 | 281,264,128 |
| measured-7-steady | 21,386,784 | 281,264,128 |
| measured-7-post-close | 17,207,968 | 253,345,792 |
| measured-8-peak-actual-snapshot-25 | 20,671,968 | 267,976,704 |
| measured-8-steady | 20,222,936 | 293,355,520 |
| measured-8-post-close | 17,295,732 | 253,198,336 |
| measured-9-peak-actual-snapshot-27 | 21,462,256 | 281,886,720 |
| measured-9-steady | 21,462,256 | 281,886,720 |
| measured-9-post-close | 17,339,612 | 253,853,696 |
| measured-10-peak-actual-snapshot-25 | 20,773,648 | 268,419,072 |
| measured-10-steady | 20,344,532 | 293,912,576 |
| measured-10-post-close | 17,378,800 | 254,132,224 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 20.000 ms | yes | yes |
| 2 | 21.400 ms | yes | yes |
| 3 | 22.200 ms | yes | yes |
| 4 | 21.700 ms | yes | yes |
| 5 | 21.500 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,855.200 ms | yes | yes |
| 2 | 1,855.900 ms | yes | yes |
| 3 | 1,855.300 ms | yes | yes |
| 4 | 1,855.100 ms | yes | yes |
| 5 | 1,855.200 ms | yes | yes |
| 6 | 1,855.000 ms | yes | yes |
| 7 | 1,855.000 ms | yes | yes |
| 8 | 1,854.800 ms | yes | yes |
| 9 | 1,855.600 ms | yes | yes |
| 10 | 1,855.400 ms | yes | yes |
| 11 | 1,853.200 ms | yes | yes |
| 12 | 1,852.600 ms | yes | yes |
| 13 | 1,851.700 ms | yes | yes |
| 14 | 1,852.700 ms | yes | yes |
| 15 | 1,853.100 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 112.4 | 117.9 |
| First readable | 10/10 | 115.1 | 120.8 |
| Slide switch | 40/40 | 2.4 | 2.8 |
| First visible thumbnail ready | 10/10 | 176.79999995231628 | 183.5 |
| Mounted thumbnails | 10/10 | 10 | 10 |
| Cancellation / adapter-stop elapsed | 5/5 | 21.5 | 22.199999809265137 |
| Full resource completion elapsed | 15/15 | 1855 | 1855.9000000953674 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 20773648 | 35945844 | 268419072 | 355909632 |
| steady | 20627760 | 33856916 | 292208640 | 340230144 |
| postClose | 17207968 | 18043644 | 251510784 | 254132224 |

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
- M2 background stops: close=2.3000001907348633 ms (pending=0, running=0, mounted=0); file-switch=23.100000143051147 ms (pending=0, running=0, mounted=0).
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
- Run selection policy: retain-all-require-two-consecutive-clean-runs-v1; retained attempts=14; failed attempts=1; consecutive clean runs=8/2; eligible for promotion=yes; accepted run IDs=a788bc9d-e079-4b75-a408-f7b5f3f7774e, 8fe83b4c-9b44-418f-b37b-86a685cf125b.
