# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 16.200 ms | 17.800 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.600 ms | 2.200 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `7, 16.6, 17.5, 16.2, 17.8, 10.8, 15.2, 17.6, 14.9, 16.3`
- Rendered page switch (ms): `2, 1.9, 1.3, 1.3, 2.2, 2, 1.5, 1.3, 2.2, 2, 1.3, 1.4, 2.1, 2.2, 1.5, 1.5, 2, 2, 1.4, 1.3, 2, 1.9, 1.5, 1.3, 2, 2, 1.5, 1.6, 2.1, 2.1, 1.4, 1.3, 2.3, 1.9, 1.5, 1.5, 2, 1.9, 1.6, 1.4`

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

- Production bundle: 1,100,173 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-5 | 25,426,812 | 256,606,208 |
| measured-1-steady | 25,426,812 | 256,606,208 |
| measured-1-post-close | 17,258,080 | 237,223,936 |
| measured-2-peak-actual-snapshot-6 | 21,917,264 | 245,301,248 |
| measured-2-steady | 21,917,264 | 245,301,248 |
| measured-2-post-close | 17,380,420 | 237,977,600 |
| measured-3-peak-actual-snapshot-7 | 21,033,960 | 244,957,184 |
| measured-3-steady | 21,033,960 | 244,957,184 |
| measured-3-post-close | 17,487,628 | 238,272,512 |
| measured-4-peak-actual-snapshot-6 | 21,158,124 | 244,875,264 |
| measured-4-steady | 21,158,124 | 244,875,264 |
| measured-4-post-close | 17,556,084 | 239,009,792 |
| measured-5-peak-actual-snapshot-6 | 21,212,508 | 245,923,840 |
| measured-5-steady | 21,212,508 | 245,923,840 |
| measured-5-post-close | 17,682,272 | 239,435,776 |
| measured-6-peak-actual-snapshot-6 | 20,612,692 | 246,169,600 |
| measured-6-steady | 20,612,692 | 246,169,600 |
| measured-6-post-close | 17,095,396 | 239,763,456 |
| measured-7-peak-actual-snapshot-6 | 19,740,428 | 246,349,824 |
| measured-7-steady | 19,740,428 | 246,349,824 |
| measured-7-post-close | 16,529,280 | 239,452,160 |
| measured-8-peak-actual-snapshot-7 | 20,061,392 | 245,989,376 |
| measured-8-steady | 20,061,392 | 245,989,376 |
| measured-8-post-close | 16,655,364 | 239,648,768 |
| measured-9-peak-actual-snapshot-6 | 20,236,488 | 245,989,376 |
| measured-9-steady | 20,236,488 | 245,989,376 |
| measured-9-post-close | 16,698,308 | 239,681,536 |
| measured-10-peak-actual-snapshot-6 | 20,295,148 | 246,415,360 |
| measured-10-steady | 20,295,148 | 246,415,360 |
| measured-10-post-close | 16,711,212 | 239,763,456 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 3.900 ms | yes | yes |
| 2 | 3.500 ms | yes | yes |
| 3 | 4.000 ms | yes | yes |
| 4 | 3.800 ms | yes | yes |
| 5 | 3.700 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,853.700 ms | yes | yes |
| 2 | 1,853.800 ms | yes | yes |
| 3 | 1,853.200 ms | yes | yes |
| 4 | 1,853.500 ms | yes | yes |
| 5 | 1,852.800 ms | yes | yes |
| 6 | 1,852.800 ms | yes | yes |
| 7 | 1,852.100 ms | yes | yes |
| 8 | 1,851.500 ms | yes | yes |
| 9 | 1,851.200 ms | yes | yes |
| 10 | 1,851.500 ms | yes | yes |
| 11 | 1,851.200 ms | yes | yes |
| 12 | 1,852.600 ms | yes | yes |
| 13 | 1,852.300 ms | yes | yes |
| 14 | 1,851.900 ms | yes | yes |
| 15 | 1,850.900 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 12.5 | 13.8 |
| First readable | 10/10 | 16.2 | 17.8 |
| Slide switch | 40/40 | 1.6 | 2.2 |
| Cancellation / adapter-stop elapsed | 5/5 | 3.799999952316284 | 4 |
| Full resource completion elapsed | 15/15 | 1852.2999999523163 | 1853.7999999523163 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 20612692 | 25426812 | 245989376 | 256606208 |
| steady | 20612692 | 25426812 | 245989376 | 256606208 |
| postClose | 17095396 | 17682272 | 239435776 | 239763456 |

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
