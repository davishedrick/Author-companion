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
