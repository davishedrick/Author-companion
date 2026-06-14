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

## APP-2026-06-13-deleted-project-reappears-in-safari-get-in-flight

- Status: Fixed
- Reported: 2026-06-13
- Area: Project state | Persistence
- Severity: High
- Owner:
- Related files: `static/js/state.js`, `static/js/app.js`, `docs/static/js/`
- Related tests: `test_pending_snapshot_guard_prevents_in_flight_get_from_overwriting_deletion`
- Related scenarios: `PS-DEL-001`

### Summary

After the Chrome confirm-dialog fix, project deletion still failed in Safari. Deleting an archived project caused it to disappear for a moment and then reappear, with the server never recording the deletion.

### Reproduction

1. Start from: a project bound to a Google Doc and archived, using Safari (no Chrome extension).
2. Do: focus the Safari tab (triggering a remote refresh GET) → quickly click "Delete permanently" → confirm in the browser dialog before the GET completes.
3. Expected: project is removed and stays removed.
4. Actual: project disappears for a second, then reappears. Server still has the project.

### Root Cause

When a remote refresh GET is already in-flight (`remoteSyncSuspended = true`), `queueRemoteStateSync()` returned early without saving `pendingRemoteSnapshot`. The local deletion was applied to `state` and rendered, but no PUT was ever queued. When the GET completed, `applyPersistedSnapshot` overwrote local state with the server's old snapshot (which still had the project), making it reappear. This race window exists in any browser where a focus/visibility event fires before the sync queue is idle — in Safari this is common because `window.focus` fires when the user switches to the tab, often right before a delete action.

### Fix

Two-part change:

1. **`state.js` — `queueRemoteStateSync`**: always saves `pendingRemoteSnapshot = serializeStateSnapshot()` before checking `remoteSyncSuspended`. If suspended, the snapshot is saved but the PUT is not chained yet; the snapshot will be flushed when suspension ends.

2. **`app.js` — `refreshRemoteStateFromServer`**: after the GET response arrives, checks `pendingRemoteSnapshot` before calling `applyPersistedSnapshot`. If a local change is pending, skips the apply (preserving the deletion in local state and UI). The `finally` block then chains the saved snapshot as a PUT, ensuring the deletion reaches the server.

### Verification

- Automated: `test_pending_snapshot_guard_prevents_in_flight_get_from_overwriting_deletion` checks that `queueRemoteStateSync` saves the snapshot before the `remoteSyncSuspended` guard, that the GET skips `applyPersistedSnapshot` when `pendingRemoteSnapshot` is set, and that the finally block flushes the snapshot as a PUT.
- Manual (Safari): focus the Safari tab, immediately open the archive, delete a project — project must not reappear after any subsequent tab focus, alt-tab, or page visibility change.
