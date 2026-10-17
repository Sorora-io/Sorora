# Sorora agent instructions

- Read only the task-relevant guides below **before** changing their area. Follow their linked source files when more detail is needed; do not load every guide by default.
- Check Git status first. Preserve unrelated edits and deletions; never stage the whole checkout blindly.
- UI actions and navigation CTAs use the shared `<Button>`. Underlined links are only for inline prose or footer navigation. Load the UI guide for variants and exceptions.
- Keep credentials, private environment files, generated builds and dependency directories out of commits.
- Shipping includes committing intended changes, pushing them, verifying the remote commit, and recording its deployment. Never silently deploy local-only work. Respect an explicit user request to keep work local.

| Task | Load first |
|---|---|
| Components, styling, navigation or copy | [UI rules](docs/agents/ui.md) |
| App structure, membership, authorization, database or Edge Functions | [Architecture and data](docs/agents/architecture.md) |
| Tests, build checks or database verification | [Validation](docs/agents/validation.md) |
| Commits, pushes, migrations, deployments or reconciliation | [Shipping and Git](docs/agents/shipping.md) |
