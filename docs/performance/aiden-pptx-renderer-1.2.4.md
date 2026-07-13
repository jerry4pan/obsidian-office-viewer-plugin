# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 42.000 ms | 44.100 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.600 ms | 2.300 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `22.6, 42.3, 29.5, 41.9, 44.1, 42, 42.1, 42, 42.4, 41.2`
- Rendered page switch (ms): `1.9, 1.9, 1.3, 1.5, 2.3, 2, 1.3, 1.3, 2.1, 1.9, 1.4, 1.2, 2.3, 2, 1.4, 1.4, 2.2, 2.2, 1.3, 1.3, 2.3, 2.1, 1.4, 1.4, 2.2, 1.9, 1.5, 1.5, 2.4, 2.1, 1.5, 1.3, 2.5, 2, 1.6, 1.3, 2.3, 2.1, 1.4, 1.3`

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

- Production bundle: 1,142,600 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-3 | 25,821,216 | 254,017,536 |
| measured-1-steady | 25,241,300 | 271,466,496 |
| measured-1-post-close | 17,599,696 | 239,173,632 |
| measured-2-peak-actual-snapshot-12 | 22,876,972 | 249,839,616 |
| measured-2-steady | 22,876,972 | 249,839,616 |
| measured-2-post-close | 17,860,324 | 241,762,304 |
| measured-3-peak-actual-snapshot-10 | 22,026,744 | 250,118,144 |
| measured-3-steady | 22,026,744 | 250,118,144 |
| measured-3-post-close | 17,891,944 | 242,466,816 |
| measured-4-peak-actual-snapshot-12 | 22,115,880 | 250,839,040 |
| measured-4-steady | 22,115,880 | 250,839,040 |
| measured-4-post-close | 18,047,924 | 242,974,720 |
| measured-5-peak-actual-snapshot-12 | 22,030,124 | 251,363,328 |
| measured-5-steady | 22,030,124 | 251,363,328 |
| measured-5-post-close | 18,169,252 | 243,646,464 |
| measured-6-peak-actual-snapshot-12 | 21,182,072 | 251,609,088 |
| measured-6-steady | 21,182,072 | 251,609,088 |
| measured-6-post-close | 17,029,208 | 243,761,152 |
| measured-7-peak-actual-snapshot-12 | 21,105,424 | 251,904,000 |
| measured-7-steady | 21,105,424 | 251,904,000 |
| measured-7-post-close | 17,098,952 | 244,056,064 |
| measured-8-peak-actual-snapshot-12 | 21,302,496 | 252,428,288 |
| measured-8-steady | 21,302,496 | 252,428,288 |
| measured-8-post-close | 17,186,768 | 244,432,896 |
| measured-9-peak-actual-snapshot-12 | 21,366,716 | 252,542,976 |
| measured-9-steady | 21,366,716 | 252,542,976 |
| measured-9-post-close | 17,281,720 | 245,088,256 |
| measured-10-peak-actual-snapshot-12 | 21,357,104 | 253,493,248 |
| measured-10-steady | 21,357,104 | 253,493,248 |
| measured-10-post-close | 17,401,480 | 245,104,640 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 9.400 ms | yes | yes |
| 2 | 12.400 ms | yes | yes |
| 3 | 11.800 ms | yes | yes |
| 4 | 12.000 ms | yes | yes |
| 5 | 11.500 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,852.800 ms | yes | yes |
| 2 | 1,850.900 ms | yes | yes |
| 3 | 1,853.200 ms | yes | yes |
| 4 | 1,853.600 ms | yes | yes |
| 5 | 1,853.100 ms | yes | yes |
| 6 | 1,851.400 ms | yes | yes |
| 7 | 1,853.200 ms | yes | yes |
| 8 | 1,853.700 ms | yes | yes |
| 9 | 1,853.600 ms | yes | yes |
| 10 | 1,850.600 ms | yes | yes |
| 11 | 1,850.700 ms | yes | yes |
| 12 | 1,851.800 ms | yes | yes |
| 13 | 1,853.000 ms | yes | yes |
| 14 | 1,851.900 ms | yes | yes |
| 15 | 1,850.600 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 38.8 | 41.1 |
| First readable | 10/10 | 42 | 44.1 |
| Slide switch | 40/40 | 1.6 | 2.3 |
| Cancellation / adapter-stop elapsed | 5/5 | 11.800000071525574 | 12.399999976158142 |
| Full resource completion elapsed | 15/15 | 1852.8000000715256 | 1853.7000000476837 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 21366716 | 25821216 | 251609088 | 254017536 |
| steady | 21366716 | 25241300 | 251609088 | 271466496 |
| postClose | 17401480 | 18169252 | 243646464 | 245104640 |

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
