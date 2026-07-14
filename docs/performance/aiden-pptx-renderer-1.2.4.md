# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 41.500 ms | 43.200 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.900 ms | 2.500 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `22.6, 42.8, 41.5, 41.6, 41.8, 40.9, 42, 41.3, 43.2, 39.7`
- Rendered page switch (ms): `1.9, 2, 1.6, 1.6, 2.4, 2.2, 1.7, 1.5, 2.7, 2.3, 1.7, 1.5, 2.4, 2.3, 1.8, 1.5, 2.2, 2.1, 1.6, 1.5, 2.4, 2.5, 1.7, 1.5, 2.6, 2.4, 1.7, 1.6, 2.4, 2.4, 1.7, 1.5, 2.4, 2.2, 1.7, 1.5, 2.5, 2.3, 1.9, 1.8`

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

- Production bundle: 1,146,032 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-8 | 27,008,388 | 276,856,832 |
| measured-1-steady | 27,008,388 | 276,856,832 |
| measured-1-post-close | 17,622,396 | 242,155,520 |
| measured-2-peak-actual-snapshot-12 | 23,056,008 | 252,641,280 |
| measured-2-steady | 23,056,008 | 252,641,280 |
| measured-2-post-close | 17,845,856 | 243,138,560 |
| measured-3-peak-actual-snapshot-12 | 22,086,008 | 251,576,320 |
| measured-3-steady | 22,086,008 | 251,576,320 |
| measured-3-post-close | 18,002,732 | 243,482,624 |
| measured-4-peak-actual-snapshot-12 | 22,182,604 | 252,182,528 |
| measured-4-steady | 22,182,604 | 252,182,528 |
| measured-4-post-close | 18,094,864 | 244,301,824 |
| measured-5-peak-actual-snapshot-12 | 21,664,684 | 252,641,280 |
| measured-5-steady | 21,664,684 | 252,641,280 |
| measured-5-post-close | 17,522,236 | 244,187,136 |
| measured-6-peak-actual-snapshot-12 | 21,240,116 | 252,690,432 |
| measured-6-steady | 21,240,116 | 252,690,432 |
| measured-6-post-close | 17,083,148 | 244,400,128 |
| measured-7-peak-actual-snapshot-12 | 21,285,084 | 252,624,896 |
| measured-7-steady | 21,285,084 | 252,624,896 |
| measured-7-post-close | 17,192,296 | 244,547,584 |
| measured-8-peak-actual-snapshot-12 | 21,367,892 | 252,723,200 |
| measured-8-steady | 21,367,892 | 252,723,200 |
| measured-8-post-close | 17,240,352 | 244,514,816 |
| measured-9-peak-actual-snapshot-12 | 21,452,028 | 252,887,040 |
| measured-9-steady | 21,452,028 | 252,887,040 |
| measured-9-post-close | 17,334,484 | 244,744,192 |
| measured-10-peak-actual-snapshot-11 | 21,434,304 | 252,887,040 |
| measured-10-steady | 21,434,304 | 252,887,040 |
| measured-10-post-close | 17,404,488 | 244,973,568 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 11.900 ms | yes | yes |
| 2 | 11.400 ms | yes | yes |
| 3 | 11.400 ms | yes | yes |
| 4 | 8.000 ms | yes | yes |
| 5 | 11.800 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,851.600 ms | yes | yes |
| 2 | 1,852.800 ms | yes | yes |
| 3 | 1,851.100 ms | yes | yes |
| 4 | 1,852.100 ms | yes | yes |
| 5 | 1,852.100 ms | yes | yes |
| 6 | 1,853.500 ms | yes | yes |
| 7 | 1,851.500 ms | yes | yes |
| 8 | 1,851.600 ms | yes | yes |
| 9 | 1,851.800 ms | yes | yes |
| 10 | 1,853.400 ms | yes | yes |
| 11 | 1,852.000 ms | yes | yes |
| 12 | 1,851.900 ms | yes | yes |
| 13 | 1,852.800 ms | yes | yes |
| 14 | 1,851.100 ms | yes | yes |
| 15 | 1,852.000 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 38.5 | 40.1 |
| First readable | 10/10 | 41.5 | 43.2 |
| Slide switch | 40/40 | 1.9 | 2.5 |
| Cancellation / adapter-stop elapsed | 5/5 | 11.399999976158142 | 11.900000095367432 |
| Full resource completion elapsed | 15/15 | 1852 | 1853.5 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 21452028 | 27008388 | 252641280 | 276856832 |
| steady | 21452028 | 27008388 | 252641280 | 276856832 |
| postClose | 17404488 | 18094864 | 244301824 | 244973568 |

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
