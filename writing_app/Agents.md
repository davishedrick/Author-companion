# Agents.md — Scriptor Web App

Use this file for the Scriptor web app only.

Use this app directory's `BUGS.md` for app bugs.

Use this app directory's `SCENARIOS.md` for app workflow coverage.

Extension-specific Google Docs tracking rules, bugs, and scenarios belong in the extension repo.

## Purpose

This repository powers the Scriptor web application.

The goal is not extensive documentation.

The goal is:

1. Reliable project data.
2. Reliable dashboard calculations.
3. Reliable editing workflows.
4. Reliable synchronization with the extension.
5. Prevention of regressions.

Every change should improve reliability without creating unnecessary complexity.

---

# Core Principles

Prefer:

- Small focused changes.
- Existing architecture.
- Existing patterns.
- Regression prevention.
- Scenario coverage.

Avoid:

- Large refactors unless necessary.
- Duplicate systems.
- New dependencies unless justified.
- Documentation for its own sake.
- Rewriting working code.

---

# Repository Structure

Preserve current architecture unless explicitly instructed otherwise.

### Backend

- `app.py`
  - Flask routes
  - Request handling
  - Application wiring

- `auth_store.py`
  - Authentication
  - Password management
  - Account logic

- `state_store.py`
  - Persistence
  - State normalization
  - Project storage

### Frontend

- `templates/index.html`
  - Workspace markup

- `templates/*`
  - Auth pages and supporting templates

- `static/js/*`
  - Client-side behavior

- `static/css/*`
  - Styling

Do not move functionality between layers without a clear reason.

---

# Development Philosophy

Fix root causes.

Do not patch symptoms.

Before implementing a fix:

1. Reproduce issue.
2. Identify root cause.
3. Prove root cause.
4. Implement fix.
5. Verify fix.
6. Add regression coverage.

---

# Root Cause Standard

Every bug should be explainable in one or two sentences.

Bad:

"Dashboard calculations seem broken."

Good:

"Project completion percentage used the target word count from a stale state object instead of the normalized project bundle."

Do not implement fixes based on assumptions.

---

# Scenario Driven Development

Most bugs originate from user workflows.

Whenever a bug is fixed:

Ask:

"What user workflow exposed this issue?"

If the workflow is missing from this app's `SCENARIOS.md`:

Add it.

---

# Scenario Categories

The following areas require strong scenario coverage.

## Project Lifecycle

- Create project
- Edit project
- Archive project
- Restore project
- Delete project

## Writing Workflow

- Create session
- End session
- Negative session
- Multiple sessions same day
- Historical session edits

## Dashboard

- Progress calculations
- Milestones
- Streaks
- Completion forecasts
- Published project views

## Editing Workflow

- Pass management
- Issue tracking
- Chapter management
- Session tracking
- Completion calculations

## Story Workspace

- Characters
- Locations
- Worldbuilding
- Glossary
- History
- Mythology

## Goals

- Goal creation
- Goal completion
- Goal archiving
- Daily targets
- Custom schedules

## Publishing

- Manuscript completion
- Publish workflow
- Reopen workflow
- Final statistics

## Extension Synchronization

Highest risk area.

Validate:

- Bound document synchronization
- Word count synchronization
- Catch-up sessions
- Project linking
- Session imports
- State reconciliation

---

# High-Risk Systems

Changes affecting these systems require extra caution.

### Critical

- Project persistence
- Word count calculations
- Session calculations
- Dashboard metrics
- Extension synchronization
- Published project state

### High

- Editing workflows
- Goal calculations
- Historical data views

### Medium

- Navigation
- UI state
- Filters
- Sorting

### Low

- Styling
- Copy
- Visual polish

Never risk a Critical system to improve a Low-priority system.

---

# Testing Requirements

For behavior changes:

Add or update tests whenever practical.

Prefer:

- Regression tests
- Workflow tests
- State validation tests

Over:

- Implementation-specific tests

Tests should verify behavior, not internal implementation details.

---

# Verification

When feasible:

### Python Changes

Run:

```bash
ruff format .
ruff check .
pytest
```

### Frontend Changes

Run relevant test suites.

Verify affected workflows manually when necessary.

---

# Sync Requirement

If any of the following change:

- `templates/index.html`
- `static/js/*`
- `static/css/*`

Run:

```bash
./sync-pages.sh
```

(or the equivalent project path)

to keep `docs/` synchronized.

---

# Bugs.md Rules

This app's `BUGS.md` is a lightweight tracking system.

It is not a knowledge base.

It is not architecture documentation.

Before fixing a bug:

1. Check for existing entry.
2. Update existing entry if applicable.
3. Create new entry only if it is a genuinely new bug class.

Keep entries concise.

Required fields:

- Summary
- Reproduction
- Expected behavior
- Actual behavior
- Root cause
- Fix
- Regression coverage
- Status

---

# Definition of Done

A bug is not complete until:

- Root cause identified.
- Root cause verified.
- Fix implemented.
- Original issue no longer reproduces.
- Regression coverage exists.
- Scenario exists or was updated.
- This app's `BUGS.md` updated.

Only then may the task be considered complete.

---

# Token Efficiency Rules

Prefer:

- Updating existing files.
- Updating scenarios.
- Adding regression tests.
- Small targeted fixes.

Avoid:

- Long reports.
- Large postmortems.
- Excessive documentation.
- Repeating information already stored elsewhere.

The objective is a stable application, not maximum documentation.

---

# Success Definition

A successful change:

1. Solves the issue.
2. Prevents recurrence.
3. Preserves existing behavior.
4. Minimizes maintenance burden.

Every fix should make Scriptor more reliable than it was before.
