# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 35.400 ms | 40.300 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.800 ms | 2.400 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `25.2, 40.3, 39.5, 35.4, 33.7, 35.4, 39.3, 37, 33.6, 37.8`
- Rendered page switch (ms): `2, 2, 1.5, 1.7, 2.5, 2, 1.6, 1.7, 2.4, 2.1, 1.5, 1.5, 2.4, 2.3, 1.6, 1.5, 2.3, 1.9, 1.6, 1.5, 2.4, 2.3, 1.6, 1.6, 2.4, 2.1, 1.7, 1.6, 2.2, 2.1, 1.5, 1.7, 2.4, 2.2, 1.8, 1.5, 2.3, 2.1, 1.7, 1.8`

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

- Production bundle: 1,145,020 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-9 | 27,051,636 | 276,774,912 |
| measured-1-steady | 27,051,636 | 276,774,912 |
| measured-1-post-close | 17,705,316 | 241,221,632 |
| measured-2-peak-actual-snapshot-11 | 23,127,904 | 251,772,928 |
| measured-2-steady | 23,127,904 | 251,772,928 |
| measured-2-post-close | 17,957,696 | 243,154,944 |
| measured-3-peak-actual-snapshot-11 | 23,135,780 | 252,772,352 |
| measured-3-steady | 23,135,780 | 252,772,352 |
| measured-3-post-close | 18,037,732 | 244,482,048 |
| measured-4-peak-actual-snapshot-10 | 22,067,860 | 252,854,272 |
| measured-4-steady | 22,067,860 | 252,854,272 |
| measured-4-post-close | 18,136,360 | 244,776,960 |
| measured-5-peak-actual-snapshot-10 | 21,649,816 | 253,100,032 |
| measured-5-steady | 21,649,816 | 253,100,032 |
| measured-5-post-close | 17,548,116 | 244,613,120 |
| measured-6-peak-actual-snapshot-11 | 21,188,768 | 252,837,888 |
| measured-6-steady | 21,188,768 | 252,837,888 |
| measured-6-post-close | 17,150,200 | 245,645,312 |
| measured-7-peak-actual-snapshot-11 | 21,157,816 | 253,771,776 |
| measured-7-steady | 21,157,816 | 253,771,776 |
| measured-7-post-close | 17,274,676 | 251,609,088 |
| measured-8-peak-actual-snapshot-11 | 21,048,320 | 263,208,960 |
| measured-8-steady | 21,048,320 | 263,208,960 |
| measured-8-post-close | 17,370,008 | 256,000,000 |
| measured-9-peak-actual-snapshot-10 | 21,345,120 | 263,749,632 |
| measured-9-steady | 21,345,120 | 263,749,632 |
| measured-9-post-close | 17,398,560 | 256,098,304 |
| measured-10-peak-actual-snapshot-11 | 21,431,132 | 263,864,320 |
| measured-10-steady | 21,431,132 | 263,864,320 |
| measured-10-post-close | 17,508,228 | 256,131,072 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 9.500 ms | yes | yes |
| 2 | 8.800 ms | yes | yes |
| 3 | 9.800 ms | yes | yes |
| 4 | 7.800 ms | yes | yes |
| 5 | 8.600 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,852.700 ms | yes | yes |
| 2 | 1,851.800 ms | yes | yes |
| 3 | 1,852.200 ms | yes | yes |
| 4 | 1,851.300 ms | yes | yes |
| 5 | 1,851.200 ms | yes | yes |
| 6 | 1,851.100 ms | yes | yes |
| 7 | 1,852.300 ms | yes | yes |
| 8 | 1,851.800 ms | yes | yes |
| 9 | 1,851.200 ms | yes | yes |
| 10 | 1,852.000 ms | yes | yes |
| 11 | 1,851.700 ms | yes | yes |
| 12 | 1,851.800 ms | yes | yes |
| 13 | 1,851.200 ms | yes | yes |
| 14 | 1,851.200 ms | yes | yes |
| 15 | 1,851.700 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 32.5 | 37.1 |
| First readable | 10/10 | 35.4 | 40.3 |
| Slide switch | 40/40 | 1.8 | 2.4 |
| Cancellation / adapter-stop elapsed | 5/5 | 8.799999952316284 | 9.799999952316284 |
| Full resource completion elapsed | 15/15 | 1851.7000000476837 | 1852.7000000476837 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 21431132 | 27051636 | 253100032 | 276774912 |
| steady | 21431132 | 27051636 | 253100032 | 276774912 |
| postClose | 17508228 | 18136360 | 244776960 | 256131072 |

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
