# Installed PPTX performance run

Overall result: **PASS**.

| M0 latency gate | p50 | p95 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| First readable slide | 89.200 ms | 91.900 ms | <= 3,000.000 ms | PASS |
| Rendered page switch | 1.800 ms | 1.900 ms | <= 100.000 ms | PASS |

## Raw observations

- First readable slide (ms): `81.4, 90, 91.9, 90.9, 87.4, 89.2, 90.2, 89.5, 89.1, 89.1`
- Rendered page switch (ms): `1.7, 1.7, 1.8, 1.6, 1.8, 1.8, 1.8, 1.7, 1.9, 1.8, 1.8, 1.7, 1.9, 1.8, 1.8, 1.9, 1.7, 1.7, 1.7, 1.8, 1.8, 1.8, 1.6, 1.9, 1.7, 1.7, 1.6, 1.8, 1.8, 1.6, 1.8, 1.8, 1.7, 1.7, 1.7, 1.7, 1.9, 1.8, 1.7, 1.7`

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

- Production bundle: 1,198,398 bytes
- Cleanup observation window: 2,000 ms
- Memory observations: 30
- Cancellation observations: 5
- Cleanup observations: 15

### Memory observations

| Label | Heap used (bytes) | RSS (bytes) |
| --- | ---: | ---: |
| measured-1-peak-actual-snapshot-9 | 36,254,048 | 337,674,240 |
| measured-1-steady | 33,671,280 | 344,571,904 |
| measured-1-post-close | 17,465,444 | 254,361,600 |
| measured-2-peak-actual-snapshot-20 | 20,733,908 | 269,172,736 |
| measured-2-steady | 20,489,244 | 298,483,712 |
| measured-2-post-close | 17,620,324 | 256,966,656 |
| measured-3-peak-actual-snapshot-22 | 24,041,224 | 298,663,936 |
| measured-3-steady | 24,041,224 | 298,663,936 |
| measured-3-post-close | 16,375,628 | 258,785,280 |
| measured-4-peak-actual-snapshot-21 | 19,604,876 | 272,957,440 |
| measured-4-steady | 19,344,944 | 298,762,240 |
| measured-4-post-close | 16,455,116 | 260,390,912 |
| measured-5-peak-actual-snapshot-22 | 22,223,004 | 299,171,840 |
| measured-5-steady | 22,223,004 | 299,171,840 |
| measured-5-post-close | 16,502,560 | 261,947,392 |
| measured-6-peak-actual-snapshot-21 | 19,996,732 | 276,430,848 |
| measured-6-steady | 19,565,636 | 299,892,736 |
| measured-6-post-close | 16,671,464 | 262,356,992 |
| measured-7-peak-actual-snapshot-22 | 22,523,460 | 300,072,960 |
| measured-7-steady | 22,523,460 | 300,072,960 |
| measured-7-post-close | 16,720,256 | 263,864,320 |
| measured-8-peak-actual-snapshot-21 | 20,130,328 | 278,233,088 |
| measured-8-steady | 19,666,308 | 301,416,448 |
| measured-8-post-close | 16,779,496 | 263,077,888 |
| measured-9-peak-actual-snapshot-21 | 19,846,940 | 276,004,864 |
| measured-9-steady | 19,549,464 | 299,991,040 |
| measured-9-post-close | 16,828,044 | 262,144,000 |
| measured-10-peak-actual-snapshot-21 | 20,097,764 | 276,545,536 |
| measured-10-steady | 19,779,892 | 300,744,704 |
| measured-10-post-close | 16,877,000 | 262,897,664 |

### Cancellation observations

| Sample | Elapsed | Detached | Viewer absent |
| ---: | ---: | --- | --- |
| 1 | 16.400 ms | yes | yes |
| 2 | 17.100 ms | yes | yes |
| 3 | 17.300 ms | yes | yes |
| 4 | 17.800 ms | yes | yes |
| 5 | 16.400 ms | yes | yes |

### Cleanup observations

| Sample | Elapsed | Work stopped | Resources released |
| ---: | ---: | --- | --- |
| 1 | 1,853.900 ms | yes | yes |
| 2 | 1,852.600 ms | yes | yes |
| 3 | 1,853.500 ms | yes | yes |
| 4 | 1,853.800 ms | yes | yes |
| 5 | 1,853.600 ms | yes | yes |
| 6 | 1,854.500 ms | yes | yes |
| 7 | 1,852.900 ms | yes | yes |
| 8 | 1,854.300 ms | yes | yes |
| 9 | 1,854.500 ms | yes | yes |
| 10 | 1,854.000 ms | yes | yes |
| 11 | 1,851.600 ms | yes | yes |
| 12 | 1,852.500 ms | yes | yes |
| 13 | 1,852.400 ms | yes | yes |
| 14 | 1,851.000 ms | yes | yes |
| 15 | 1,852.200 ms | yes | yes |

## Failures

None.

## Expanded statistical summaries

| Metric | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Metadata/open | 10/10 | 87.3 | 90 |
| First readable | 10/10 | 89.2 | 91.9 |
| Slide switch | 40/40 | 1.8 | 1.9 |
| First visible thumbnail ready | 10/10 | 149.79999995231628 | 153.39999997615814 |
| Mounted thumbnails | 10/10 | 10 | 10 |
| Cancellation / adapter-stop elapsed | 5/5 | 17.100000023841858 | 17.799999952316284 |
| Full resource completion elapsed | 15/15 | 1853.5 | 1854.5 |

| Memory phase | Heap p50 | Heap p95 | RSS p50 | RSS p95 |
| --- | ---: | ---: | ---: | ---: |
| peak | 20130328 | 36254048 | 276545536 | 337674240 |
| steady | 19779892 | 33671280 | 299892736 | 344571904 |
| postClose | 16720256 | 17620324 | 261947392 | 263864320 |

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
- M2 background stops: close=2.3000000715255737 ms (pending=0, running=0, mounted=0); file-switch=18.699999928474426 ms (pending=0, running=0, mounted=0).
- Renderer memory source: process.memoryUsage().heapUsed; RSS source: process.memoryUsage().rss.
- Run selection policy: retain-all-require-two-consecutive-clean-runs-v1; retained attempts=2; failed attempts=0; consecutive clean runs=2/2; eligible for promotion=yes; accepted run IDs=d81a82f5-c10a-4f48-a1ed-dee542848ab5, 6043bbe0-f719-4c8e-b7db-24dce50db125.
