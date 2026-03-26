# Author Companion

Author Companion is a single-page writing workspace prototype contained in `Writing app/MVP.html`.

## What it is

The project currently ships as one self-contained HTML file with embedded CSS and JavaScript for a polished authoring dashboard experience.

## Project structure

- `Writing app/MVP.html` – the main MVP interface and logic.

## How to run

Because the app is static, you can open it directly in a browser:

1. Navigate to this repository.
2. Open `Writing app/MVP.html` in your browser.

Or serve it locally from the repo root (recommended):

```bash
python3 -m http.server 8000
```

Then visit:

- `http://localhost:8000/Writing%20app/MVP.html`

## Notes

- This repository is currently MVP-focused and does not yet include a build system or package manager setup.
- Future improvements could split styles/scripts into dedicated files and add automated tests.
