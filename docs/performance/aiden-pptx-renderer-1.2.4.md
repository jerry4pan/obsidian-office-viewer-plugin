# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 84.300 ms | 87.600 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.800 ms | 1.900 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `78.1, 87.1, 86.3, 87.6, 86.2, 86.9, 84.3, 80.1, 78, 83.9`
- Rendered page switch (ms): `1.6, 1.9, 1.8, 1.6, 1.8, 1.9, 1.7, 1.8, 1.9, 1.8, 1.7, 1.9, 1.7, 1.8, 1.7, 1.8, 1.7, 1.6, 1.7, 1.7, 1.7, 1.8, 1.7, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.6, 2, 1.7, 1.8, 1.8, 1.8, 1.7, 1.8, 1.7, 1.8`

## Environment

| Field | Value |
| --- | --- |
| Device | panjieruideMacBook-Pro.local (Apple M4 Pro, 48 GiB) |
| OS | Darwin 24.6.0 arm64 |
| Obsidian | 1.12.7 |
| Electron | 39.8.3 |
| Renderer | @aiden0z/pptx-renderer@1.2.4 |
| Cold definition | First 50-slide representative open after installed Obsidian launch; excluded from gates. |
| Warm definition | Same-process 50-slide opens after closing the prior leaf; two warmups excluded, ten measured. |
| Warmups | 2 |
| Measured runs | 10 |

## Resources

- Production bundle: 1,185,362 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-11 | 35,532,852 | 338,542,592 |
| measured-1-steady | 32,416,524 | 345,128,960 |
| measured-1-post-close | 17,420,676 | 253,820,928 |
| measured-2-peak-actual-snapshot-21 | 25,582,596 | 296,992,768 |
| measured-2-steady | 25,582,596 | 296,992,768 |
| measured-2-post-close | 17,572,392 | 256,589,824 |
| measured-3-peak-actual-snapshot-21 | 25,408,212 | 297,205,760 |
| measured-3-steady | 25,408,212 | 297,205,760 |
| measured-3-post-close | 17,633,636 | 258,621,440 |
| measured-4-peak-actual-snapshot-21 | 20,838,024 | 273,285,120 |
| measured-4-steady | 20,631,776 | 294,961,152 |
| measured-4-post-close | 16,415,092 | 259,129,344 |
| measured-5-peak-actual-snapshot-21 | 24,195,736 | 296,091,648 |
| measured-5-steady | 24,195,736 | 296,091,648 |
| measured-5-post-close | 16,453,604 | 260,014,080 |
| measured-6-peak-actual-snapshot-20 | 19,527,660 | 274,022,400 |
| measured-6-steady | 19,328,028 | 297,271,296 |
| measured-6-post-close | 16,606,140 | 261,373,952 |
| measured-7-peak-actual-snapshot-21 | 22,370,672 | 298,663,936 |
| measured-7-steady | 22,370,672 | 298,663,936 |
| measured-7-post-close | 16,645,592 | 263,389,184 |
| measured-8-peak-actual-snapshot-20 | 24,715,152 | 298,909,696 |
| measured-8-steady | 24,715,152 | 298,909,696 |
| measured-8-post-close | 16,712,808 | 263,766,016 |
| measured-9-peak-actual-snapshot-20 | 24,655,792 | 299,450,368 |
| measured-9-steady | 24,655,792 | 299,450,368 |
| measured-9-post-close | 16,747,548 | 263,913,472 |
| measured-10-peak-actual-snapshot-21 | 24,798,328 | 299,532,288 |
| measured-10-steady | 24,798,328 | 299,532,288 |
| measured-10-post-close | 16,786,488 | 265,224,192 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 17.600 ms | yes | yes |
| 2 | 16.900 ms | yes | yes |
| 3 | 16.500 ms | yes | yes |
| 4 | 17.200 ms | yes | yes |
| 5 | 16.600 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,853.900 ms | yes | yes |
| 2 | 1,855.000 ms | yes | yes |
| 3 | 1,855.800 ms | yes | yes |
| 4 | 1,854.800 ms | yes | yes |
| 5 | 1,854.600 ms | yes | yes |
| 6 | 1,855.200 ms | yes | yes |
| 7 | 1,855.400 ms | yes | yes |
| 8 | 1,855.100 ms | yes | yes |
| 9 | 1,854.600 ms | yes | yes |
| 10 | 1,855.100 ms | yes | yes |
| 11 | 1,852.400 ms | yes | yes |
| 12 | 1,852.600 ms | yes | yes |
| 13 | 1,853.500 ms | yes | yes |
| 14 | 1,852.900 ms | yes | yes |
| 15 | 1,853.500 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 82.4 | 85.6 |
| First readable | 10/10 | 84.3 | 87.6 |
| Slide switch | 40/40 | 1.8 | 1.9 |
| First visible thumbnail ready | 10/10 | 149.89999997615814 | 153.90000009536743 |
| Mounted thumbnails | 10/10 | 10 | 10 |
| Cancellation / adapter-stop elapsed | 5/5 | 16.899999976158142 | 17.600000023841858 |
| Full resource completion elapsed | 15/15 | 1854.6000000238419 | 1855.7999999523163 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 24655792 | 35532852 | 297205760 | 338542592 |
| steady | 24655792 | 32416524 | 297271296 | 345128960 |
| postClose | 16712808 | 17633636 | 260014080 | 265224192 |

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
- M2 background stops: close=1.600000023841858 ms (pending=0, running=0, mounted=0); file-switch=18 ms (pending=0, running=0, mounted=0).
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
- Run selection policy: retain-all-require-two-consecutive-clean-runs-v1; retained attempts=2; failed attempts=0; consecutive clean runs=2/2; eligible for promotion=yes; accepted run IDs=5759f2c2-b75d-4d98-9494-23979cd5a6d4, c58110a3-4e3e-4bd9-9acd-a391c5ba4751.
