# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 85.500 ms | 143.100 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.800 ms | 2.000 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `80.5, 93.6, 80, 85.5, 80.8, 84.2, 86.9, 93.1, 96.9, 143.1`
- Rendered page switch (ms): `1.7, 1.7, 1.6, 1.9, 2, 1.8, 1.8, 1.7, 1.9, 2.1, 2.1, 2, 2, 1.7, 1.8, 1.6, 1.7, 1.8, 1.8, 1.6, 1.7, 1.7, 1.9, 1.8, 1.9, 1.8, 1.8, 1.8, 1.9, 1.9, 1.7, 1.9, 1.9, 1.8, 1.9, 1.9, 1.9, 1.9, 2, 2`

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

- Production bundle: 1,176,586 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-12 | 35,986,280 | 350,437,376 |
| measured-1-steady | 32,247,520 | 355,352,576 |
| measured-1-post-close | 17,515,740 | 265,912,320 |
| measured-2-peak-actual-snapshot-22 | 20,761,140 | 279,478,272 |
| measured-2-steady | 20,565,396 | 307,232,768 |
| measured-2-post-close | 17,673,692 | 265,093,120 |
| measured-3-peak-actual-snapshot-19 | 20,850,108 | 279,740,416 |
| measured-3-steady | 20,446,336 | 304,381,952 |
| measured-3-post-close | 16,429,456 | 265,912,320 |
| measured-4-peak-actual-snapshot-21 | 21,090,032 | 293,306,368 |
| measured-4-steady | 21,090,032 | 293,306,368 |
| measured-4-post-close | 16,509,232 | 267,075,584 |
| measured-5-peak-actual-snapshot-20 | 22,193,728 | 307,494,912 |
| measured-5-steady | 22,193,728 | 307,494,912 |
| measured-5-post-close | 16,545,760 | 267,304,960 |
| measured-6-peak-actual-snapshot-21 | 24,781,808 | 309,002,240 |
| measured-6-steady | 24,781,808 | 309,002,240 |
| measured-6-post-close | 16,695,176 | 269,795,328 |
| measured-7-peak-actual-snapshot-21 | 24,363,332 | 307,576,832 |
| measured-7-steady | 24,363,332 | 307,576,832 |
| measured-7-post-close | 16,745,608 | 269,271,040 |
| measured-8-peak-actual-snapshot-22 | 19,698,828 | 282,066,944 |
| measured-8-steady | 19,690,832 | 308,281,344 |
| measured-8-post-close | 16,807,216 | 269,860,864 |
| measured-9-peak-actual-snapshot-23 | 21,661,536 | 295,600,128 |
| measured-9-steady | 21,661,536 | 295,600,128 |
| measured-9-post-close | 16,848,704 | 270,237,696 |
| measured-10-peak-actual-snapshot-31 | 20,083,320 | 284,360,704 |
| measured-10-steady | 19,801,856 | 309,035,008 |
| measured-10-post-close | 16,911,592 | 272,285,696 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 72.700 ms | yes | yes |
| 2 | 13.300 ms | yes | yes |
| 3 | 15.200 ms | yes | yes |
| 4 | 15.900 ms | yes | yes |
| 5 | 78.100 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,853.300 ms | yes | yes |
| 2 | 1,853.300 ms | yes | yes |
| 3 | 1,854.300 ms | yes | yes |
| 4 | 1,854.200 ms | yes | yes |
| 5 | 1,853.700 ms | yes | yes |
| 6 | 1,853.700 ms | yes | yes |
| 7 | 1,853.000 ms | yes | yes |
| 8 | 1,854.000 ms | yes | yes |
| 9 | 1,852.400 ms | yes | yes |
| 10 | 1,853.100 ms | yes | yes |
| 11 | 1,851.700 ms | yes | yes |
| 12 | 1,851.300 ms | yes | yes |
| 13 | 1,851.700 ms | yes | yes |
| 14 | 1,852.300 ms | yes | yes |
| 15 | 1,852.300 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 83.7 | 140.7 |
| First readable | 10/10 | 85.5 | 143.1 |
| Slide switch | 40/40 | 1.8 | 2 |
| First visible thumbnail ready | 10/10 | 150.60000002384186 | 221.29999995231628 |
| Mounted thumbnails | 10/10 | 10 | 10 |
| Cancellation / adapter-stop elapsed | 5/5 | 15.899999976158142 | 78.10000002384186 |
| Full resource completion elapsed | 15/15 | 1853.1000000238419 | 1854.2999999523163 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 21090032 | 35986280 | 293306368 | 350437376 |
| steady | 21090032 | 32247520 | 307494912 | 355352576 |
| postClose | 16745608 | 17673692 | 267304960 | 272285696 |

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
- M2 background stops: close=1.2000000476837158 ms (pending=0, running=0, mounted=0); file-switch=20.40000009536743 ms (pending=0, running=0, mounted=0).
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
- Run selection policy: retain-all-require-two-consecutive-clean-runs-v1; retained attempts=14; failed attempts=9; consecutive clean runs=2/2; eligible for promotion=yes; accepted run IDs=00b81a67-8991-4f30-9909-91f006af829c, 27fe45c4-1be5-4a08-8802-5f9ebc6b2fbd.
