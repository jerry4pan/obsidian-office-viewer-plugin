# M1 Basic Reading Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the PRD M1 so an installed desktop Obsidian plugin provides a safe local PPTX opening and basic continuous-reading loop.

**Architecture:** Extend the existing `PptxViewSession` product seam while retaining `PptxFileView`, `Vault.readBinary`, the candidate-neutral renderer contract, and the preflight decorator. Verify each behavior first at the session DOM seam, then at the installed Obsidian seam without introducing M2 features.

**Tech Stack:** TypeScript 7, Obsidian 1.13 API, Vitest/jsdom, WebdriverIO with `wdio-obsidian-service`, esbuild, `@aiden0z/pptx-renderer` behind `PptxRendererAdapter`.

## Global Constraints

- Support `.pptx` only on desktop Obsidian; do not add legacy `.ppt` handling.
- Read source bytes only through the Vault abstraction and never write the source.
- Keep all renderer-specific objects and failures behind `PptxRendererAdapter` and `PptxOpenError`.
- Do not use Office, LibreOffice, PDF conversion, cloud rendering, document servers, or network services.
- Do not add M2 thumbnails, zoom, keyboard navigation, full-screen, persistence, prefetch, or virtualization.
- Do not expose file paths, filenames, document content, or renderer-specific error details in user-facing failures.
- Test only the PRD-approved session DOM and installed Obsidian seams; retain all M0 contract, compatibility, performance, and safety gates.

---

### Task 1: Track the M1 vertical slice

**Files:**
- Reference: `docs/prd/v0.1-first-public-release.md`
- Reference: `docs/superpowers/specs/2026-07-14-m1-basic-reading-design.md`

**Interfaces:**
- Consumes: GitHub milestone `v0.1 M1 — 基础阅读闭环` and canonical label `ready-for-agent`.
- Produces: one M1 implementation issue whose checklist mirrors the PRD deliverables and exit conditions.

- [ ] **Step 1: Create the implementation issue**

Create `[M1] 完成可安装插件与基础阅读闭环` with the design link, explicit deliverable and exit-condition checklists, milestone 2, and `ready-for-agent`.

- [ ] **Step 2: Read back the issue**

Run: `gh issue view 13 --comments`

Expected: the issue is open, assigned to milestone 2, carries `ready-for-agent`, and contains no placeholder requirement.

### Task 2: Add empty state and complete navigation controls

**Files:**
- Modify: `src/pptx-view-session.ts`
- Modify: `styles.css`
- Test: `tests/pptx-view-session.test.ts`

**Interfaces:**
- Consumes: `PptxRendererSession.slideCount` and `renderSlide(index: number)`.
- Produces: DOM actions `previous-slide`, `next-slide`, `page-number`, `jump-to-slide`, and `open-externally`; root states `empty`, `loading`, `ready`, and `degraded`.

- [ ] **Step 1: Write failing empty and jump tests**

Add tests that assert a new session starts with `data-state="empty"`, that a
three-slide deck jumps from page 1 to page 3 by submitting `3`, and that the
renderer receives zero-based index `2`.

```ts
expect(root.dataset.state).toBe("empty");
const input = root.querySelector<HTMLInputElement>('[data-action="page-number"]')!;
input.value = "3";
root.querySelector<HTMLButtonElement>('[data-action="jump-to-slide"]')!.click();
await vi.waitFor(() => expect(rendererSession.renderSlide).toHaveBeenLastCalledWith(2));
expect(root.textContent).toContain("3 / 3");
```

- [ ] **Step 2: Run the focused tests and verify red**

Run: `npx vitest run tests/pptx-view-session.test.ts`

Expected: FAIL because the empty state and page-number actions do not exist.

- [ ] **Step 3: Implement the empty state and shared navigation path**

Render explicit empty copy in the constructor. In `open`, create a one-based
number input and jump button, and route previous, next, and jump through the
existing zero-based `navigate` function. Update the input and `X / N` display
only after a successful render.

- [ ] **Step 4: Add invalid-input and boundary tests**

Use `0`, `4`, `1.5`, and empty text against a three-slide deck. Assert
`renderSlide` remains called only for initial index `0`, the visible page
remains `1 / 3`, and the status is `Enter a slide number from 1 to 3.`.

- [ ] **Step 5: Implement validation and degraded navigation**

Accept only finite integers between 1 and `slideCount`. On a later
`renderSlide` rejection or adapter-reported slide error, keep the last readable
slide visible, reset the jump input, set `data-state="degraded"`, show a
page-specific failure, and restore controls. The selected adapter must make a
target render atomic by restoring the prior slide on failure, with a
DOM-and-canvas snapshot fallback if rollback rendering also fails. Clear the
message and return to `ready` after a successful navigation.

- [ ] **Step 6: Expose the default-application action in the ready toolbar**

When `actions.openExternally` exists, render `open-externally` beside the
navigation controls. Keep the existing error-panel fallback and show
`Unable to open the default application.` locally if the ready-state action
rejects.

- [ ] **Step 7: Run the session tests and typecheck**

Run: `npx vitest run tests/pptx-view-session.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit the product slice**

```bash
git add src/pptx-view-session.ts styles.css tests/pptx-view-session.test.ts
git commit -m "feat(viewer): complete basic PPTX navigation"
```

### Task 3: Verify the plugin boundary and read-only fallback

**Files:**
- Modify: `tests/plugin-registration.test.ts`
- Modify only if a test exposes a defect: `src/pptx-file-view.ts`

**Interfaces:**
- Consumes: `PptxFileView.onLoadFile(TFile)`, `Vault.readBinary`, and the injected desktop external-open action.
- Produces: plugin-level proof of dedicated registration, read-only opening, page jump, close cleanup, and fallback presence.

- [ ] **Step 1: Write a failing plugin-boundary page-jump test**

Open the committed 12-slide performance fixture through the registered view
factory, enter `12`, click `jump-to-slide`, and assert the view reaches
`12 / 12` without any Vault write call.

- [ ] **Step 2: Run the focused test and verify red**

Run: `npx vitest run tests/plugin-registration.test.ts`

Expected: FAIL before Task 2 is integrated or if the boundary cannot expose
the new controls.

- [ ] **Step 3: Make only boundary fixes required by the test**

Retain `Vault.readBinary(file)` and the existing `getFullPath` plus
`electron.shell.openPath` action. Do not add a write path or renderer-specific
dependency to `PptxFileView`.

- [ ] **Step 4: Run plugin and session tests**

Run: `npx vitest run tests/plugin-registration.test.ts tests/pptx-view-session.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the boundary proof**

```bash
git add tests/plugin-registration.test.ts src/pptx-file-view.ts
git commit -m "test(plugin): cover the M1 reading boundary"
```

### Task 4: Expand installed Obsidian M1 acceptance

**Files:**
- Modify: `tests/e2e/open-pptx.e2e.ts`

**Interfaces:**
- Consumes: installed plugin UI actions and committed Vault fixtures.
- Produces: installed-path evidence for success, boundary-safe navigation,
  source immutability, error isolation, retry, fallback availability, and
  close cleanup.

- [ ] **Step 1: Add the installed multi-page navigation test**

Hash `performance/representative-12-slides.pptx`, open it, click Next, jump to
page 12, try invalid pages `0` and `13`, detach the leaf, and compare the final
hash with the initial hash. Assert the visible page remains valid throughout.

- [ ] **Step 2: Run the installed suite and verify the new coverage**

Run: `npm run test:e2e`

Expected: PASS with the sandboxed Obsidian instance; failures must identify
the action or state that did not settle.

- [ ] **Step 3: Confirm degraded compatibility evidence still runs installed**

Run: `npm run test:compatibility`

Expected: PASS with the committed Aiden corpus baselines, including the two
approved degraded fixtures.

- [ ] **Step 4: Commit installed acceptance**

```bash
git add tests/e2e/open-pptx.e2e.ts
git commit -m "test(e2e): verify the M1 reading loop"
```

### Task 5: Document and audit M1 completion

**Files:**
- Modify: `README.md`
- Create: `docs/m1-technical-report.md`

**Interfaces:**
- Consumes: committed source, M1 tests, PRD deliverables and exit conditions.
- Produces: user installation/development guidance and a requirement-to-evidence completion matrix.

- [ ] **Step 1: Update current capabilities and development install guidance**

Replace the M0-only README wording with the exact M1 controls, state handling,
fallback, current limits, and the clean test-Vault validation command. Keep
M2/M3 features explicitly unclaimed.

- [ ] **Step 2: Write the technical report**

For every M1 deliverable and exit condition, list its implementation evidence,
test evidence, and status. Record the exact verification commands and current
commit. Do not claim a command passed until it has run successfully.

- [ ] **Step 3: Run the complete verification matrix**

Run: `npm run verify`

Run: `npm run test:e2e`

Run: `npm run test:compatibility`

Run: `npm run test:performance:baseline`

Expected: all commands PASS. Preserve any generated evidence outside ignored
artifact directories only when the repository protocol requires it.

- [ ] **Step 4: Self-review the requirement matrix**

Cross-check the report against every bullet under M1 Deliverables and Exit
Conditions in the PRD. Any missing or indirect evidence is unfinished work,
not a documentation exception.

- [ ] **Step 5: Commit documentation and evidence**

```bash
git add README.md docs/m1-technical-report.md
git commit -m "docs: record M1 completion evidence"
```

### Task 6: Review, remediate, and close M1

**Files:**
- Review: all changes from `main...HEAD`
- Modify: any in-scope file required by review findings

**Interfaces:**
- Consumes: complete branch diff and verification outputs.
- Produces: reviewed commits, a closed implementation issue, and a closed M1 milestone.

- [ ] **Step 1: Run the `code-review` skill against `main...HEAD`**

Review correctness and code quality, with special attention to stale async
navigation, renderer disposal, invalid input, source immutability, and
renderer-boundary leakage.

- [ ] **Step 2: Fix every confirmed in-scope finding and rerun affected tests**

Use a red-green cycle for behavioral corrections. Run the smallest affected
test first and the full `npm run verify` after the final correction.

- [ ] **Step 3: Commit review fixes**

Stage each file named by the review after inspecting `git diff --check` and
`git status --short`, then run:

```bash
git commit -m "fix: address M1 review findings"
```

Skip this commit only when the review has no findings and the worktree is
clean.

- [ ] **Step 4: Update and close the M1 implementation issue**

Post the requirement matrix and verification summary, replace
`ready-for-agent` with the appropriate completed state by closing the issue,
and include the final commit identifiers.

- [ ] **Step 5: Close the M1 milestone**

Close milestone 2 only after it has zero open issues and every PRD M1 exit
condition is evidenced by the committed branch.
