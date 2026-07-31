# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 114.600 ms | 119.500 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 2.300 ms | 2.500 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `108.9, 114.5, 114.6, 111, 117.1, 115.3, 119.5, 116.8, 113.6, 117.3`
- Rendered page switch (ms): `2.1, 2.3, 2.1, 2.1, 2.3, 2.3, 2.3, 2.2, 2.3, 2.5, 2.2, 2.3, 2.4, 2.5, 2.1, 2.3, 2.2, 2.4, 2.2, 2.2, 2.3, 2.4, 2.3, 2.3, 2.3, 2.3, 2.4, 2.1, 2.3, 2.3, 2.1, 2.2, 2.2, 2.4, 2.2, 2.1, 2.5, 2.3, 2.3, 2.3`

## Environment

| Field | Value |
| --- | --- |
| Device | oulongdeMac-mini.local (Apple M2, 16 GiB) |
| OS | Darwin 23.6.0 arm64 |
| Obsidian | 1.12.7 |
| Electron | 39.8.3 |
| Renderer | @aiden0z/pptx-renderer@1.2.4 |
| Cold definition | First 50-slide representative open after installed Obsidian launch; excluded from gates. |
| Warm definition | Same-process 50-slide opens after closing the prior leaf; two warmups excluded, ten measured. |
| Warmups | 2 |
| Measured runs | 10 |

## Resources

- Production bundle: 1,390,183 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-7 | 37,662,560 | 311,410,688 |
| measured-1-steady | 35,350,248 | 323,158,016 |
| measured-1-post-close | 18,284,648 | 233,963,520 |
| measured-2-peak-actual-snapshot-26 | 21,628,224 | 248,692,736 |
| measured-2-steady | 21,403,000 | 276,512,768 |
| measured-2-post-close | 18,453,928 | 236,044,288 |
| measured-3-peak-actual-snapshot-25 | 21,360,248 | 250,200,064 |
| measured-3-steady | 20,902,492 | 266,289,152 |
| measured-3-post-close | 17,192,632 | 236,453,888 |
| measured-4-peak-actual-snapshot-24 | 20,542,288 | 251,166,720 |
| measured-4-steady | 20,228,904 | 278,003,712 |
| measured-4-post-close | 17,269,464 | 237,879,296 |
| measured-5-peak-actual-snapshot-27 | 21,495,236 | 265,617,408 |
| measured-5-steady | 21,495,236 | 265,617,408 |
| measured-5-post-close | 17,329,748 | 238,092,288 |
| measured-6-peak-actual-snapshot-26 | 20,819,420 | 252,788,736 |
| measured-6-steady | 20,511,076 | 277,905,408 |
| measured-6-post-close | 17,533,172 | 238,370,816 |
| measured-7-peak-actual-snapshot-28 | 25,436,748 | 277,364,736 |
| measured-7-steady | 25,436,748 | 277,364,736 |
| measured-7-post-close | 17,594,268 | 239,861,760 |
| measured-8-peak-actual-snapshot-26 | 20,948,320 | 254,869,504 |
| measured-8-steady | 20,609,356 | 278,986,752 |
| measured-8-post-close | 17,680,640 | 239,747,072 |
| measured-9-peak-actual-snapshot-27 | 25,534,048 | 277,774,336 |
| measured-9-steady | 25,534,048 | 277,774,336 |
| measured-9-post-close | 17,724,744 | 234,143,744 |
| measured-10-peak-actual-snapshot-26 | 21,136,192 | 249,135,104 |
| measured-10-steady | 20,732,580 | 272,482,304 |
| measured-10-post-close | 17,764,700 | 234,815,488 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 21.000 ms | yes | yes |
| 2 | 22.900 ms | yes | yes |
| 3 | 23.300 ms | yes | yes |
| 4 | 21.700 ms | yes | yes |
| 5 | 21.900 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,854.500 ms | yes | yes |
| 2 | 1,857.400 ms | yes | yes |
| 3 | 1,855.000 ms | yes | yes |
| 4 | 1,853.700 ms | yes | yes |
| 5 | 1,855.700 ms | yes | yes |
| 6 | 1,855.200 ms | yes | yes |
| 7 | 1,856.900 ms | yes | yes |
| 8 | 1,855.700 ms | yes | yes |
| 9 | 1,855.900 ms | yes | yes |
| 10 | 1,854.900 ms | yes | yes |
| 11 | 1,851.600 ms | yes | yes |
| 12 | 1,851.800 ms | yes | yes |
| 13 | 1,852.200 ms | yes | yes |
| 14 | 1,852.300 ms | yes | yes |
| 15 | 1,852.400 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 112 | 116.9 |
| First readable | 10/10 | 114.6 | 119.5 |
| Slide switch | 40/40 | 2.3 | 2.5 |
| First visible thumbnail ready | 10/10 | 174.40000009536743 | 179.89999961853027 |
| Mounted thumbnails | 10/10 | 10 | 10 |
| Cancellation / adapter-stop elapsed | 5/5 | 21.90000009536743 | 23.300000190734863 |
| Full resource completion elapsed | 15/15 | 1854.8999996185303 | 1857.4000000953674 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 21360248 | 37662560 | 252788736 | 311410688 |
| steady | 20902492 | 35350248 | 277364736 | 323158016 |
| postClose | 17594268 | 18453928 | 236453888 | 239861760 |

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
- M2 thumbnail observations: 10; mounted counts strictly below 50: yes.
- Thumbnail readiness source: project-owned `data-ready-thumbnail-count` after renderer resource readiness; all measured attempts carry raw proof: yes.
- Rendered-page switch provenance: every measured attempt performs 4 untimed rendered visits first; all timed switches reference a warmup visit: yes.
- M2 background stops: close=2.6999998092651367 ms (pending=0, running=0, mounted=0); file-switch=24.100000381469727 ms (pending=0, running=0, mounted=0).
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
- Run selection policy: retain-all-require-two-consecutive-clean-runs-v1; retained attempts=17; failed attempts=1; consecutive clean runs=11/2; eligible for promotion=yes; accepted run IDs=44aee8d0-1651-4ab6-a2ba-55f4dbc931b9, a0b45b7b-f130-47a1-96d3-0c2ed66e1d66.
