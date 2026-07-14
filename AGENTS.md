# Agent instructions

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues; external pull requests are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the canonical `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix` labels. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. Read the root `CONTEXT.md` when present and any relevant ADRs under `docs/adr/`. See `docs/agents/domain.md`.

## Cost-aware delegation

For multi-task implementation plans, follow `docs/agents/delegation.md`.

- Delegate only genuinely independent work.
- Run at most two subagents concurrently.
- Do not allow nested delegation.
- Never let concurrent agents modify the same files.
- Keep integration, external-state changes, and final verification with the coordinating agent.
