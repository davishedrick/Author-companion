# The Author Engine

The Author Engine is a Flask writing workspace for planning, drafting, editing,
goal tracking, and project export. The hosted Flask app adds account login,
server-side SQLite persistence, and password reset email on top of the browser UI.

## App Shape

The main workspace is rendered from `templates/index.html` and then built out by
the split JavaScript and CSS assets in `static/`. Authentication pages are
separate Jinja templates.

Runtime data is stored in SQLite. By default Flask writes the database to the app
instance directory as `author_engine_state.sqlite3`; tests override that path with
`STATE_DB_PATH`.

## Project Structure

- `app.py` - Flask routes, auth/session gates, state API, and password reset email.
- `auth_store.py` - user accounts, password hashing, and reset token lifecycle.
- `state_store.py` - SQLite setup plus load/save helpers for per-user app state.
- `templates/` - Jinja templates for the workspace and authentication flows.
- `static/css/` - CSS entry point and feature-specific stylesheets.
- `static/js/` - client-side state, workspace rendering, import/export, and UI behavior.
- `tests/test_app.py` - route, persistence, auth, static asset, and UI contract tests.
- `../docs/` - static GitHub Pages artifact synced from the Flask workspace assets.

## Local Setup

From the `writing_app` directory, install dependencies and start the Flask app:

```bash
pip install -r requirements.txt
python app.py
```

Then visit:

- `http://localhost:8000/`

On first launch, `/login` creates the owner account. After at least one user
exists, the same page becomes the sign-in screen and shows the password reset
link.

## Useful Commands

Run tests from `writing_app`:

```bash
pytest
```

Run formatting and lint checks:

```bash
ruff format .
ruff check .
```

## Password Reset Email

Password reset emails now use Gmail SMTP by default. To enable the reset flow, set these environment variables before starting the app:

```bash
export GMAIL_ADDRESS="youraddress@gmail.com"
export GMAIL_APP_PASSWORD="your-16-character-app-password"
```

Optional overrides:

```bash
export MAIL_SENDER="youraddress@gmail.com"
export MAIL_HOST="smtp.gmail.com"
export MAIL_PORT="587"
export MAIL_USE_TLS="true"
export MAIL_USE_SSL="false"
export PASSWORD_RESET_TOKEN_TTL_SECONDS="3600"
```

Google setup steps:

1. Turn on 2-Step Verification for the Google account you want to send mail from.
2. Create an App Password in your Google account security settings.
3. Use that 16-character app password for `GMAIL_APP_PASSWORD`.
4. Start the Flask app with those environment variables in place.

Once configured, the `Forgot password?` link on the sign-in page will send real reset emails through Gmail.

For tests, `MAIL_OUTBOX` can be configured as a list on the Flask app config.
When present, reset emails are appended there instead of being sent through SMTP.

## Runtime Notes

- The app listens on port `8000` by default.
- Because the development server binds to `127.0.0.1`, it is only reachable from the same machine unless the host setting is changed.
- Set `SECRET_KEY` in any non-local environment so Flask session cookies are not signed with the development fallback.

## GitHub Pages Artifact

GitHub Pages only serves static files from the configured Pages source (typically the repository root, `/docs`, or the `gh-pages` branch). It does **not** run Flask, so updates to `app.py` never appear on Pages by themselves.

In this repository, the Pages artifact lives under `docs/`. If you edit `writing_app/templates/index.html` or anything in `writing_app/static/`, sync the Pages copy before pushing if you want the GitHub Pages site to reflect the change.

From the repository root:

```bash
./sync-pages.sh
```

That copies `writing_app/templates/index.html` to `docs/index.html` and mirrors
`writing_app/static/` to `docs/static/`. The test suite checks that both copies
stay in sync.
