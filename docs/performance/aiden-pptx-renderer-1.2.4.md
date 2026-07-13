# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 41.000 ms | 42.400 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.600 ms | 2.300 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `26.1, 41.8, 42.3, 42.4, 40.5, 40.5, 39.7, 42.4, 42, 41`
- Rendered page switch (ms): `1.9, 1.9, 1.4, 1.6, 2.2, 2.1, 1.5, 1.4, 2.3, 2, 1.5, 1.3, 2.3, 2.1, 1.5, 1.4, 2, 1.9, 1.4, 1.3, 2.4, 2.1, 1.6, 1.4, 2.2, 1.9, 1.5, 1.4, 2.2, 1.9, 1.4, 1.3, 2.3, 2, 1.5, 1.4, 2.5, 2.1, 1.3, 1.4`

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

- Production bundle: 2,413,764 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-8 | 37,447,504 | 274,300,928 |
| measured-1-steady | 32,216,292 | 283,639,808 |
| measured-1-post-close | 22,136,348 | 251,084,800 |
| measured-2-peak-actual-snapshot-12 | 27,680,840 | 261,931,008 |
| measured-2-steady | 27,680,840 | 261,931,008 |
| measured-2-post-close | 22,343,488 | 252,461,056 |
| measured-3-peak-actual-snapshot-12 | 27,771,500 | 262,094,848 |
| measured-3-steady | 27,771,500 | 262,094,848 |
| measured-3-post-close | 22,451,440 | 252,788,736 |
| measured-4-peak-actual-snapshot-12 | 26,536,536 | 261,259,264 |
| measured-4-steady | 26,536,536 | 261,259,264 |
| measured-4-post-close | 22,598,284 | 253,526,016 |
| measured-5-peak-actual-snapshot-12 | 26,163,964 | 261,406,720 |
| measured-5-steady | 26,163,964 | 261,406,720 |
| measured-5-post-close | 22,054,984 | 254,115,840 |
| measured-6-peak-actual-snapshot-12 | 25,336,068 | 262,406,144 |
| measured-6-steady | 25,336,068 | 262,406,144 |
| measured-6-post-close | 21,184,424 | 253,984,768 |
| measured-7-peak-actual-snapshot-12 | 25,249,048 | 261,996,544 |
| measured-7-steady | 25,249,048 | 261,996,544 |
| measured-7-post-close | 21,300,600 | 254,443,520 |
| measured-8-peak-actual-snapshot-12 | 25,474,184 | 262,291,456 |
| measured-8-steady | 25,474,184 | 262,291,456 |
| measured-8-post-close | 21,356,580 | 255,066,112 |
| measured-9-peak-actual-snapshot-12 | 25,541,612 | 263,028,736 |
| measured-9-steady | 25,541,612 | 263,028,736 |
| measured-9-post-close | 21,397,896 | 254,902,272 |
| measured-10-peak-actual-snapshot-12 | 25,630,084 | 262,930,432 |
| measured-10-steady | 25,630,084 | 262,930,432 |
| measured-10-post-close | 21,555,532 | 255,049,728 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 12.300 ms | yes | yes |
| 2 | 12.500 ms | yes | yes |
| 3 | 11.700 ms | yes | yes |
| 4 | 11.700 ms | yes | yes |
| 5 | 12.000 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,851.500 ms | yes | yes |
| 2 | 1,853.100 ms | yes | yes |
| 3 | 1,853.600 ms | yes | yes |
| 4 | 1,853.200 ms | yes | yes |
| 5 | 1,850.900 ms | yes | yes |
| 6 | 1,852.300 ms | yes | yes |
| 7 | 1,852.000 ms | yes | yes |
| 8 | 1,851.400 ms | yes | yes |
| 9 | 1,851.300 ms | yes | yes |
| 10 | 1,851.900 ms | yes | yes |
| 11 | 1,851.000 ms | yes | yes |
| 12 | 1,851.600 ms | yes | yes |
| 13 | 1,853.500 ms | yes | yes |
| 14 | 1,851.400 ms | yes | yes |
| 15 | 1,852.800 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 38.1 | 39.5 |
| First readable | 10/10 | 41 | 42.4 |
| Slide switch | 40/40 | 1.6 | 2.3 |
| Cancellation / adapter-stop elapsed | 5/5 | 12 | 12.5 |
| Full resource completion elapsed | 15/15 | 1851.8999999761581 | 1853.5999999046326 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 25630084 | 37447504 | 262094848 | 274300928 |
| steady | 25630084 | 32216292 | 262094848 | 283639808 |
| postClose | 21555532 | 22598284 | 253984768 | 255066112 |

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
