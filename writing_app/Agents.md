# AGENTS.md

You are working in The Author Engine, a small Flask web app with a Jinja-rendered
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
- If `templates/index.html` or `static/` changes, run `../sync-pages.sh` from `writing_app` or `./sync-pages.sh` from the repo root so `docs/` stays current.
