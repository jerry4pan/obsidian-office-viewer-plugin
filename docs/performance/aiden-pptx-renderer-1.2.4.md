# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 88.500 ms | 91.200 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.800 ms | 1.900 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `80.2, 88.7, 88.5, 88.4, 89.2, 80.9, 89.1, 91.2, 88.2, 90.7`
- Rendered page switch (ms): `1.6, 1.7, 1.7, 1.5, 1.8, 1.8, 1.8, 1.8, 1.7, 1.8, 1.9, 1.7, 1.8, 1.8, 1.6, 1.7, 1.9, 1.8, 1.8, 1.8, 2, 1.7, 1.7, 1.7, 1.7, 1.8, 1.6, 1.7, 1.9, 1.7, 1.8, 1.7, 1.8, 1.8, 1.8, 1.8, 1.7, 1.8, 1.7, 1.7`

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

- Production bundle: 1,198,789 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-11 | 34,943,236 | 341,671,936 |
| measured-1-steady | 33,958,880 | 344,866,816 |
| measured-1-post-close | 17,463,144 | 256,163,840 |
| measured-2-peak-actual-snapshot-22 | 21,619,360 | 295,649,280 |
| measured-2-steady | 21,619,360 | 295,649,280 |
| measured-2-post-close | 17,617,412 | 257,622,016 |
| measured-3-peak-actual-snapshot-21 | 20,468,064 | 271,597,568 |
| measured-3-steady | 19,146,504 | 298,319,872 |
| measured-3-post-close | 16,371,484 | 258,867,200 |
| measured-4-peak-actual-snapshot-21 | 19,490,428 | 273,104,896 |
| measured-4-steady | 19,123,960 | 300,072,960 |
| measured-4-post-close | 16,454,308 | 260,685,824 |
| measured-5-peak-actual-snapshot-22 | 22,237,588 | 301,826,048 |
| measured-5-steady | 22,237,588 | 301,826,048 |
| measured-5-post-close | 16,501,468 | 263,159,808 |
| measured-6-peak-actual-snapshot-20 | 24,425,648 | 299,761,664 |
| measured-6-steady | 24,425,648 | 299,761,664 |
| measured-6-post-close | 16,669,256 | 262,782,976 |
| measured-7-peak-actual-snapshot-22 | 22,453,468 | 301,678,592 |
| measured-7-steady | 22,453,468 | 301,678,592 |
| measured-7-post-close | 16,713,420 | 264,372,224 |
| measured-8-peak-actual-snapshot-22 | 24,394,296 | 300,695,552 |
| measured-8-steady | 24,394,296 | 300,695,552 |
| measured-8-post-close | 16,770,736 | 264,273,920 |
| measured-9-peak-actual-snapshot-22 | 24,786,884 | 302,333,952 |
| measured-9-steady | 24,786,884 | 302,333,952 |
| measured-9-post-close | 16,816,236 | 264,224,768 |
| measured-10-peak-actual-snapshot-22 | 24,893,044 | 302,727,168 |
| measured-10-steady | 24,893,044 | 302,727,168 |
| measured-10-post-close | 16,864,848 | 265,273,344 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 17.800 ms | yes | yes |
| 2 | 17.100 ms | yes | yes |
| 3 | 16.000 ms | yes | yes |
| 4 | 16.300 ms | yes | yes |
| 5 | 14.400 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,854.100 ms | yes | yes |
| 2 | 1,852.000 ms | yes | yes |
| 3 | 1,854.000 ms | yes | yes |
| 4 | 1,854.000 ms | yes | yes |
| 5 | 1,853.900 ms | yes | yes |
| 6 | 1,853.100 ms | yes | yes |
| 7 | 1,853.800 ms | yes | yes |
| 8 | 1,854.500 ms | yes | yes |
| 9 | 1,853.500 ms | yes | yes |
| 10 | 1,853.800 ms | yes | yes |
| 11 | 1,851.400 ms | yes | yes |
| 12 | 1,852.300 ms | yes | yes |
| 13 | 1,852.000 ms | yes | yes |
| 14 | 1,852.600 ms | yes | yes |
| 15 | 1,851.800 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 86.6 | 89.1 |
| First readable | 10/10 | 88.5 | 91.2 |
| Slide switch | 40/40 | 1.8 | 1.9 |
| First visible thumbnail ready | 10/10 | 150.10000002384186 | 152.80000007152557 |
| Mounted thumbnails | 10/10 | 10 | 10 |
| Cancellation / adapter-stop elapsed | 5/5 | 16.300000071525574 | 17.799999952316284 |
| Full resource completion elapsed | 15/15 | 1853.5 | 1854.5 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 22453468 | 34943236 | 300695552 | 341671936 |
| steady | 22453468 | 33958880 | 300695552 | 344866816 |
| postClose | 16713420 | 17617412 | 262782976 | 265273344 |

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
- M2 background stops: close=2 ms (pending=0, running=0, mounted=0); file-switch=18.399999976158142 ms (pending=0, running=0, mounted=0).
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
- Run selection policy: retain-all-require-two-consecutive-clean-runs-v1; retained attempts=2; failed attempts=0; consecutive clean runs=2/2; eligible for promotion=yes; accepted run IDs=1a9744a2-cc53-41dd-8f9f-3f3ff82ae0cc, 1f54c57e-a1ed-4b88-9e97-b9d54821db8d.
