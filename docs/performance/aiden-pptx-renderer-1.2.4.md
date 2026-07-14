# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 33.100 ms | 34.600 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.700 ms | 2.500 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `22.6, 33.8, 34.6, 33.6, 33, 33.7, 33.8, 33.1, 30.6, 30.8`
- Rendered page switch (ms): `2.2, 2.1, 1.4, 1.4, 2.3, 2.1, 1.5, 1.5, 2.6, 2.3, 1.5, 1.5, 2.3, 2.3, 1.6, 1.6, 2.2, 2.1, 1.5, 1.4, 2.3, 2.2, 1.6, 1.5, 2.5, 2.2, 1.7, 1.6, 2.1, 2, 1.6, 1.5, 2.4, 2.1, 1.6, 1.4, 2.7, 2.2, 1.7, 1.5`

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

- Production bundle: 1,144,588 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-8 | 27,036,996 | 277,069,824 |
| measured-1-steady | 27,036,996 | 277,069,824 |
| measured-1-post-close | 17,640,336 | 241,549,312 |
| measured-2-peak-actual-snapshot-10 | 22,890,920 | 251,871,232 |
| measured-2-steady | 22,890,920 | 251,871,232 |
| measured-2-post-close | 17,780,636 | 242,778,112 |
| measured-3-peak-actual-snapshot-10 | 22,039,628 | 251,363,328 |
| measured-3-steady | 22,039,628 | 251,363,328 |
| measured-3-post-close | 17,965,656 | 243,761,152 |
| measured-4-peak-actual-snapshot-10 | 22,116,616 | 252,198,912 |
| measured-4-steady | 22,116,616 | 252,198,912 |
| measured-4-post-close | 18,051,796 | 244,056,064 |
| measured-5-peak-actual-snapshot-10 | 21,370,340 | 252,575,744 |
| measured-5-steady | 21,370,340 | 252,575,744 |
| measured-5-post-close | 17,464,164 | 244,170,752 |
| measured-6-peak-actual-snapshot-10 | 21,135,380 | 252,526,592 |
| measured-6-steady | 21,135,380 | 252,526,592 |
| measured-6-post-close | 17,024,488 | 244,744,192 |
| measured-7-peak-actual-snapshot-10 | 21,196,356 | 253,181,952 |
| measured-7-steady | 21,196,356 | 253,181,952 |
| measured-7-post-close | 17,086,652 | 245,465,088 |
| measured-8-peak-actual-snapshot-10 | 21,258,692 | 253,739,008 |
| measured-8-steady | 21,258,692 | 253,739,008 |
| measured-8-post-close | 17,207,196 | 245,825,536 |
| measured-9-peak-actual-snapshot-10 | 21,350,144 | 253,902,848 |
| measured-9-steady | 21,350,144 | 253,902,848 |
| measured-9-post-close | 17,258,348 | 245,678,080 |
| measured-10-peak-actual-snapshot-10 | 21,430,828 | 254,066,688 |
| measured-10-steady | 21,430,828 | 254,066,688 |
| measured-10-post-close | 17,328,888 | 245,989,376 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 7.500 ms | yes | yes |
| 2 | 7.000 ms | yes | yes |
| 3 | 7.700 ms | yes | yes |
| 4 | 7.900 ms | yes | yes |
| 5 | 7.400 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,851.800 ms | yes | yes |
| 2 | 1,851.500 ms | yes | yes |
| 3 | 1,851.600 ms | yes | yes |
| 4 | 1,851.900 ms | yes | yes |
| 5 | 1,851.000 ms | yes | yes |
| 6 | 1,853.500 ms | yes | yes |
| 7 | 1,852.400 ms | yes | yes |
| 8 | 1,850.800 ms | yes | yes |
| 9 | 1,851.300 ms | yes | yes |
| 10 | 1,851.300 ms | yes | yes |
| 11 | 1,852.600 ms | yes | yes |
| 12 | 1,850.900 ms | yes | yes |
| 13 | 1,851.200 ms | yes | yes |
| 14 | 1,850.500 ms | yes | yes |
| 15 | 1,851.200 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 30.2 | 31.8 |
| First readable | 10/10 | 33.1 | 34.6 |
| Slide switch | 40/40 | 1.7 | 2.5 |
| Cancellation / adapter-stop elapsed | 5/5 | 7.5 | 7.899999976158142 |
| Full resource completion elapsed | 15/15 | 1851.3000000715256 | 1853.5 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 21370340 | 27036996 | 252575744 | 277069824 |
| steady | 21370340 | 27036996 | 252575744 | 277069824 |
| postClose | 17328888 | 18051796 | 244170752 | 245989376 |

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
