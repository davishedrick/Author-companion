# AGENTS.md

You are working in Scriptor, a small Flask web app with a Jinja-rendered
workspace, split static assets, SQLite persistence, and tests that guard UI
contracts.

Rules:
- Prefer small, focused changes.
- Preserve existing structure unless asked to refactor.
- Keep Flask route wiring in `app.py`.
- Keep account/password logic in `auth_store.py`.
- Keep persistence setup and state normalization in `state_store.py`.
- Put workspace markup in `templates/index.html`; auth pages live in their own templates.
- Keep client behavior in the relevant `static/js/` module instead of adding inline scripts.
- Keep styling in the relevant `static/css/` file and import new CSS from `static/css/app.css`.
- Add or update tests for every behavior change.
- Run `pytest` after code changes when feasible.
- Run `ruff format .` and `ruff check .` after Python changes when feasible.
- Do not introduce new dependencies unless necessary.
- Explain tradeoffs before large refactors.
- Keep functions short and readable.
- Follow standard Python naming and import conventions.
- If `templates/index.html` or `static/` changes, run `../sync-pages.sh` from the Scriptor app directory or `./sync-pages.sh` from the repo root so `docs/` stays current.
## Bug documentation rule

If a task involves a bug, regression, broken behavior, unexpected behavior, data corruption, state mismatch, UI failure, or user-reported issue:

1. Check BUGS.md for related prior bugs before editing code.
2. If this is a new bug class, add a new BUGS.md entry.
3. If this is related to an existing bug, update the existing BUGS.md entry instead of creating a duplicate.
4. Include:
   - symptom
   - reproduction steps
   - expected behavior
   - actual behavior
   - root cause, if identified
   - files changed
   - regression test added or reason no test was added
   - verification commands run
   - status
5. Update QA_CHECKLIST.md if the bug affects a manual user flow.
6. Do not mark the task complete until BUGS.md has been updated or you explicitly state why no BUGS.md update was needed.