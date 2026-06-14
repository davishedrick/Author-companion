# Scriptor Web App Bug Registry

Use this file for web app bugs only. Extension bugs belong in the extension repo's `BUGS.md`.

Keep entries short and tied to reproducible workflows. A bug is complete only when root cause is proven, the fix is verified, regression coverage exists when practical, and `SCENARIOS.md` is updated when the workflow is missing.

## Workflow

1. Reproduce the issue.
2. Identify the exact app file, function, state transition, or route involved.
3. Prove the root cause through tests, logs, state inspection, or reproduction.
4. Implement the smallest safe fix.
5. Verify the original bug and neighboring workflows.
6. Add or update regression coverage.
7. Add or update the matching scenario in this app's `SCENARIOS.md`.

## Entry Template

```md
## APP-YYYY-MM-DD-short-title

- Status: Open | Fixed | Watching
- Reported: YYYY-MM-DD
- Area: Project state | Writing session | Editing workflow | Dashboard | Goals | Publishing | Extension sync | Auth | Persistence
- Severity: Low | Medium | High | Critical
- Owner:
- Related files:
- Related tests:
- Related scenarios:

### Summary

What failed, in one or two sentences.

### Reproduction

1. Start from:
2. Do:
3. Expected:
4. Actual:

### Root Cause

What code path or state transition was responsible.

### Fix

What changed and why it is the smallest safe fix.

### Verification

- Automated:
- Manual:

### Follow-Up

Any remaining app-side QA or monitoring.
```

## Current Coverage Snapshot

- `tests/test_app.py`: Flask routes, project state behavior, dashboard/editing flows, auth-adjacent app behavior.
- `tests/test_backend_contracts.py`: extension bridge contracts, binding/session payload compatibility, app/extension synchronization.
- `tests/backend_contract_helpers.py`: reusable backend contract setup.

## Open Registry

Add app bug entries below this line.

## APP-2026-06-13-deleted-project-reappears-after-confirm-dialog

- Status: Fixed
- Reported: 2026-06-13
- Area: Project state | Persistence
- Severity: High
- Owner:
- Related files: `static/js/app.js`, `static/js/dashboard.js`, `static/js/state.js`, `docs/static/js/`
- Related tests: `test_native_confirm_guard_prevents_remote_refresh_race_on_deletion`
- Related scenarios: `PS-DEL-001`

### Summary

Permanently deleting an archived project caused it to disappear for a moment and then reappear. The deletion was never saved to the server. The same race could affect goal deletion and project import-replace.

### Reproduction

1. Start from: a project bound to a Google Doc and archived.
2. Do: click "Delete permanently" → confirm in the browser dialog.
3. Expected: project is removed and stays removed.
4. Actual: project disappears for a second, then reappears. Server still has the project.

### Root Cause

Chrome fires the `window.focus` event synchronously during `window.confirm()` blocking (before `confirm()` returns). The focus event triggers `refreshRemoteStateFromServer`, whose async body sets `remoteSyncSuspended = true` and issues a GET request to the server. When `window.confirm()` returns and the delete click handler continues, `queueRemoteStateSync()` checks `remoteSyncSuspended` and **skips the PUT** that would save the deletion. The in-flight GET returns the old server state (with the project), `applyPersistedSnapshot` overwrites the local deletion, and `render()` makes the project reappear permanently since the deletion PUT was never sent.

### Fix

Added `let nativeConfirmInProgress = false;` flag in `app.js`. `refreshRemoteStateFromServer` now checks this flag and returns early if it is `true`. All three `window.confirm()` call sites (project deletion in `app.js`, goal deletion in `dashboard.js`, project import-replace in `state.js`) set the flag to `true` immediately before the call and `false` immediately after, preventing any focus-triggered remote refresh from racing with the subsequent state mutation.

### Verification

- Automated: `test_native_confirm_guard_prevents_remote_refresh_race_on_deletion` verifies the flag is declared, checked in `refreshRemoteStateFromServer`, and set around all three `window.confirm()` call sites.
- Manual: archive a project, click "Delete permanently", confirm — project should be gone and not reappear on any subsequent page focus or tab switch.
