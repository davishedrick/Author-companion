# Author Companion

Author Companion is a Flask-based writing workspace prototype that renders the app from `templates/index.html`.

## What it is

The project serves a single-page writing interface using Flask and Jinja templates.

## Project structure

- `app.py` - Flask app entry point.
- `templates/index.html` - main interface markup, styling, and client-side behavior.
- `tests/test_app.py` - basic coverage for the home page and key UI contracts.

## How to run

From the `writing_app` directory, install dependencies and start the Flask app:

```bash
pip install -r requirements.txt
python app.py
```

Then visit:

- `http://localhost:8000/`

## Notes

- The app listens on port `8000` by default.
- Because the development server binds to `127.0.0.1`, it is only reachable from the same machine unless the host setting is changed.
