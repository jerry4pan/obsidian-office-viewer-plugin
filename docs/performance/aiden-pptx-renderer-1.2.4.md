# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 16.100 ms | 16.800 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.800 ms | 2.200 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `6.1, 16.1, 16.1, 16.1, 16.8, 15.8, 16.1, 16.8, 16.7, 16.1`
- Rendered page switch (ms): `1.8, 2.2, 1.3, 1.4, 2.2, 2, 1.4, 1.3, 2.4, 2.1, 1.5, 1.4, 2.2, 2, 1.6, 1.4, 2.2, 2, 1.3, 1.5, 2.1, 2.1, 2, 1.5, 2.2, 1.9, 1.4, 1.4, 2.2, 2.1, 1.5, 1.4, 2.1, 2, 1.6, 1.5, 2.1, 1.8, 1.6, 1.5`

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
| measured-1-peak-actual-snapshot-5 | 25,497,768 | 257,376,256 |
| measured-1-steady | 25,497,768 | 257,376,256 |
| measured-1-post-close | 17,257,144 | 237,486,080 |
| measured-2-peak-actual-snapshot-6 | 21,917,508 | 245,432,320 |
| measured-2-steady | 21,917,508 | 245,432,320 |
| measured-2-post-close | 17,380,220 | 238,141,440 |
| measured-3-peak-actual-snapshot-6 | 21,198,392 | 244,973,568 |
| measured-3-steady | 21,198,392 | 244,973,568 |
| measured-3-post-close | 17,458,356 | 238,305,280 |
| measured-4-peak-actual-snapshot-6 | 21,102,768 | 245,284,864 |
| measured-4-steady | 21,102,768 | 245,284,864 |
| measured-4-post-close | 17,517,216 | 238,796,800 |
| measured-5-peak-actual-snapshot-6 | 20,821,024 | 245,612,544 |
| measured-5-steady | 20,821,024 | 245,612,544 |
| measured-5-post-close | 17,674,984 | 239,075,328 |
| measured-6-peak-actual-snapshot-6 | 20,393,240 | 245,760,000 |
| measured-6-steady | 20,393,240 | 245,760,000 |
| measured-6-post-close | 17,089,524 | 239,239,168 |
| measured-7-peak-actual-snapshot-6 | 20,295,168 | 245,825,536 |
| measured-7-steady | 20,295,168 | 245,825,536 |
| measured-7-post-close | 16,522,264 | 239,239,168 |
| measured-8-peak-actual-snapshot-6 | 20,056,092 | 245,972,992 |
| measured-8-steady | 20,056,092 | 245,972,992 |
| measured-8-post-close | 16,582,920 | 239,484,928 |
| measured-9-peak-actual-snapshot-6 | 20,113,496 | 246,169,600 |
| measured-9-steady | 20,113,496 | 246,169,600 |
| measured-9-post-close | 16,648,744 | 239,632,384 |
| measured-10-peak-actual-snapshot-6 | 20,277,728 | 246,267,904 |
| measured-10-steady | 20,277,728 | 246,267,904 |
| measured-10-post-close | 16,693,996 | 239,747,072 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 2.700 ms | yes | yes |
| 2 | 3.200 ms | yes | yes |
| 3 | 2.900 ms | yes | yes |
| 4 | 3.700 ms | yes | yes |
| 5 | 2.800 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,852.600 ms | yes | yes |
| 2 | 1,851.500 ms | yes | yes |
| 3 | 1,852.400 ms | yes | yes |
| 4 | 1,851.700 ms | yes | yes |
| 5 | 1,852.700 ms | yes | yes |
| 6 | 1,852.200 ms | yes | yes |
| 7 | 1,851.600 ms | yes | yes |
| 8 | 1,851.200 ms | yes | yes |
| 9 | 1,850.900 ms | yes | yes |
| 10 | 1,852.900 ms | yes | yes |
| 11 | 1,853.000 ms | yes | yes |
| 12 | 1,852.400 ms | yes | yes |
| 13 | 1,850.500 ms | yes | yes |
| 14 | 1,851.700 ms | yes | yes |
| 15 | 1,851.500 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 12.3 | 13 |
| First readable | 10/10 | 16.1 | 16.8 |
| Slide switch | 40/40 | 1.8 | 2.2 |
| Cancellation / adapter-stop elapsed | 5/5 | 2.899999976158142 | 3.700000047683716 |
| Full resource completion elapsed | 15/15 | 1851.7000000476837 | 1853 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 20393240 | 25497768 | 245760000 | 257376256 |
| steady | 20393240 | 25497768 | 245760000 | 257376256 |
| postClose | 17089524 | 17674984 | 239075328 | 239747072 |

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
