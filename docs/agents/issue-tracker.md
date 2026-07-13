# Issue tracker: GitHub

Issues and PRDs for this repository live as GitHub Issues. Use the `gh` CLI for all operations and infer the repository from the configured Git remote.

## Conventions

- Create an issue with `gh issue create` and use a body file for multi-line content.
- Read an issue and its discussion with `gh issue view <number> --comments`.
- List work with `gh issue list`, selecting the labels and state required by the workflow.
- Comment with `gh issue comment <number>`.
- Apply or remove labels with `gh issue edit <number> --add-label <label>` and `--remove-label <label>`.
- Close completed or rejected work with `gh issue close <number>` and an explanatory comment.

## Pull requests as a triage surface

External pull requests are **not** treated as feature requests or included in the triage queue. Issues are the only request surface for the engineering skills.

## Publishing and fetching

- When a skill says “publish to the issue tracker”, create a GitHub Issue.
- When a skill says “fetch the relevant ticket”, read the corresponding GitHub Issue and its comments.
