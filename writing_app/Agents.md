# AGENTS.md

You are working in a Python web app.

Rules:
- Prefer small, focused changes.
- Preserve existing structure unless asked to refactor.
- Use Flask blueprints and Jinja templates.
- Put business logic in services.py, not routes.py.
- Add or update tests for every behavior change.
- Run pytest after code changes.
- Run ruff check . and ruff format .
- Run mypy app tests only when type hints are present.
- Do not introduce new dependencies unless necessary.
- Explain tradeoffs before large refactors.
- Keep functions short and readable.
- Follow standard Python naming and import conventions.