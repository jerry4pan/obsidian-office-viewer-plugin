# Cost-aware agent delegation

## When to delegate

Use subagents only when at least two tasks:

- have no unresolved dependency on each other;
- modify disjoint files;
- can be verified independently;
- materially benefit from parallel execution.

Keep tightly coupled implementation sequential.

## Concurrency

- Run at most two subagents concurrently.
- Child agents must not spawn additional agents.
- The coordinating agent owns the dependency graph and integration.
- Do not run concurrent installed-Obsidian or performance suites against the same workspace.

## Context

- Prefer `fork_turns="none"` when the current surface supports it.
- Do not inherit the complete parent conversation.
- Give each agent a focused brief containing only:
  - the objective and acceptance criteria;
  - exact files in scope;
  - required interfaces and prior decisions;
  - focused verification commands;
  - explicit out-of-scope boundaries.
- Point to relevant source files instead of copying large plans or logs.
- Return only status, changed files, verification results, and blockers.

## Writes and integration

- Concurrent agents must not modify the same files.
- GitHub issue, milestone, branch, commit, and other external-state operations remain with the coordinating agent unless explicitly delegated.
- The coordinating agent inspects the combined diff before dependent work begins.
- Full-suite verification runs only after a parallel batch has been integrated.

## Review policy

- Implementers run focused tests and self-review their own task.
- Do not start a separate reviewer for every small task.
- Run one integration review after the main implementation slice.
- Run one final branch review before completion.
- Re-review only when the previous review found a confirmed Critical or Important issue.
- Send all final-review findings to one fixer rather than one agent per finding.
