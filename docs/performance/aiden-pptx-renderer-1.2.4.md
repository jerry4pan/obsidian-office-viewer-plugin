# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 41.300 ms | 45.000 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.600 ms | 2.400 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `21.8, 32.4, 42.5, 45, 41.1, 41.3, 41.4, 42, 38.8, 42.4`
- Rendered page switch (ms): `1.9, 1.8, 1.3, 1.3, 1.9, 1.8, 1.5, 1.5, 2.4, 2, 1.4, 1.3, 2.6, 2.1, 1.4, 1.5, 2.2, 2.1, 1.5, 1.4, 2.4, 2.1, 1.5, 1.4, 2.2, 2.1, 1.4, 1.3, 2.1, 2, 1.5, 1.3, 2.3, 2, 1.4, 1.3, 2.3, 2, 1.6, 1.5`

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

- Production bundle: 1,142,927 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-8 | 27,119,780 | 275,693,568 |
| measured-1-steady | 27,119,780 | 275,693,568 |
| measured-1-post-close | 17,598,732 | 240,697,344 |
| measured-2-peak-actual-snapshot-10 | 23,146,852 | 250,757,120 |
| measured-2-steady | 23,146,852 | 250,757,120 |
| measured-2-post-close | 17,774,516 | 242,368,512 |
| measured-3-peak-actual-snapshot-12 | 21,797,820 | 250,609,664 |
| measured-3-steady | 21,797,820 | 250,609,664 |
| measured-3-post-close | 17,919,596 | 242,696,192 |
| measured-4-peak-actual-snapshot-13 | 22,112,228 | 250,888,192 |
| measured-4-steady | 22,112,228 | 250,888,192 |
| measured-4-post-close | 18,109,824 | 243,236,864 |
| measured-5-peak-actual-snapshot-12 | 21,612,528 | 251,183,104 |
| measured-5-steady | 21,612,528 | 251,183,104 |
| measured-5-post-close | 17,471,884 | 243,253,248 |
| measured-6-peak-actual-snapshot-12 | 21,042,464 | 251,297,792 |
| measured-6-steady | 21,042,464 | 251,297,792 |
| measured-6-post-close | 17,034,072 | 243,515,392 |
| measured-7-peak-actual-snapshot-12 | 21,213,364 | 251,559,936 |
| measured-7-steady | 21,213,364 | 251,559,936 |
| measured-7-post-close | 17,104,348 | 243,777,536 |
| measured-8-peak-actual-snapshot-12 | 21,187,292 | 251,691,008 |
| measured-8-steady | 21,187,292 | 251,691,008 |
| measured-8-post-close | 17,190,284 | 244,580,352 |
| measured-9-peak-actual-snapshot-11 | 21,271,584 | 252,739,584 |
| measured-9-steady | 21,271,584 | 252,739,584 |
| measured-9-post-close | 17,273,936 | 244,678,656 |
| measured-10-peak-actual-snapshot-12 | 21,472,340 | 252,772,352 |
| measured-10-steady | 21,472,340 | 252,772,352 |
| measured-10-post-close | 17,355,456 | 244,793,344 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 12.200 ms | yes | yes |
| 2 | 11.600 ms | yes | yes |
| 3 | 11.300 ms | yes | yes |
| 4 | 11.800 ms | yes | yes |
| 5 | 11.500 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,853.900 ms | yes | yes |
| 2 | 1,853.700 ms | yes | yes |
| 3 | 1,853.500 ms | yes | yes |
| 4 | 1,852.000 ms | yes | yes |
| 5 | 1,853.600 ms | yes | yes |
| 6 | 1,851.800 ms | yes | yes |
| 7 | 1,852.500 ms | yes | yes |
| 8 | 1,852.300 ms | yes | yes |
| 9 | 1,853.200 ms | yes | yes |
| 10 | 1,852.400 ms | yes | yes |
| 11 | 1,851.700 ms | yes | yes |
| 12 | 1,852.100 ms | yes | yes |
| 13 | 1,853.600 ms | yes | yes |
| 14 | 1,851.500 ms | yes | yes |
| 15 | 1,851.400 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 38.3 | 41.9 |
| First readable | 10/10 | 41.3 | 45 |
| Slide switch | 40/40 | 1.6 | 2.4 |
| Cancellation / adapter-stop elapsed | 5/5 | 11.600000023841858 | 12.200000047683716 |
| Full resource completion elapsed | 15/15 | 1852.3999999761581 | 1853.9000000953674 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 21472340 | 27119780 | 251297792 | 275693568 |
| steady | 21472340 | 27119780 | 251297792 | 275693568 |
| postClose | 17355456 | 18109824 | 243253248 | 244793344 |

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
