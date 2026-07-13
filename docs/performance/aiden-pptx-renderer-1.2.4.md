# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 41.700 ms | 43.900 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.600 ms | 2.300 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `22.5, 35.4, 41.7, 41.7, 40.8, 42.3, 41.7, 43.9, 30.4, 42.9`
- Rendered page switch (ms): `2.1, 1.9, 1.3, 1.4, 2.2, 2, 1.4, 1.4, 2.3, 2.1, 1.3, 1.3, 2, 1.9, 1.6, 1.5, 2.2, 2, 1.4, 1.3, 2.6, 2.1, 1.4, 1.3, 2.2, 2, 1.5, 1.4, 2.3, 2, 1.4, 1.3, 2.3, 1.9, 1.4, 1.3, 2.4, 2, 1.5, 1.5`

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

- Production bundle: 1,142,910 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-8 | 27,200,624 | 277,839,872 |
| measured-1-steady | 27,200,624 | 277,839,872 |
| measured-1-post-close | 17,597,620 | 242,630,656 |
| measured-2-peak-actual-snapshot-11 | 23,000,032 | 252,657,664 |
| measured-2-steady | 23,000,032 | 252,657,664 |
| measured-2-post-close | 17,807,012 | 243,744,768 |
| measured-3-peak-actual-snapshot-12 | 22,039,520 | 251,904,000 |
| measured-3-steady | 22,039,520 | 251,904,000 |
| measured-3-post-close | 17,967,876 | 244,006,912 |
| measured-4-peak-actual-snapshot-12 | 22,117,520 | 252,100,608 |
| measured-4-steady | 22,117,520 | 252,100,608 |
| measured-4-post-close | 18,057,904 | 244,482,048 |
| measured-5-peak-actual-snapshot-12 | 21,495,992 | 252,461,056 |
| measured-5-steady | 21,495,992 | 252,461,056 |
| measured-5-post-close | 17,515,988 | 244,760,576 |
| measured-6-peak-actual-snapshot-12 | 21,151,808 | 252,690,432 |
| measured-6-steady | 21,151,808 | 252,690,432 |
| measured-6-post-close | 17,039,404 | 244,678,656 |
| measured-7-peak-actual-snapshot-12 | 21,231,216 | 252,723,200 |
| measured-7-steady | 21,231,216 | 252,723,200 |
| measured-7-post-close | 17,109,996 | 244,891,648 |
| measured-8-peak-actual-snapshot-12 | 21,309,992 | 252,903,424 |
| measured-8-steady | 21,309,992 | 252,903,424 |
| measured-8-post-close | 17,196,076 | 245,022,720 |
| measured-9-peak-actual-snapshot-10 | 21,277,936 | 252,903,424 |
| measured-9-steady | 21,277,936 | 252,903,424 |
| measured-9-post-close | 17,246,540 | 244,989,952 |
| measured-10-peak-actual-snapshot-12 | 21,470,692 | 253,034,496 |
| measured-10-steady | 21,470,692 | 253,034,496 |
| measured-10-post-close | 17,355,824 | 245,235,712 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 12.000 ms | yes | yes |
| 2 | 12.100 ms | yes | yes |
| 3 | 12.300 ms | yes | yes |
| 4 | 12.900 ms | yes | yes |
| 5 | 10.800 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,851.900 ms | yes | yes |
| 2 | 1,852.900 ms | yes | yes |
| 3 | 1,852.000 ms | yes | yes |
| 4 | 1,852.500 ms | yes | yes |
| 5 | 1,851.200 ms | yes | yes |
| 6 | 1,853.700 ms | yes | yes |
| 7 | 1,851.200 ms | yes | yes |
| 8 | 1,852.100 ms | yes | yes |
| 9 | 1,852.700 ms | yes | yes |
| 10 | 1,851.400 ms | yes | yes |
| 11 | 1,853.400 ms | yes | yes |
| 12 | 1,852.300 ms | yes | yes |
| 13 | 1,851.600 ms | yes | yes |
| 14 | 1,851.400 ms | yes | yes |
| 15 | 1,851.200 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 38.7 | 41 |
| First readable | 10/10 | 41.7 | 43.9 |
| Slide switch | 40/40 | 1.6 | 2.3 |
| Cancellation / adapter-stop elapsed | 5/5 | 12.100000023841858 | 12.899999976158142 |
| Full resource completion elapsed | 15/15 | 1852 | 1853.7000000476837 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 21470692 | 27200624 | 252690432 | 277839872 |
| steady | 21470692 | 27200624 | 252690432 | 277839872 |
| postClose | 17355824 | 18057904 | 244678656 | 245235712 |

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
