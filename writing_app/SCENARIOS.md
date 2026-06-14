# Scriptor Web App Scenario Registry

Use this file for web app workflows only. Extension-specific Google Docs tracking scenarios belong in the extension repo's `SCENARIOS.md`.

Coverage values:

- Automated: an existing test covers the exact behavior.
- Partially automated: tests cover nearby logic, but not the full user journey.
- Manual only: covered by manual QA and not automated yet.
- Missing: no meaningful automated or manual coverage yet.

## Project Lifecycle

| ID | Title | Affected Area | Steps | Expected Behavior | Automated Status | Test File / Name | Manual QA Fallback | Related Bugs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APP-PL-001 | Create project | Project state | Create a new project from the app. | Project is persisted with normalized defaults and appears on reload. | Partially automated | `tests/test_app.py` | Manual app smoke |  |
| APP-PL-002 | Edit project metadata | Project state | Edit title, target, status, or manuscript metadata. | Changes persist without corrupting sessions, issues, or extension bindings. | Partially automated | `tests/test_app.py` | Manual app smoke |  |
| APP-PL-003 | Archive restore delete project | Project state | Archive, restore, and delete a project. | Project visibility and state transitions are correct, with no orphaned dashboard data. | Missing |  | Manual app smoke |  |
| PS-DEL-001 | Permanently delete archived project | Project state | Archive a project, then open the archive panel and click "Delete permanently" → confirm the browser dialog. | Project is removed immediately and stays removed. No reappearance after subsequent tab focus, page visibility change, or any other remote-refresh trigger. Server no longer returns the project. | Automated (static) | `tests/test_app.py::test_native_confirm_guard_prevents_remote_refresh_race_on_deletion` | Manually archive a project, delete it, then alt-tab away and back — project must not reappear. | APP-2026-06-13-deleted-project-reappears-after-confirm-dialog |

## Writing Workflow

| ID | Title | Affected Area | Steps | Expected Behavior | Automated Status | Test File / Name | Manual QA Fallback | Related Bugs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APP-WW-001 | Add writing session | Writing session | Add a positive writing session in the app. | Project current words, history, streaks, and dashboard totals update consistently. | Partially automated | `tests/test_app.py` | Manual app smoke |  |
| APP-WW-002 | Negative session is valid | Writing session | Add or import a session with a negative net word count. | The app preserves the negative net and calculates current words from the ending count when available. | Partially automated | `tests/test_backend_contracts.py` | Manual app smoke |  |
| APP-WW-003 | Edit historical session | Writing session | Edit or correct an existing session. | Dashboard and project totals recompute from normalized session state. | Missing |  | Manual app smoke |  |
| APP-WW-004 | Open-ended stopwatch session | Writing or editing session | Select Stopwatch on the session timer screen, start a session, write or edit without a planned duration, then stop it manually. | The clock counts up, does not auto-complete, and the saved handoff uses elapsed minutes. | Automated | `tests/test_app.py::test_edit_dashboard_uses_the_same_start_timer_pattern_as_writing_sessions` | Manual app smoke |  |

## Dashboard

| ID | Title | Affected Area | Steps | Expected Behavior | Automated Status | Test File / Name | Manual QA Fallback | Related Bugs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APP-DB-001 | Progress calculations | Dashboard | View a project with starting/current/target word counts. | Progress, remaining words, and completion percentage use normalized project values. | Partially automated | `tests/test_app.py` | Manual app smoke |  |
| APP-DB-002 | Streaks and daily totals | Dashboard | Add sessions across multiple days. | Streaks and daily totals reflect saved session dates and net words. | Missing |  | Manual app smoke |  |
| APP-DB-003 | Published project dashboard | Dashboard | Publish a completed project and view dashboard stats. | Published state has stable final statistics and distinct project status. | Missing |  | Manual app smoke |  |

## Editing Workflow

| ID | Title | Affected Area | Steps | Expected Behavior | Automated Status | Test File / Name | Manual QA Fallback | Related Bugs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APP-EW-001 | Manage edit pass | Editing workflow | Create, update, and complete an editing pass. | Pass state persists and project editing progress updates. | Missing |  | Manual app smoke |  |
| APP-EW-002 | Track issue lifecycle | Editing workflow | Create, update, resolve, and filter issues. | Issues remain attached to the correct project and manuscript context. | Partially automated | `tests/test_app.py` | Manual app smoke |  |
| APP-EW-003 | Chapter management | Editing workflow | Add, reorder, edit, or complete chapters. | Chapter state persists and completion calculations remain correct. | Missing |  | Manual app smoke |  |

## Story Workspace

| ID | Title | Affected Area | Steps | Expected Behavior | Automated Status | Test File / Name | Manual QA Fallback | Related Bugs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APP-SW-001 | Manage story entity | Story workspace | Create and edit a character, location, glossary, or worldbuilding item. | Entity state persists under the correct project without affecting writing stats. | Missing |  | Manual app smoke |  |
| APP-SW-002 | Search and filter story data | Story workspace | Search/filter story workspace records. | Results are scoped to the active project and selected category. | Missing |  | Manual app smoke |  |

## Goals

| ID | Title | Affected Area | Steps | Expected Behavior | Automated Status | Test File / Name | Manual QA Fallback | Related Bugs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APP-GO-001 | Create goal | Goals | Create a word-count or schedule goal. | Goal persists and contributes to dashboard goal state. | Missing |  | Manual app smoke |  |
| APP-GO-002 | Complete archive goal | Goals | Complete and archive a goal. | Goal status changes without corrupting historical session data. | Missing |  | Manual app smoke |  |

## Publishing

| ID | Title | Affected Area | Steps | Expected Behavior | Automated Status | Test File / Name | Manual QA Fallback | Related Bugs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APP-PB-001 | Publish manuscript | Publishing | Mark a manuscript/project complete and publish it. | Final stats are captured and the project becomes published without losing history. | Missing |  | Manual app smoke |  |
| APP-PB-002 | Reopen published manuscript | Publishing | Reopen a published project. | Project returns to an editable state with history and stats preserved. | Missing |  | Manual app smoke |  |

## Extension Synchronization

| ID | Title | Affected Area | Steps | Expected Behavior | Automated Status | Test File / Name | Manual QA Fallback | Related Bugs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APP-ES-001 | Bind document contract | Extension sync | Extension creates or updates a document binding through the app API. | App stores normalized document ID, tab ID, surface ID, project ID, and verified word count. | Automated | `tests/test_backend_contracts.py` | Manual extension/app smoke |  |
| APP-ES-002 | Import extension session | Extension sync | Extension posts a writing, editing, or catch-up session. | App stores the session, preserves net words including negatives, and updates project current count from verified ending count. | Automated | `tests/test_backend_contracts.py` | Manual extension/app smoke |  |
| APP-ES-003 | Stale binding status | Extension sync | Extension marks a bound document stale, inaccessible, or missing. | App exposes the project as requiring rebind without changing history or word counts. | Partially automated | `tests/test_backend_contracts.py` | Manual extension/app smoke |  |
