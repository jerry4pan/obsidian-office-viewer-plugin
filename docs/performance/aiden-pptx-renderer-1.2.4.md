# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 16.100 ms | 17.400 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.800 ms | 2.200 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `6.8, 9.3, 16.6, 16.4, 13.8, 16.1, 16.3, 16.1, 17.4, 15.7`
- Rendered page switch (ms): `1.8, 1.9, 1.4, 1.4, 2.1, 2, 1.5, 1.4, 2.1, 2, 1.8, 1.4, 2.2, 2, 1.5, 1.5, 2, 1.8, 1.4, 1.2, 2.2, 2, 1.5, 1.3, 2.2, 2, 1.6, 1.5, 2.1, 1.9, 1.6, 1.4, 2.2, 2, 1.5, 1.5, 2, 1.9, 1.4, 1.4`

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
| measured-1-peak-actual-snapshot-5 | 25,582,096 | 256,999,424 |
| measured-1-steady | 25,582,096 | 256,999,424 |
| measured-1-post-close | 17,257,488 | 237,780,992 |
| measured-2-peak-actual-snapshot-6 | 21,922,344 | 245,727,232 |
| measured-2-steady | 21,922,344 | 245,727,232 |
| measured-2-post-close | 17,380,424 | 238,387,200 |
| measured-3-peak-actual-snapshot-6 | 20,736,180 | 245,235,712 |
| measured-3-steady | 20,736,180 | 245,235,712 |
| measured-3-post-close | 17,458,372 | 238,305,280 |
| measured-4-peak-actual-snapshot-6 | 21,101,852 | 245,415,936 |
| measured-4-steady | 21,101,852 | 245,415,936 |
| measured-4-post-close | 17,586,604 | 238,911,488 |
| measured-5-peak-actual-snapshot-6 | 21,217,364 | 245,612,544 |
| measured-5-steady | 21,217,364 | 245,612,544 |
| measured-5-post-close | 17,679,976 | 239,288,320 |
| measured-6-peak-actual-snapshot-6 | 20,700,236 | 246,054,912 |
| measured-6-steady | 20,700,236 | 246,054,912 |
| measured-6-post-close | 17,091,520 | 239,288,320 |
| measured-7-peak-actual-snapshot-6 | 20,027,460 | 245,841,920 |
| measured-7-steady | 20,027,460 | 245,841,920 |
| measured-7-post-close | 16,527,904 | 239,648,768 |
| measured-8-peak-actual-snapshot-6 | 20,175,716 | 246,251,520 |
| measured-8-steady | 20,175,716 | 246,251,520 |
| measured-8-post-close | 16,588,624 | 239,845,376 |
| measured-9-peak-actual-snapshot-6 | 20,398,904 | 246,202,368 |
| measured-9-steady | 20,398,904 | 246,202,368 |
| measured-9-post-close | 16,654,424 | 239,894,528 |
| measured-10-peak-actual-snapshot-6 | 19,876,432 | 246,317,056 |
| measured-10-steady | 19,876,432 | 246,317,056 |
| measured-10-post-close | 16,699,324 | 240,025,600 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 1,852.000 ms | yes | yes |
| 2 | 1,852.900 ms | yes | yes |
| 3 | 1,853.100 ms | yes | yes |
| 4 | 1,850.800 ms | yes | yes |
| 5 | 1,852.100 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,852.900 ms | yes | yes |
| 2 | 1,854.100 ms | yes | yes |
| 3 | 1,854.000 ms | yes | yes |
| 4 | 1,853.200 ms | yes | yes |
| 5 | 1,853.100 ms | yes | yes |
| 6 | 1,851.800 ms | yes | yes |
| 7 | 1,852.500 ms | yes | yes |
| 8 | 1,852.500 ms | yes | yes |
| 9 | 1,852.700 ms | yes | yes |
| 10 | 1,852.400 ms | yes | yes |
| 11 | 1,852.000 ms | yes | yes |
| 12 | 1,852.900 ms | yes | yes |
| 13 | 1,853.100 ms | yes | yes |
| 14 | 1,850.800 ms | yes | yes |
| 15 | 1,852.100 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 12.1 | 13.3 |
| First readable | 10/10 | 16.1 | 17.4 |
| Slide switch | 40/40 | 1.8 | 2.2 |
| Cancellation elapsed | 5/5 | 1852.0999999046326 | 1853.1000000238419 |
| Cleanup/resource return elapsed | 10/10 | 1852.6999999284744 | 1854.1000000238419 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 20700236 | 25582096 | 245841920 | 256999424 |
| steady | 20700236 | 25582096 | 245841920 | 256999424 |
| postClose | 17091520 | 17679976 | 239288320 | 240025600 |

### Budget misses and bottlenecks

None.

### Failure summary

None.

### Memory provenance and resource-return policy

- Every measured run starts a renderer-side 5 ms sampler before `leaf.openFile`; a MutationObserver adds an immediate snapshot at the real loading transition.
- Peak means the single actual snapshot with maximum heap used between open start and the explicit steady capture. Its RSS is from that same instant; independent maxima are not combined.
- Post-close capture target: 1850 ms from the renderer timestamp immediately before detach; hard deadline: 2000 ms, including detach, CDP GC, adapter settlement, and post-close sampling.
- Heap release passes only when post-close heap is at or below the workload peak and retained incremental heap is no greater than 50% of the observed positive pre-open-to-workload increment. The allowance is capped by that measured increment; no uncalibrated floor is used. RSS is reported but not gated because Electron/Chromium allocators retain and share resident pages noisily.
- Memory attempts: 10; all have loading snapshot: yes.
- In-flight cancellation attempts: 5; all prove adapter-opening: yes; all met deadline: yes.
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
