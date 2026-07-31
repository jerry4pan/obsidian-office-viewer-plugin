# DOCX Exploration Results - 2026-07-31

## Decision

**NO-GO** for the agreed DOCX knowledge-reference loop.

The failure is upstream of renderer selection: Microsoft Word does not preserve
`w14:paraId` across every edit that the reference contract requires, and one
split operation creates a false binding. The contract permits neither ordinal
nor similar-text recovery, so neither renderer candidate can satisfy the hard
reference gates.

This decision does not reject a separately scoped read/search-only DOCX viewer.
It only rejects treating native Word paragraph IDs as sufficient for the
confirmed source-preserving paragraph-reference contract.

## Environment

- Date: 2026-07-31, Asia/Shanghai
- Branch: `codex/docx-knowledge-reference-exploration`
- Microsoft Word: 16.111.2 (`16.111.26072617`)
- WPS Office: 12.1.24031, detected but not needed for the hard-gate decision
- Candidate A: `mammoth@1.10.0`
- Candidate B: `docx-preview@0.3.6`

## Microsoft Word native round trip

The baseline was created by Microsoft Word itself, saved as DOCX, closed,
reopened, saved, closed, reopened, and saved again. Its five non-empty body
paragraphs were:

| Creation ordinal | `w14:paraId` | Text |
| ---: | --- | --- |
| 1 | `7BC2A74A` | Anchor one |
| 2 | `0029B9DE` | Before target |
| 3 | `41DDC275` | Stable target |
| 4 | `21ED9156` | After target |
| 5 | `79F4D15A` | Anchor five |

The baseline SHA-256 was
`3b0c3e37a64c2f33c1539f9f1848e176da22ebafecdba2ad06b443afbbf5a758`.
A no-change close/reopen/save cycle retained the same hash.

Every scenario used a separate copy of that Word-native baseline. Edits were
performed through Microsoft Word's document object model, not by editing OOXML.
Each result was saved, closed, reopened in Word, saved again, and closed. The
second save retained the reported hash.

| Scenario | Target result | SHA-256 | Contract result |
| --- | --- | --- | --- |
| Insert paragraph before target | `41DDC275`, ordinal 4, unchanged text | `a190db1190f4bb81ec748aedba8e12ed8aced4ce597781b5dbcd26f27705d06f` | Pass: resolves as moved |
| Delete paragraph before target | `41DDC275`, ordinal 2, unchanged text | `2454eaa822a435bcab3271db1bf10aa6985c3147473f357a69ec5a69aa1064c4` | Pass: resolves as moved |
| Edit target text and bold formatting without replacing its paragraph mark | `41DDC275`, ordinal 3, `Stable target edited in Word` | `95b4ecef2a27b3dbbe3058ffdc7c2319adea8b3c3e1884add81d8cc7050a31c8` | Pass: resolves same identity |
| Move target down with Word's paragraph relocation operation | new ID `79C8A5A2`, ordinal 4 | `d76c2492652e27617ccfb3afabaf360380cb8b515bac4a1ba65a99fca79d6f9a` | **Fail:** old identity disappears |
| Delete target | old identity absent | `f1e1079d01e0327aa5e4c0651caf5d6e33d84acc34ae1a8bded04096033bc379` | Pass: unavailable |
| Split target after `Stable` | old ID `41DDC275` survives on only the second fragment, ` target`; first fragment gets `2B251D51` | `87f95aebec6ffe2e7c852f2f7a7cac1a4e439f46478c9291d0b635723f8c49e4` | **Fail:** identity-only resolution falsely binds to one fragment |
| Merge target with following paragraph | old target ID absent; merged paragraph uses following ID `21ED9156` | `fbae440f552d42e49886a5ee6866666e0fa60f77cb9dc5c2f90192ffc03eb46a` | Pass: unavailable |

The split result is decisive because the proposed resolver cannot distinguish
the surviving fragment from the original paragraph using the native identity
alone. Returning that fragment would violate the exactly-zero false-binding
gate; refusing it would require additional persistent source data or heuristic
comparison that the confirmed contract excludes.

## Renderer and semantic-layer results

The project-owned DOCX layer now covers ZIP/XML limits, active-content
rejection, final-view body extraction, native identity validation, search,
reference parsing, hyperlink and bookmark policy, unavailable-content
evidence, and a non-persisted sanitized renderer derivative.

Both exact renderer candidates:

- built successfully behind the same adapter interface;
- mapped every semantic paragraph in the committed correctness corpus;
- rendered the final revision view after deleted and hidden content was removed
  from the in-memory derivative;
- passed the same unavailable-content mapping checks;
- performed no source write in the test paths.

`npm audit --omit=dev` initially identified the exact comparison candidate
`mammoth@1.10.0` as affected by the directory-traversal advisory
`GHSA-rmjr-87wv-gf87` (`>=0.3.25 <1.11.0`). The exploration does not change the
confirmed candidate version, so Mammoth also fails a current dependency-safety
check. Both DOCX candidates are kept as development-only exploration
dependencies and do not enter the default release dependency surface.
After that isolation, `npm audit --omit=dev` reported zero production
dependency vulnerabilities.

The exploration bundles were:

| Candidate | Bundle bytes |
| --- | ---: |
| `mammoth@1.10.0` | 1,733,570 |
| `docx-preview@0.3.6` | 1,390,650 |

The DOCX-focused suite completed with 45 passing tests. TypeScript checking, the
unchanged default production build, and both isolated DOCX candidate builds
also completed successfully.

## Non-installed performance observation

These figures are one-run JSDOM engineering observations, not installed
Obsidian p95 acceptance evidence:

| Candidate | Paragraphs | Semantic ms | Sanitize ms | Render ms | Total ms | DOM elements |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mammoth | 1,000 | 94.6 | 70.8 | 132.1 | 299.8 | 1,001 |
| Mammoth | 5,000 | 467.4 | 342.0 | 294.2 | 1,109.2 | 5,001 |
| docx-preview | 1,000 | 49.0 | 42.3 | 84.8 | 178.4 | 2,007 |
| docx-preview | 5,000 | 455.5 | 331.5 | 333.2 | 1,133.2 | 10,007 |

Both adapters eagerly created DOM proportional to the complete document. That
fails the confirmed requirement that the stress fixture not create an
unbounded all-content DOM on open. Installed Obsidian p95 measurement was
therefore not promoted to an acceptance run after two independent hard gates
had already failed.

## Subsequent scoped release decision

This report records the rejected stable-reference experiment. The later,
separately accepted release scope removes DOCX references entirely and keeps
only local reading and current-document search. Production integration and its
current acceptance gates are defined in
`docs/prd/docx-reading-search-release.md` and ADR 0005; the historical
exploration entry and runtime candidate switch were removed.
