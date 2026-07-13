# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 14.900 ms | 17.100 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.700 ms | 2.300 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `6.5, 15, 15.1, 16.4, 10.4, 13.4, 15.4, 14.9, 17.1, 11.2`
- Rendered page switch (ms): `1.9, 2.1, 1.4, 1.3, 2.3, 2.1, 1.6, 1.3, 2.1, 2.2, 1.4, 1.4, 2, 2, 1.5, 1.5, 2.2, 2.1, 1.5, 1.6, 2.1, 2.3, 1.5, 1.4, 2.2, 2, 1.6, 1.7, 2.2, 2, 1.5, 1.5, 2.4, 2.2, 1.4, 1.3, 2.2, 2.2, 1.7, 1.4`

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

- Production bundle: 1,099,705 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-4 | 25,597,928 | 257,474,560 |
| measured-1-steady | 25,597,928 | 257,474,560 |
| measured-1-post-close | 18,404,148 | 240,287,744 |
| measured-2-peak-actual-snapshot-5 | 20,640,636 | 245,907,456 |
| measured-2-steady | 20,640,636 | 245,907,456 |
| measured-2-post-close | 18,827,312 | 241,582,080 |
| measured-3-peak-actual-snapshot-5 | 21,142,216 | 246,415,360 |
| measured-3-steady | 21,142,216 | 246,415,360 |
| measured-3-post-close | 19,146,884 | 242,024,448 |
| measured-4-peak-actual-snapshot-5 | 21,490,220 | 246,775,808 |
| measured-4-steady | 21,490,220 | 246,775,808 |
| measured-4-post-close | 19,655,988 | 242,745,344 |
| measured-5-peak-actual-snapshot-5 | 21,889,084 | 247,398,400 |
| measured-5-steady | 21,889,084 | 247,398,400 |
| measured-5-post-close | 19,751,432 | 243,187,712 |
| measured-6-peak-actual-snapshot-5 | 21,208,388 | 247,840,768 |
| measured-6-steady | 21,208,388 | 247,840,768 |
| measured-6-post-close | 19,396,456 | 243,580,928 |
| measured-7-peak-actual-snapshot-5 | 21,201,952 | 248,086,528 |
| measured-7-steady | 21,201,952 | 248,086,528 |
| measured-7-post-close | 19,003,372 | 243,793,920 |
| measured-8-peak-actual-snapshot-5 | 21,178,692 | 248,496,128 |
| measured-8-steady | 21,178,692 | 248,496,128 |
| measured-8-post-close | 19,277,732 | 244,236,288 |
| measured-9-peak-actual-snapshot-5 | 21,587,764 | 248,594,432 |
| measured-9-steady | 21,587,764 | 248,594,432 |
| measured-9-post-close | 19,569,904 | 244,760,576 |
| measured-10-peak-actual-snapshot-5 | 21,960,320 | 249,348,096 |
| measured-10-steady | 21,960,320 | 249,348,096 |
| measured-10-post-close | 19,823,476 | 245,104,640 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 6.900 ms | yes | yes |
| 2 | 4.700 ms | yes | yes |
| 3 | 3.000 ms | yes | yes |
| 4 | 3.800 ms | yes | yes |
| 5 | 5.900 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,852.400 ms | yes | yes |
| 2 | 1,852.000 ms | yes | yes |
| 3 | 1,852.100 ms | yes | yes |
| 4 | 1,852.500 ms | yes | yes |
| 5 | 1,852.300 ms | yes | yes |
| 6 | 1,851.800 ms | yes | yes |
| 7 | 1,852.300 ms | yes | yes |
| 8 | 1,852.000 ms | yes | yes |
| 9 | 1,850.900 ms | yes | yes |
| 10 | 1,850.900 ms | yes | yes |
| 11 | 6.900 ms | yes | yes |
| 12 | 4.700 ms | yes | yes |
| 13 | 3.000 ms | yes | yes |
| 14 | 3.800 ms | yes | yes |
| 15 | 5.900 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 10.9 | 13.2 |
| First readable | 10/10 | 14.9 | 17.1 |
| Slide switch | 40/40 | 1.7 | 2.3 |
| Cancellation elapsed | 5/5 | 4.700000047683716 | 6.899999976158142 |
| Cleanup/resource return elapsed | 10/10 | 1852 | 1852.5 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 21208388 | 25597928 | 247840768 | 257474560 |
| steady | 21208388 | 25597928 | 247840768 | 257474560 |
| postClose | 19277732 | 19823476 | 243187712 | 245104640 |

### Budget misses and bottlenecks

None.

### Failure summary

None.

### Memory provenance and resource-return policy

- Every measured run starts a renderer-side 5 ms sampler before `leaf.openFile`; a MutationObserver adds an immediate snapshot at the real loading transition.
- Peak means the single actual snapshot with maximum heap used between open start and the explicit steady capture. Its RSS is from that same instant; independent maxima are not combined.
- Post-close capture target: 1850 ms from the renderer timestamp immediately before detach; hard deadline: 2000 ms, including detach, CDP GC, adapter settlement, and post-close sampling.
- Heap release passes only when post-close heap is at or below steady heap and retained incremental heap is no greater than 50% of the observed positive pre-open-to-steady workload increment. The allowance is capped by that measured increment; no uncalibrated floor is used. RSS is reported but not gated because Electron/Chromium allocators retain and share resident pages noisily.
- Memory attempts: 10; all have loading snapshot: yes.
- Cancellation attempts: 5; all met deadline: yes.
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
