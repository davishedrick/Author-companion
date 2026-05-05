import re
from pathlib import Path

from app import app
from auth_store import authenticate_user, create_user


REPO_ROOT = Path(__file__).resolve().parents[2]
JS_FILES = [
    "state.js",
    "dashboard.js",
    "plot.js",
    "edit.js",
    "edit2.js",
    "app.js",
]
CSS_FILES = [
    "base.css",
    "layout.css",
    "dashboard.css",
    "plot.css",
    "edit.css",
    "edit2.css",
    "themes.css",
]


def get_html():
    return (REPO_ROOT / "writing_app" / "templates" / "index.html").read_text(
        encoding="utf-8"
    )


def get_js_asset(filename):
    client = app.test_client()
    response = client.get(f"/static/js/{filename}")
    assert response.status_code == 200
    return response.get_data(as_text=True)


def get_app_js():
    return "\n".join(get_js_asset(filename) for filename in JS_FILES)


def get_css_asset(filename):
    client = app.test_client()
    response = client.get(f"/static/css/{filename}")
    assert response.status_code == 200
    return response.get_data(as_text=True)


def get_app_css():
    return get_css_asset("app.css")


def use_temp_state_db(tmp_path):
    app.config["STATE_DB_PATH"] = str(tmp_path / "author-engine-test.sqlite3")
    app.config["SECRET_KEY"] = "test-secret"
    app.config["MAIL_OUTBOX"] = []
    app.config["MAIL_HOST"] = ""
    app.config["MAIL_SENDER"] = ""
    app.config["PASSWORD_RESET_TOKEN_TTL_SECONDS"] = 3600


def register_and_login(client, email="writer@example.com", password="verysecure"):
    response = client.post(
        "/login",
        data={"email": email, "password": password},
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert response.headers["Location"].endswith("/")
    return response


def test_home_redirects_to_login_when_signed_out(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    response = client.get("/")
    assert response.status_code == 302
    assert response.headers["Location"].endswith("/login")


def test_login_page_shows_owner_setup_before_first_account_exists(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()

    response = client.get("/login")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "Create your owner account" in html
    assert "Create account" in html


def test_first_account_signup_unlocks_home_page(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()

    register_and_login(client)
    response = client.get("/")

    assert response.status_code == 200
    assert "The Author Engine" in response.get_data(as_text=True)


def test_login_page_shows_forgot_password_link_after_accounts_exist(tmp_path):
    use_temp_state_db(tmp_path)

    with app.app_context():
        create_user("writer@example.com", "verysecure")

    client = app.test_client()
    response = client.get("/login")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "Forgot password?" in html
    assert "/forgot-password" in html


def test_password_reset_request_sends_email_and_updates_password(tmp_path):
    use_temp_state_db(tmp_path)

    with app.app_context():
        create_user("writer@example.com", "verysecure")

    client = app.test_client()
    response = client.post(
        "/forgot-password",
        data={"email": "writer@example.com"},
    )
    html = response.get_data(as_text=True)
    outbox = app.config["MAIL_OUTBOX"]

    assert response.status_code == 200
    assert "a password reset link has been sent" in html
    assert len(outbox) == 1
    assert outbox[0]["to"] == "writer@example.com"
    assert "Reset your Author Engine password" in outbox[0]["subject"]

    token_match = re.search(r"/reset-password/([A-Za-z0-9._=-]+)", outbox[0]["body"])
    assert token_match is not None
    token = token_match.group(1)

    reset_response = client.post(
        f"/reset-password/{token}",
        data={
            "password": "newsecurepass",
            "confirm_password": "newsecurepass",
        },
        follow_redirects=False,
    )

    assert reset_response.status_code == 302
    assert reset_response.headers["Location"].endswith("/login?reset=success")
    with app.app_context():
        assert authenticate_user("writer@example.com", "verysecure") is None
        assert (
            authenticate_user("writer@example.com", "newsecurepass")["email"]
            == "writer@example.com"
        )


def test_password_reset_request_is_generic_for_unknown_email(tmp_path):
    use_temp_state_db(tmp_path)

    with app.app_context():
        create_user("writer@example.com", "verysecure")

    client = app.test_client()
    response = client.post(
        "/forgot-password",
        data={"email": "missing@example.com"},
    )
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "a password reset link has been sent" in html
    assert app.config["MAIL_OUTBOX"] == []


def test_password_reset_token_cannot_be_reused(tmp_path):
    use_temp_state_db(tmp_path)

    with app.app_context():
        create_user("writer@example.com", "verysecure")

    client = app.test_client()
    client.post("/forgot-password", data={"email": "writer@example.com"})
    token_match = re.search(
        r"/reset-password/([A-Za-z0-9._=-]+)",
        app.config["MAIL_OUTBOX"][0]["body"],
    )
    assert token_match is not None
    token = token_match.group(1)

    first_reset = client.post(
        f"/reset-password/{token}",
        data={
            "password": "newsecurepass",
            "confirm_password": "newsecurepass",
        },
        follow_redirects=False,
    )
    second_reset = client.post(
        f"/reset-password/{token}",
        data={
            "password": "anotherpass",
            "confirm_password": "anotherpass",
        },
    )

    assert first_reset.status_code == 302
    assert second_reset.status_code == 200
    assert "already been used" in second_reset.get_data(as_text=True)


def test_html_references_separate_css_and_js_assets():
    html = get_html()

    assert '<link rel="stylesheet" href="static/css/app.css" />' in html
    for filename in JS_FILES:
        assert f'<script src="static/js/{filename}"></script>' in html
    assert "<style>" not in html
    assert html.count("<script src=") == len(JS_FILES)


def test_static_assets_load():
    css = get_app_css()
    js = get_app_js()

    for filename in CSS_FILES:
        assert f'@import url("./{filename}");' in css
    assert "persistAndRender();" in js
    assert ":root {" in get_css_asset("base.css")
    assert ".app-shell {" in get_css_asset("layout.css")
    assert ".content-shell {" in get_css_asset("layout.css")
    assert ".content-shell > * {" in get_css_asset("layout.css")
    assert ".stack {" in get_css_asset("layout.css")
    assert ".stack > * {" in get_css_asset("layout.css")
    assert ".hero > * {" in get_css_asset("layout.css")
    assert "width: 100%;" in get_css_asset("layout.css")
    assert ".resume-card {" in get_css_asset("dashboard.css")
    assert ".manuscript-complete-hero {" in get_css_asset("dashboard.css")
    assert ".published-hero {" in get_css_asset("dashboard.css")
    assert ".manuscript-confetti-burst {" in get_css_asset("dashboard.css")
    assert ".published-celebration-screen {" in get_css_asset("layout.css")
    assert ".nav-publish-shell {" in get_css_asset("layout.css")
    assert ".plot-workspace {" in get_css_asset("plot.css")
    assert ".edit-columns {" in get_css_asset("edit.css")
    assert ".open-issues-focus .section-head {" in get_css_asset("edit.css")
    assert ".edit-stage-roadmap {" in get_css_asset("edit.css")
    assert 'const STORAGE_KEY = "author-engine-mvp";' in get_js_asset("state.js")
    assert 'const STATE_API_ENDPOINT = "/api/state";' in get_js_asset("state.js")
    assert (
        'const DEFAULT_PLOT_SECTION_IDS = ["characters", "locations", "glossary", "worldRules", "history", "mythology"];'
        in get_js_asset("state.js")
    )
    assert '"memoirPeople"' in get_js_asset("state.js")
    assert '"research"' in get_js_asset("state.js")
    assert "fetchRemoteState()" in get_js_asset("app.js")
    assert "function renderDashboard(bundle)" in get_js_asset("dashboard.js")
    assert "function renderCompletedManuscriptDashboard(bundle, stats)" in get_js_asset(
        "dashboard.js"
    )
    assert "function launchManuscriptCompleteConfetti()" in get_js_asset("dashboard.js")
    assert "function renderGoalsDashboard(bundle)" in get_js_asset("dashboard.js")
    assert "function renderPlotDashboard(bundle)" in get_js_asset("plot.js")
    assert "function renderEditDashboard(bundle)" in get_js_asset("edit.js")
    assert 'const EDIT_FOCUS_ORDER = ["revision"];' in get_js_asset("state.js")
    assert (
        'function normalizeEditFocusKey(value = "", fallback = "revision")'
        in get_js_asset("state.js")
    )
    assert "Structural" not in get_js_asset("edit.js")
    assert 'option value="Structural"' not in get_html()
    assert "function renderProjects()" in get_js_asset("app.js")


def test_edit_dashboard_uses_the_same_start_timer_pattern_as_writing_sessions():
    html = get_html()
    js = get_js_asset("edit.js")
    dashboard_js = get_js_asset("dashboard.js")

    assert 'id="session-modal"' in html
    assert 'id="start-session-flow"' in html
    assert 'id="choose-writing-session-btn"' in html
    assert 'id="choose-editing-session-btn"' in html
    assert 'id="edit-session-dial"' in html
    assert 'id="editing-session-dial-wrap"' in html
    assert 'id="editing-session-screen"' in html
    assert 'id="end-edit-session-btn"' in html
    assert 'id="end-edit-session-confirm-modal"' in html
    assert "Start Session" in html
    assert "Log previous session" in html
    assert 'id="start-edit-session-btn"' not in html
    assert 'id="edit-session-start-modal"' not in html
    assert "function openEditSessionStartModal()" in js
    assert "function bindEditSessionDial()" in js
    assert "function bindEditSessionGlobalActions()" in js
    assert "function startEditingSession()" in js
    assert "function finishActiveEditingSession(autoCompleted = false)" in js
    assert "function chooseStartSessionType(sessionType)" in dashboard_js
    assert "function startSelectedSessionFlow()" in dashboard_js
    assert 'chooseStartSessionType("editing")' in dashboard_js
    assert 'startSessionFlowType === "editing"' in dashboard_js
    assert (
        'document.getElementById("editing-session-screen").classList.remove("hidden");'
        in js
    )
    assert (
        'document.getElementById("editing-session-screen").classList.add("hidden");'
        in js
    )
    assert "closeEndEditSessionConfirmModal();" in js


def test_focus_mode_can_be_minimized_into_a_shared_floating_timer():
    html = get_html()
    app_js = get_js_asset("app.js")
    dashboard_js = get_js_asset("dashboard.js")
    edit_js = get_js_asset("edit.js")
    css = get_css_asset("dashboard.css")

    assert 'id="leave-writing-focus-mode-btn"' in html
    assert 'id="leave-edit-focus-mode-btn"' in html
    assert html.count(">Minimize<") >= 2
    assert 'id="floating-focus-timer"' in html
    assert 'id="floating-focus-return-btn"' in html
    assert 'id="floating-focus-end-btn"' in html
    assert "Expand" in html
    assert "function getActiveFocusSession()" in app_js
    assert "function syncFloatingFocusTimer()" in app_js
    assert "function bindFloatingFocusTimer()" in app_js
    assert "function leaveWritingFocusMode()" in dashboard_js
    assert "function enterWritingFocusMode()" in dashboard_js
    assert "function leaveEditingFocusMode()" in edit_js
    assert "function enterEditingFocusMode()" in edit_js
    assert "function setWritingSessionMinimized(minimized)" in dashboard_js
    assert "Session already running" in dashboard_js
    assert "Session already running" in app_js
    assert ".floating-focus-timer {" in css
    assert ".floating-focus-timer button {" in css
    assert ".writing-session-actions {" in css
    assert 'id="writing-session-mini"' not in html


def test_write_dashboard_supports_reversible_manuscript_completion():
    html = get_html()
    js = get_js_asset("dashboard.js")
    css = get_css_asset("dashboard.css")

    assert 'id="manuscript-complete-modal"' in html
    assert 'id="manuscript-complete-form"' in html
    assert 'id="manuscript-complete-confirmation"' in html
    assert 'id="confirm-manuscript-complete-btn"' in html
    assert "Type COMPLETE to confirm" in html
    assert "I understand this is reversible" not in html
    assert 'id="open-manuscript-complete-modal-btn"' in js
    assert 'id="reopen-manuscript-btn"' in js
    assert "function openManuscriptCompleteModal(bundle = currentBundle())" in js
    assert "function closeManuscriptCompleteModal()" in js
    assert "function isManuscriptCompletionAvailable(bundle)" in js
    assert "available when word count is met" in js
    assert ".disabled-action-tooltip {" in css
    assert ".manuscript-completion-panel {" in css
    assert "function renderCompletedManuscriptDashboard(bundle, stats)" in js
    assert "function launchManuscriptCompleteConfetti()" in js
    assert "Manuscript complete" in js
    assert "Reopen manuscript" in js


def test_write_dashboard_resume_card_and_handoff_logging():
    html = get_html()
    js = get_js_asset("dashboard.js")
    css = get_css_asset("dashboard.css")
    state_js = get_js_asset("state.js")

    assert 'id="session-modal"' in html
    assert 'id="session-dial"' in html
    assert 'id="resume-view-history-btn"' in js
    assert "function buildResumeCard(snapshot, bundle = currentBundle())" in js
    assert 'id="open-session-modal-btn"' not in js
    assert 'id="log-past-session-btn"' not in js
    assert 'id="resume-session-btn"' not in js
    assert "Resume this section" not in js
    assert "View full history" in js
    assert "You worked on" in js
    assert "What got done" in html
    assert "Next step" in html
    assert 'name="sessionOutcomeStatus"' in html
    assert 'name="sessionAccomplished"' in html
    assert 'name="sessionNextStep"' in html
    assert 'name="sessionBlocker"' in html
    assert 'name="sessionExcerpt"' in html
    assert 'name="structureUnitName"' in html
    assert "function openPastWritingSessionModal()" in js
    assert "let loggingPastWritingSession = false;" in js
    assert 'document.querySelector("#session-modal .session-dial-wrap")' in js
    assert "#session-start-modal" not in js
    assert ".resume-card {" in css
    assert ".session-outcome-control {" in css
    assert ".session-handoff-more {" in css
    assert (
        'const SESSION_SNAPSHOT_TYPES = ["writing", "editing", "planning", "research"];'
        in state_js
    )
    assert (
        "function createSessionSnapshot(snapshot = {}, bundle = currentBundle())"
        in state_js
    )
    assert (
        "function getLatestSnapshot(projectId = state.activeProjectId, projects = state.projects)"
        in state_js
    )
    assert "snapshots: []" in state_js


def test_intermediate_desktop_breakpoint_keeps_hero_sections_single_column():
    css = get_css_asset("layout.css")

    intermediate_breakpoint = css.split("@media (max-width: 1080px) {", 1)[1].split(
        "@media (max-width: 760px) {", 1
    )[0]
    assert ".hero," not in intermediate_breakpoint


def test_export_csv_contract_is_present():
    html = get_html()
    js = get_app_js()

    assert "Export Write" in html
    assert "Export Edit" in html
    assert "Export All" in html
    assert "Import CSV" in html
    assert "Appearance" in html
    assert 'name="themePreference"' in html
    assert 'function bundleToCsv(bundle, mode = "all")' in js
    assert "function importProjectFromCsv(text)" in js
    assert '"row_type"' in js
    assert '"issue_resolved_at"' in js
    assert '"issue_snippet"' in js
    assert '"session_notes"' in js
    assert '"project_manuscript_completed_at"' in js
    assert '"project_manuscript_completion_word_count"' in js
    assert '"project_manuscript_type"' in js
    assert '"project_structure_unit_label"' in js
    assert '"project_status"' in js
    assert '"project_archived_at"' in js
    assert '"project_is_published"' in js
    assert '"project_published_at"' in js
    assert '"project_published_word_count"' in js
    assert '"session_started_at"' in js
    assert '"session_structure_unit_id"' in js
    assert '"session_intended_goal"' in js
    assert '"session_outcome_status"' in js
    assert '"session_accomplished"' in js
    assert '"session_next_step"' in js
    assert '"session_issue_ids"' in js


def test_projects_can_publish_into_a_locked_final_stats_mode():
    html = get_html()
    app_js = get_js_asset("app.js")
    dashboard_js = get_js_asset("dashboard.js")
    state_js = get_js_asset("state.js")
    layout_css = get_css_asset("layout.css")
    dashboard_css = get_css_asset("dashboard.css")

    assert 'id="publish-project-modal"' in html
    assert 'id="publish-project-form"' in html
    assert 'id="publish-project-confirmation"' in html
    assert 'id="reopen-project-modal"' in html
    assert 'id="reopen-project-form"' in html
    assert 'id="reopen-project-confirmation"' in html
    assert 'id="published-celebration-screen"' in html
    assert "Type PUBLISH to confirm" in html
    assert "Type REOPEN to confirm" in html
    assert "function getPublishEligibility(bundle)" in state_js
    assert "function isProjectPublished(bundle)" in state_js
    assert 'id="open-publish-project-btn"' in app_js
    assert "function bindProjectPublicationModals()" in app_js
    assert "function openPublishProjectModal(bundle = currentBundle())" in app_js
    assert (
        "function openReopenProjectModal(projectId = state.activeProjectId)" in app_js
    )
    assert "View final stats" in app_js
    assert 'data-action="reopen-project"' in app_js
    assert "function renderPublishedProjectDashboard(bundle)" in dashboard_js
    assert (
        "function getPublishedProjectSnapshot(bundle, stats = getStats(bundle), editStats = getEditStats(bundle))"
        in dashboard_js
    )
    assert (
        "function downloadPublishedProjectPdf(bundle = currentBundle())" in dashboard_js
    )
    assert "Download final stats PDF" in dashboard_js
    assert ".nav-publish-shell {" in layout_css
    assert ".published-celebration-screen {" in layout_css
    assert ".project-card-status {" in dashboard_css
    assert ".published-summary-grid {" in dashboard_css


def test_settings_modal_replaces_separate_import_export_controls():
    html = get_html()
    js = get_app_js()

    assert 'id="open-settings-modal-btn"' in js
    assert 'id="settings-modal"' in html
    assert 'id="close-settings-modal-btn"' in html
    assert "Manage appearance, import, and export actions for this workspace." in html
    assert "Choose the theme for the full app workspace." in html
    assert 'id="export-write-modal-btn"' in html
    assert 'id="export-edit-modal-btn"' in html
    assert 'id="export-all-modal-btn"' in html
    assert 'id="choose-import-csv-btn"' in html
    assert "More Settings" not in html
    assert "reserved for future settings" not in html
    assert "applyThemePreference()" in js
    assert 'id="open-import-modal-btn"' not in html
    assert 'id="open-export-modal-btn"' not in html
    assert 'id="export-project-csv-btn"' not in html


def test_sidebar_can_collapse_to_icon_only_navigation():
    js = get_app_js()
    css = get_css_asset("layout.css")
    state_js = get_js_asset("state.js")

    assert "function applySidebarCollapseState()" in js
    assert 'id="sidebar-collapse-btn"' in js
    assert "Collapse sidebar" in js
    assert "sidebarCollapsed" in state_js
    assert ".app-shell.sidebar-collapsed {" in css
    assert ".sidebar-collapse-btn {" in css
    assert ".sidebar-action-label {" in css


def test_sidebar_start_session_menu_launches_global_session_flows():
    js = get_app_js()
    css = get_css_asset("layout.css")

    assert 'id="start-session-menu-btn"' in js
    assert 'id="start-session-menu"' not in js
    assert 'data-session-action="write"' not in js
    assert 'data-session-action="edit"' not in js
    assert 'data-session-action="log-previous-writing"' not in js
    assert 'data-session-action="log-previous-editing"' not in js
    assert 'aria-haspopup="menu"' not in js
    assert "Open the writing timer" not in js
    assert "Open the editing timer" not in js
    assert "function bindStartSessionMenu()" in js
    assert "function startSidebarSession(action)" in js
    assert 'startSidebarSession("start")' in js
    assert "openSessionModal();" in js
    assert 'nav.querySelectorAll("button[data-view]")' in js
    assert (
        '<span class="nav-icon nav-session-icon">${getNavIcon("session")}</span>' in js
    )
    assert ".nav-session-shell {" in css
    assert ".nav-session-trigger .nav-session-icon {" in css


def test_goal_type_dropdown_includes_writing_time():
    html = get_html()

    assert (
        '<option value="write_minutes">Spend time writing or editing</option>' in html
    )
    assert (
        '<option value="structure_units_completed">Complete structure units</option>'
        in html
    )
    assert '<option value="issues_resolved">Resolve issues</option>' in html


def test_goal_time_logic_present_for_calendar_and_progress():
    js = get_app_js()

    assert (
        'const GOAL_TYPES = ["write_words", "write_minutes", "structure_units_completed", "issues_resolved"];'
        in js
    )
    assert (
        'if (goalType === "write_minutes") return number(session.durationMinutes);'
        in js
    )
    assert 'if (goal.type === "structure_units_completed")' in js
    assert 'if (goal.type === "issues_resolved")' in js
    assert "chapter.completedAt && dateKey(chapter.completedAt) === key" in js
    assert (
        'issue.status === "Resolved" && issue.resolvedAt && dateKey(issue.resolvedAt) === key'
        in js
    )
    assert (
        "const trackedGoals = bundle.goals.filter((goal) => isGoalTrackedOnDate(goal, cursor));"
        in js
    )
    assert "function goalTargetForDate(goal, dateValue)" in js
    assert "function goalScheduleSummary(goal, bundle = currentBundle())" in js
    assert "function goalWindowSummary(goal)" in js
    assert "function goalProgressText(goal, bundle = currentBundle())" in js


def test_goal_archiving_and_heatmap_day_detail_are_present():
    js = get_app_js()

    assert "function activeGoalsForBundle(bundle)" in js
    assert "function archivedGoalsForBundle(bundle)" in js
    assert 'status: "archived"' in js
    assert "function renderHeatmapDayDetail(day)" in js
    assert 'id="heatmap-detail-panel"' in js
    assert 'data-action="archive-goal"' in js
    assert "Archived Goals" in js
    assert (
        "Past goal targets stay here so old heatmap days keep the context they were earned under."
        in js
    )
    assert "Hover, focus, or tap a day to inspect the goal snapshot behind it." in js
    assert (
        "Hover, focus, or tap a day to compare what you did against the goal that was active then."
        in js
    )


def test_archived_goal_controls_support_restore_and_permanent_delete():
    js = get_app_js()

    assert 'data-action="restore-goal"' in js
    assert 'data-action="delete-goal-permanently"' in js
    assert (
        'showToast("Goal restored", "That goal is active again and will count toward new heatmap days going forward.");'
        in js
    )
    assert (
        "Delete this archived goal permanently? Past heatmap days tied to it will lose that goal context."
        in js
    )
    assert (
        'showToast("Archived goal deleted", "That archived goal was removed permanently.");'
        in js
    )


def test_heatmap_day_detail_marks_active_vs_archived_goal_snapshots():
    js = get_app_js()
    css = get_css_asset("dashboard.css")

    assert 'status: goal.status === "archived" ? "archived" : "active"' in js
    assert "Archived goal" in js
    assert "Active goal" in js
    assert ".heatmap-goal-status.active {" in css
    assert ".heatmap-goal-status.archived {" in css


def test_goal_export_includes_archive_metadata():
    js = get_app_js()

    assert '"chapter_completed_at"' in js
    assert '"goal_status"' in js
    assert '"goal_archived_at"' in js
    assert '"goal_tracking_mode"' in js
    assert '"goal_schedule_mode"' in js
    assert '"goal_monday_target"' in js
    assert '"goal_sunday_target"' in js
    assert 'goal_status: goal.status || "active"' in js
    assert 'goal_archived_at: goal.archivedAt || ""' in js
    assert 'goal_tracking_mode: goal.trackingMode || "ongoing"' in js
    assert 'goal_schedule_mode: goal.scheduleMode || "daily"' in js
    assert 'chapter_completed_at: chapter.completedAt || ""' in js
    assert 'completedAt: row.chapter_completed_at || ""' in js


def test_goal_form_uses_type_presets_for_all_goal_types():
    html = get_html()
    js = get_app_js()

    assert 'id="goal-target-label"' in html
    assert 'id="goal-tracking-mode"' in html
    assert 'id="goal-schedule-mode"' in html
    assert 'id="goal-custom-schedule-fields"' in html
    assert 'id="goal-custom-schedule-title"' in html
    assert 'id="goal-custom-schedule-copy"' in html
    assert 'name="target_monday"' in html
    assert 'name="target_sunday"' in html
    assert "function applyGoalTypePreset(form, goalType)" in js
    assert "function syncGoalFormState(form)" in js
    assert 'targetLabel: "Daily target (minutes)"' in js
    assert 'targetLabel: "Daily target (words)"' in js
    assert "targetLabel: `Daily target (${unitPlural} completed)`" in js
    assert 'targetLabel: "Daily target (issues resolved)"' in js
    assert 'placeholder: "Example: Spend 60 focused minutes today"' in js
    assert 'placeholder: "Example: Write 1,000 words today"' in js
    assert (
        "Weekly time plan: set focused writing or editing minutes for each day." in js
    )


def test_edit_project_submit_returns_to_projects_and_includes_back_button():
    js = get_app_js()

    assert 'id="back-to-projects-btn"' in js
    assert 'id="back-to-projects-from-create-btn"' in js
    assert "const formData = new FormData(form);" in js
    assert (
        'bookTitle: String(formData.get("bookTitle") || "").trim() || projectBundle.project.bookTitle'
        in js
    )
    assert 'activeView = "projects";' in js


def test_project_archive_and_manuscript_type_controls_are_present():
    js = get_app_js()

    assert 'data-action="archive-project"' in js
    assert 'data-action="restore-project"' in js
    assert 'data-action="delete-project-permanently"' in js
    assert "Archived Projects" in js
    assert 'window.confirm(`Permanently delete "' in js
    assert (
        'activeView = state.activeProjectId ? getWorkspaceLandingView(currentBundle()) : "projects";'
        in js
    )
    assert (
        'if (["projects", "create-project"].includes(storedView)) return storedView;'
        in js
    )
    assert 'name="manuscriptType"' in js
    assert 'name="structureUnitChoice"' in js
    assert 'name="customStructureUnitLabel"' in js
    assert (
        'const PROJECT_TYPE_OPTIONS = ["Novel", "Short story", "Screenplay", "Essay", "Other"];'
        in js
    )
    assert 'const STRUCTURE_UNIT_OPTIONS = ["Chapter", "Scene", "Section"];' in js
    assert 'function defaultStructureUnitForProjectType(type = "Novel")' in js
    assert "function getStructureUnitLabel(bundleOrProject = currentBundle())" in js


def test_edit_dashboard_view_and_navigation_are_present():
    html = get_html()
    js = get_app_js()

    assert 'id="view-edit"' in html
    assert 'id="view-edit2"' not in html
    assert 'edit: "Edit"' in js
    assert 'edit2: "Edit 2.0"' not in js
    assert "function renderEditDashboard(bundle)" in js
    assert "function renderEdit2Dashboard(bundle)" in js
    assert "<h3>Hours Edited</h3>" not in js
    assert "<h3>Pass Snapshot</h3>" not in js


def test_edit2_dashboard_view_and_navigation_are_present():
    html = get_html()
    js = get_app_js()
    edit2_js = get_js_asset("edit2.js")

    assert 'id="view-edit"' in html
    assert 'id="view-edit2"' not in html
    assert 'edit: "Edit"' in js
    assert 'edit2: "Edit 2.0"' not in js
    assert "function renderEdit2Dashboard(bundle)" in js
    assert "<h3>Manuscript Structure</h3>" in js
    assert "${escapeHtml(unitLabel)} Issues" in js
    assert 'data-edit2-board-view="chapters"' in js
    assert 'data-edit2-board-view="issues"' in js
    assert 'id="edit2-issue-filters-form"' in js
    assert 'data-edit2-issue-view="current"' in js
    assert 'data-edit2-detail-tab="chapters"' not in js
    assert 'data-edit2-detail-tab="current"' in js
    assert 'data-edit2-detail-tab="resolved"' in js
    assert "Open issues" in js
    assert "Archived Issues" in js
    assert 'editIssueBoardView = "current";' in js
    assert 'edit2ViewMode = "overview";' in js
    assert "A focused workspace for reviewing" not in js
    assert "Keep this brief and structural." not in js
    assert "Review the issues attached" not in js
    assert "Keep active problems visible" not in js
    assert "<h4>Summary</h4>" in js
    assert "<h3>Next Up</h3>" in edit2_js
    assert 'data-edit2-next-focus-action="' in edit2_js
    assert (
        "One clear next move now, with backup options only if you need them."
        in edit2_js
    )
    assert "Next step:" in edit2_js
    assert "Other options (" not in edit2_js
    assert 'data-edit2-carousel data-active-index="0"' in edit2_js
    assert 'data-edit2-carousel-shift="1"' in edit2_js
    assert "function updateEdit2Carousel(carousel, requestedIndex = 0)" in edit2_js
    assert "function getEdit2MomentumBoost(signals)" in edit2_js
    assert "function noteEdit2PrimaryRecommendation(recommendation = null)" in edit2_js
    assert "function clearEdit2NextFocusDisplayState()" in edit2_js
    assert "Developmental pressure" not in edit2_js
    assert "Pass coverage" not in edit2_js
    assert 'id="edit2-quick-issue-form"' not in js
    assert 'id="edit2-chapter-summary-form"' in js
    assert 'data-edit2-delete-chapter="' in js
    assert 'data-edit2-move-chapter="up"' in js
    assert "No structure purpose saved yet." in js


def test_plot_dashboard_view_navigation_and_modal_are_present():
    html = get_html()
    js = get_app_js()

    assert 'id="view-plot"' in html
    assert 'plot: "Story"' in js
    assert 'id="plot-entry-modal"' in html
    assert 'id="plot-entry-form"' in html
    assert "<h3>Story Categories</h3>" in js
    assert 'role="group" aria-label="Story categories"' in js
    assert "Characters" in js
    assert "Locations" in js
    assert "World Rules" in js
    assert 'id="open-plot-tab-modal-btn"' in js
    assert 'aria-label="Add Story tab"' in js
    assert 'id="plot-tab-modal"' in html
    assert 'id="plot-tab-form"' in html
    assert 'id="plot-tab-picker"' in html
    assert 'data-plot-tab-choice="' in js
    assert "function selectedPlotTabIds()" in js
    assert "function addPlotSections(sectionIds)" in js
    assert 'id="remove-active-plot-section-btn"' in js
    assert "function openPlotTabModal()" in js
    assert "function bindPlotTabModal()" in js
    assert "function addPlotSection(sectionId)" in js
    assert "function removePlotSection(sectionId)" in js


def test_story_workspace_tabs_are_customizable_and_preserve_hidden_content():
    state_js = get_js_asset("state.js")
    plot_js = get_js_asset("plot.js")
    css = get_css_asset("plot.css")

    assert "activeSections: [...DEFAULT_PLOT_SECTION_IDS]" in state_js
    assert (
        "sections: Object.fromEntries(PLOT_SECTION_IDS.map((sectionId) => [sectionId, []]))"
        in state_js
    )
    assert "activeSections: normalizedActiveSections" in state_js
    assert "function activePlotSectionIds(bundle)" in plot_js
    assert "function inactivePlotSectionIds(bundle)" in plot_js
    assert "function plotArchivedSectionIds(bundle)" in plot_js
    assert (
        "PLOT_SECTION_IDS.filter((sectionId) => !activeSections.includes(sectionId))"
        in plot_js
    )
    assert "activeSections: nextActiveSections" in plot_js
    assert (
        "nextSections[sectionId] = projectBundle.plot.sections?.[sectionId] || []"
        in plot_js
    )
    assert (
        "This tab was removed from view, but its content stays saved and will return if you add it back."
        in plot_js
    )
    assert "Any saved ${config.singular} entries are still here." in plot_js
    assert "Memoir People" in plot_js
    assert "Magic Systems" in plot_js
    assert "Research" in plot_js
    assert ".plot-add-tab-btn {" in css
    assert ".plot-remove-tab-link {" in css


def test_goals_dashboard_view_and_vertical_navigation_are_present():
    html = get_html()
    js = get_app_js()

    assert 'id="view-goals"' in html
    assert "const navLabels = {" in js
    assert 'plot: "Story"' in js
    assert 'dashboard: isPublishedBundle ? "Final Stats" : "Write"' in js
    assert 'edit: "Edit"' in js
    assert 'edit2: "Edit 2.0"' not in js
    assert 'goals: "Goals"' in js
    assert 'id="view-history-btn"' in js
    assert "<h2>History</h2>" in js
    assert "function renderGoalsDashboard(bundle)" in js
    assert "Structure goals" in js
    assert "Issue goals" in js


def test_edit_dashboard_supports_editing_focus_issues_and_edit_sessions():
    html = get_html()
    js = get_app_js()

    assert 'id="edit-pass-form"' not in html
    assert 'id="edit-session-form"' in html
    assert 'id="issue-form"' in html
    assert 'name="sessionFocusKey"' not in html
    assert 'name="issueFocusKey"' not in html
    assert 'id="issue-note-input"' in html
    assert '<span id="issue-note-label">Jot a quick note (short is fine)</span>' in html
    assert "chapter 3 slow" in html
    assert "dialogue stiff" in html
    assert "motivation unclear" in html
    assert "confusing here" in html
    assert 'name="note"' in html
    assert 'id="issue-snippet-input"' in html
    assert 'name="snippet"' in html
    assert "Paste the exact text (optional, fastest)" in html
    assert "Paste line or paragraph for context" in html
    assert "Capture it quickly. A short note is enough" in html
    assert 'id="issue-title-field"' in html
    assert 'id="issue-section-select"' in html
    assert 'id="edit-session-structure-unit-options"' in html
    assert 'id="edit-session-issue-links-field"' in html
    assert 'name="sessionOutcomeStatus"' in html
    assert 'name="sessionAccomplished"' in html
    assert 'name="sessionNextStep"' in html
    assert "function getEditStats(bundle)" in js
    assert "function getEditIssueSectionOptions(bundle)" in js
    assert (
        'function deriveIssueFieldsFromNote(note = "", bundle = currentBundle())' in js
    )
    assert 'function deriveIssueTitleFromNote(note = "")' in js
    assert (
        'function deriveIssueSectionFromNote(note = "", bundle = currentBundle())' in js
    )
    assert 'function deriveIssueTypeFromNote(note = "")' in js
    assert 'function deriveIssuePriorityFromNote(note = "")' in js
    assert "const ISSUE_SECTION_REGEX = new RegExp" in js
    assert "const ISSUE_SECTION_NUMBER_WORDS = {" in js
    assert "four: 4" in js
    assert 'const ISSUE_HIGH_PRIORITY_KEYWORDS = ["major", "critical", "big"];' in js
    assert "parseIssueSectionNumber(sectionParts[2])" in js
    assert "data-edit-focus-key" not in js
    assert "Editing focus updated" not in js
    assert 'row_type: "issue"' in js
    assert "Resolved issues will collect here once you start closing them out." in js
    assert "getStructureUnitPlural(bundle).toLowerCase()" in js
    assert 'data-edit2-issue-view="current"' in js
    assert 'data-edit2-issue-view="resolved"' in js
    assert "<h3>Issue Breakdown</h3>" not in js
    assert (
        'const issueLabel = issue.status === "Resolved" ? "Resolved issue" : "Open issue";'
        in js
    )
    assert "function getCurrentPassUnresolvedIssueCount(bundle)" not in js
    assert "function compareResolvedEditIssues(a, b)" in js
    assert "Resolve this pass first" not in js
    assert "Clear them before changing passes." not in js
    assert "Capture a problem" not in js
    assert "We will infer the title, type, priority, and" not in js
    assert "Add a note" in js
    assert "notes: rawNote" in js
    assert '<blockquote class="issue-snippet">' in js
    assert '<blockquote class="edit2-issue-snippet">' in js


def test_edit_session_submit_resolves_existing_snapshot_before_using_it():
    js = get_js_asset("edit.js")
    submit_index = js.index("editSessionForm.onsubmit = (event) => {")
    snapshot_index = js.index(
        "const existingSnapshot = isEditingExisting ? getSnapshotForSession(bundle, editingEditSessionId) : null;",
        submit_index,
    )
    focus_index = js.index(
        "const sessionFocusKey = normalizeEditFocusKey(", submit_index
    )

    assert snapshot_index < focus_index
    assert (
        "const snapshotToPreserve = isEditingExisting ? getSnapshotForSession(projectBundle, editingEditSessionId) : null;"
        in js
    )


def test_edit_session_submit_applies_handoff_issue_automation():
    js = get_js_asset("edit.js")
    submit_index = js.index("editSessionForm.onsubmit = (event) => {")
    automation_index = js.index(
        "automationResult = applyEditSessionIssueAutomation(projectBundle.issues, {",
        submit_index,
    )
    snapshot_issue_index = js.index("issueIds: [...linkedIssueIdSet]", submit_index)

    assert (
        "const sessionTimestamp = pendingCompletedEditSession?.endedAt || new Date().toISOString();"
        in js
    )
    assert "const nextIssues = !isEditingExisting" in js
    assert "lastActiveSection: structureUnitName" in js
    assert "selectedIssueIds: issueIds" in js
    assert (
        "if (automationResult?.createdIssue?.id) linkedIssueIdSet.add(automationResult.createdIssue.id);"
        in js
    )
    assert (
        "if (automationResult?.matchedNextIssue?.id) linkedIssueIdSet.add(automationResult.matchedNextIssue.id);"
        in js
    )
    assert (
        "(automationResult?.resolvedIssueIds || []).forEach((issueId) => linkedIssueIdSet.add(issueId));"
        in js
    )
    assert automation_index < snapshot_issue_index
    assert (
        'Created "${createdIssueTitle}" from your next step and saved the session handoff.'
        in js
    )


def test_issue_normalization_and_export_preserve_optional_snippet():
    js = get_js_asset("state.js")

    assert 'snippet: String(issue?.snippet || "")' in js
    assert 'issue_snippet: ""' in js
    assert 'issue_snippet: issue.snippet || ""' in js
    assert 'snippet: row.issue_snippet || ""' in js


def test_session_history_cards_surface_handoff_summary():
    js = get_app_js()

    assert "function renderSessionCard(bundle, session)" in js
    assert "getSnapshotForSession(bundle, session.id)" in js
    assert "getEditFocusLabel(snapshot?.focusKey || session.focusKey" not in js
    assert "<strong>You:</strong>" in js
    assert "<strong>Next:</strong>" in js


def test_edit_dashboard_includes_next_focus_hotspots_and_issue_filters():
    js = get_app_js()
    css = get_css_asset("edit.css")

    assert "<h3>Next Up</h3>" in js
    assert "<h3>Section Hotspots</h3>" not in js
    assert 'id="edit2-issue-filters-form"' in js
    assert 'id="edit2-issue-sort"' in js
    assert 'id="edit2-reset-issue-filters-btn"' in js
    assert (
        "function deriveEditFocusRecommendations(bundle, unresolvedIssues, hotspots, editStats)"
        in js
    )
    assert (
        "function getEditIssueRecommendationSignals(issue, hotspots, editStats)" in js
    )
    assert (
        'function buildEditIssueRecommendation(issue, signals, lens = "urgent", unitLabel = "Section")'
        in js
    )
    assert "Why this surfaced:" not in js
    assert "One clear next move now, with backup options only if you need them." in js
    assert "Other options (" not in js
    assert "data-edit2-carousel-track" in js
    assert "function buildEditSectionHotspots(bundle)" in js
    assert ".next-focus-card {" in css
    assert ".next-focus-carousel {" in css
    assert ".next-focus-track {" in css
    assert ".next-focus-option {" in css
    assert ".next-focus-justification {" in css
    assert ".next-focus-support {" in css
    assert ".issue-filter-form {" in css
    assert ".issue-board-state-toggle {" in css
    assert ".issue-board-state-btn.active {" in css
    assert ".issue-board-archive {" in css
    assert ".issue-breakdown {" not in css


def test_workspace_empty_states_exist_for_no_project_flow():
    js = get_app_js()

    assert 'const DEFAULT_VIEW = "dashboard";' in js
    assert "function renderWorkspaceEmptyState(label)" in js
    assert "Create a project to track your progress" in js
    assert "Create first project" in js


def test_initial_load_and_project_archive_preserves_projects_view():
    js = get_app_js()

    assert (
        "function normalizeStoredActiveView(snapshot, normalizedState = normalizeLoadedState(snapshot))"
        in js
    )
    assert "const hasProjects = normalizedState.projects.length > 0;" in js
    assert "if (!hasProjects) return DEFAULT_VIEW;" in js
    assert (
        'if (["projects", "create-project"].includes(storedView)) return storedView;'
        in js
    )
    assert (
        "return isProjectWorkspaceView(storedView) ? storedView : DEFAULT_VIEW;" in js
    )
    assert (
        'activeView = state.activeProjectId ? getWorkspaceLandingView(currentBundle()) : "projects";'
        in js
    )


def test_last_workspace_tab_is_persisted_separately_from_active_view():
    js = get_app_js()

    assert 'const PRIMARY_WORKSPACE_VIEWS = ["dashboard", "plot", "edit"];' in js
    assert 'const WORKSPACE_VIEWS = ["dashboard", "plot", "edit", "goals"];' in js
    assert 'snapshot?.activeView === "edit2" ? "edit" : snapshot?.activeView' in js
    assert "function loadLastWorkspaceView()" in js
    assert "lastWorkspaceView" in js
    assert "function preferredWorkspaceView()" in js


def test_edit2_uses_persistent_chapter_records_and_exports_them():
    js = get_app_js()

    assert "chapters: []" in js
    assert (
        "function normalizeEditingChapters(chapters = [], issues = [], sessions = [])"
        in js
    )
    assert 'row_type: "chapter"' in js
    assert "chapter_summary" in js
    assert "chapter_sort_order" in js
    assert "chapter_completed_at" in js
    assert "completedAt" in js
    assert 'data-edit2-toggle-chapter-complete="' in js
    assert "function toggleEdit2ChapterComplete(chapterId)" in js
    assert "`Complete ${unitLower}`" in js
    assert "function deleteEdit2Chapter(chapterKey)" in js
    assert "Keep the fallback bucket" in js
    assert "Unassigned" in js


def test_edit_dashboard_session_history_matches_writing_dashboard_today_scope():
    js = get_app_js()

    assert "<p>All editing sessions logged today.</p>" not in js
    assert "<p>All writing sessions logged today.</p>" in js
    assert ".filter((session) => dateKey(session.date) === todayKey)" in js


def test_state_loading_reconnects_active_project_id_to_normalized_projects():
    js = get_app_js()

    assert (
        "const normalizedProjects = snapshot.projects.map(normalizeProjectBundle);"
        in js
    )
    assert (
        "const activeProjects = normalizedProjects.filter((project) => !isProjectArchived(project));"
        in js
    )
    assert (
        "const hasStoredActiveId = activeProjects.some((project) => project.id === snapshot.activeProjectId);"
        in js
    )
    assert "activeProjectId: hasStoredActiveId" in js
    assert "activeProjects[0]?.id || null" in js


def test_state_api_returns_default_state_when_empty(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)

    response = client.get("/api/state")

    assert response.status_code == 200
    assert response.get_json() == {
        "projects": [],
        "activeProjectId": None,
        "activeView": "dashboard",
        "lastWorkspaceView": "dashboard",
        "extensionDocumentBindings": {},
    }


def test_state_api_persists_snapshot_to_sqlite(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    payload = {
        "projects": [
            {
                "id": "project-1",
                "project": {
                    "bookTitle": "The Hollow Orchard",
                    "targetWordCount": 80000,
                    "currentWordCount": 1250,
                    "deadline": "",
                    "dailyTarget": 1000,
                    "projectStartDate": "2026-04-01",
                },
                "editing": {
                    "focusKey": "revision",
                    "passName": "",
                    "passStage": "",
                    "passStatus": "",
                    "passObjective": "",
                    "progressCurrent": 0,
                    "progressTotal": 0,
                },
                "goals": [],
                "sessions": [
                    {
                        "id": "session-1",
                        "type": "write",
                        "date": "2026-04-01T12:00:00.000Z",
                        "durationMinutes": 30,
                        "wordsWritten": 1250,
                        "wordsEdited": 0,
                        "notes": "Strong drafting day",
                        "passName": "",
                        "sectionLabel": "",
                    }
                ],
                "issues": [],
                "milestones": [],
            }
        ],
        "activeProjectId": "project-1",
        "activeView": "dashboard",
        "lastWorkspaceView": "dashboard",
        "extensionDocumentBindings": {},
    }

    put_response = client.put("/api/state", json=payload)
    get_response = client.get("/api/state")

    assert put_response.status_code == 200
    assert put_response.get_json() == payload
    assert get_response.status_code == 200
    assert get_response.get_json() == payload


def test_state_api_requires_login(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()

    response = client.get("/api/state")

    assert response.status_code == 401
    assert response.get_json() == {"error": "Authentication required"}


def test_extension_api_allows_google_docs_origin(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()

    response = client.get(
        "/api/projects",
        headers={"Origin": "https://docs.google.com"},
    )
    preflight = client.options(
        "/api/extension/sessions",
        headers={
            "Origin": "https://docs.google.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )

    assert response.status_code == 401
    assert response.headers["Access-Control-Allow-Origin"] == "https://docs.google.com"
    assert response.headers["Access-Control-Allow-Credentials"] == "true"
    assert preflight.status_code == 200
    assert preflight.headers["Access-Control-Allow-Origin"] == "https://docs.google.com"


def extension_project(project_id, title, pass_name="Revision"):
    return {
        "id": project_id,
        "status": "active",
        "project": {
            "bookTitle": title,
            "manuscriptType": "Novel",
            "targetWordCount": 80000,
            "currentWordCount": 0,
            "deadline": "",
            "dailyTarget": 1000,
            "projectStartDate": "2026-04-01",
        },
        "editing": {
            "focusKey": "revision",
            "passName": pass_name,
            "passStage": "",
            "passStatus": "",
            "passObjective": "",
            "progressCurrent": 0,
            "progressTotal": 0,
        },
        "goals": [],
        "sessions": [],
        "issues": [],
        "milestones": [],
    }


def save_extension_test_state(client):
    payload = {
        "projects": [
            extension_project("project-a", "Project A", pass_name="Line edit"),
            extension_project("project-b", "Project B", pass_name="Proofread"),
        ],
        "activeProjectId": "project-b",
        "activeView": "dashboard",
        "lastWorkspaceView": "dashboard",
        "extensionDocumentBindings": {},
    }
    response = client.put("/api/state", json=payload)
    assert response.status_code == 200
    return payload


def extension_session_payload(**overrides):
    payload = {
        "documentId": "google-doc-a",
        "projectId": "project-a",
        "extensionSessionId": "extension-session-1",
        "sessionType": "writing",
        "startedAt": "2026-05-04T12:00:00.000Z",
        "endedAt": "2026-05-04T12:42:00.000Z",
        "durationMinutes": 42,
        "wordsWritten": 0,
        "wordsEdited": 0,
        "source": "chrome-extension",
        "documentUrl": "https://docs.google.com/document/d/google-doc-a/edit",
        "notes": "",
    }
    payload.update(overrides)
    return payload


def test_extension_session_for_project_a_does_not_affect_project_b(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    save_extension_test_state(client)

    response = client.post(
        "/api/extension/sessions",
        json=extension_session_payload(),
    )
    state_response = client.get("/api/state")
    projects = {
        project["id"]: project for project in state_response.get_json()["projects"]
    }

    assert response.status_code == 201
    assert len(projects["project-a"]["sessions"]) == 1
    assert projects["project-a"]["sessions"][0]["id"] == "extension-session-1"
    assert projects["project-b"]["sessions"] == []


def test_extension_session_does_not_use_active_project_id(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    save_extension_test_state(client)

    response = client.post(
        "/api/extension/sessions",
        json=extension_session_payload(projectId="project-a"),
    )
    state = client.get("/api/state").get_json()
    project_a = next(
        project for project in state["projects"] if project["id"] == "project-a"
    )
    project_b = next(
        project
        for project in state["projects"]
        if project["id"] == state["activeProjectId"]
    )

    assert response.status_code == 201
    assert state["activeProjectId"] == "project-b"
    assert len(project_a["sessions"]) == 1
    assert project_b["sessions"] == []


def test_extension_session_invalid_project_id_returns_404(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    save_extension_test_state(client)

    response = client.post(
        "/api/extension/sessions",
        json=extension_session_payload(projectId="missing-project"),
    )

    assert response.status_code == 404
    assert response.get_json() == {"error": "Project not found."}


def test_extension_duplicate_session_id_does_not_create_duplicate(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    save_extension_test_state(client)
    payload = extension_session_payload(wordsWritten=148)

    first_response = client.post("/api/extension/sessions", json=payload)
    duplicate_response = client.post("/api/extension/sessions", json=payload)
    state = client.get("/api/state").get_json()
    project_a = next(
        project for project in state["projects"] if project["id"] == "project-a"
    )

    assert first_response.status_code == 201
    assert duplicate_response.status_code == 200
    assert duplicate_response.get_json()["duplicate"] is True
    assert len(project_a["sessions"]) == 1
    assert project_a["sessions"][0]["wordsWritten"] == 148
    assert project_a["project"]["currentWordCount"] == 148


def test_extension_duplicate_session_id_can_repair_empty_word_count(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    save_extension_test_state(client)

    first_response = client.post(
        "/api/extension/sessions",
        json=extension_session_payload(wordsWritten=0),
    )
    repair_response = client.post(
        "/api/extension/sessions",
        json=extension_session_payload(wordsWritten=148),
    )
    state = client.get("/api/state").get_json()
    project_a = next(
        project for project in state["projects"] if project["id"] == "project-a"
    )

    assert first_response.status_code == 201
    assert repair_response.status_code == 200
    assert repair_response.get_json()["duplicate"] is True
    assert len(project_a["sessions"]) == 1
    assert project_a["sessions"][0]["wordsWritten"] == 148
    assert project_a["project"]["currentWordCount"] == 148


def test_extension_writing_session_normalizes_to_write_with_words_written(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    save_extension_test_state(client)

    response = client.post(
        "/api/extension/sessions",
        json=extension_session_payload(sessionType="writing", wordsWritten=148),
    )
    session = response.get_json()["session"]
    state = client.get("/api/state").get_json()
    project_a = next(
        project for project in state["projects"] if project["id"] == "project-a"
    )

    assert response.status_code == 201
    assert session["type"] == "write"
    assert session["wordsWritten"] == 148
    assert session["wordsEdited"] == 0
    assert project_a["project"]["currentWordCount"] == 148


def test_extension_writing_session_invalid_words_written_normalizes_to_zero(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    save_extension_test_state(client)

    response = client.post(
        "/api/extension/sessions",
        json=extension_session_payload(wordsWritten=-12),
    )
    session = response.get_json()["session"]
    state = client.get("/api/state").get_json()
    project_a = next(
        project for project in state["projects"] if project["id"] == "project-a"
    )

    assert response.status_code == 201
    assert session["wordsWritten"] == 0
    assert project_a["project"]["currentWordCount"] == 0


def test_extension_writing_session_non_numeric_words_written_normalizes_to_zero(
    tmp_path,
):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    save_extension_test_state(client)

    response = client.post(
        "/api/extension/sessions",
        json=extension_session_payload(
            extensionSessionId="extension-session-invalid-words",
            wordsWritten="not-a-number",
        ),
    )
    session = response.get_json()["session"]

    assert response.status_code == 201
    assert session["wordsWritten"] == 0


def test_extension_editing_session_normalizes_to_edit_with_current_pass(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    save_extension_test_state(client)

    response = client.post(
        "/api/extension/sessions",
        json=extension_session_payload(
            sessionType="editing",
            extensionSessionId="extension-session-edit",
            wordsWritten=148,
            wordsEdited=312,
        ),
    )
    session = response.get_json()["session"]

    assert response.status_code == 201
    assert session["type"] == "edit"
    assert session["wordsWritten"] == 0
    assert session["wordsEdited"] == 312
    assert session["passName"] == "Line edit"
    assert session["sectionLabel"] == ""


def test_extension_document_binding_returns_same_project_after_save(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    save_extension_test_state(client)

    put_response = client.put(
        "/api/extension/document-binding",
        json={"documentId": "google-doc-a", "projectId": "project-a"},
    )
    get_response = client.get("/api/extension/document-binding?documentId=google-doc-a")

    assert put_response.status_code == 200
    assert get_response.status_code == 200
    assert get_response.get_json()["project"] == {
        "id": "project-a",
        "bookTitle": "Project A",
        "manuscriptType": "Novel",
        "status": "active",
    }


def test_state_api_preserves_extension_bindings_when_payload_omits_them(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    save_extension_test_state(client)
    binding_response = client.put(
        "/api/extension/document-binding",
        json={"documentId": "google-doc-a", "projectId": "project-a"},
    )
    assert binding_response.status_code == 200

    response = client.put(
        "/api/state",
        json={
            "projects": [extension_project("project-a", "Project A")],
            "activeProjectId": "project-a",
            "activeView": "dashboard",
            "lastWorkspaceView": "dashboard",
        },
    )
    state = client.get("/api/state").get_json()

    assert response.status_code == 200
    assert state["extensionDocumentBindings"] == {"google-doc-a": "project-a"}


def test_state_api_preserves_extension_sessions_from_stale_app_save(tmp_path):
    use_temp_state_db(tmp_path)
    client = app.test_client()
    register_and_login(client)
    save_extension_test_state(client)
    sync_response = client.post(
        "/api/extension/sessions",
        json=extension_session_payload(wordsWritten=148),
    )
    assert sync_response.status_code == 201

    stale_payload = {
        "projects": [
            extension_project("project-a", "Project A"),
            extension_project("project-b", "Project B"),
        ],
        "activeProjectId": "project-a",
        "activeView": "dashboard",
        "lastWorkspaceView": "dashboard",
    }
    save_response = client.put("/api/state", json=stale_payload)
    state = client.get("/api/state").get_json()
    project_a = next(
        project for project in state["projects"] if project["id"] == "project-a"
    )

    assert save_response.status_code == 200
    assert len(project_a["sessions"]) == 1
    assert project_a["sessions"][0]["extensionSessionId"] == "extension-session-1"
    assert project_a["sessions"][0]["wordsWritten"] == 148
    assert project_a["project"]["currentWordCount"] == 148


def test_state_is_isolated_per_signed_in_user(tmp_path):
    use_temp_state_db(tmp_path)

    with app.app_context():
        primary_user = create_user("writer@example.com", "verysecure")
        secondary_user = create_user("editor@example.com", "verysecure")

    primary_client = app.test_client()
    secondary_client = app.test_client()

    with primary_client.session_transaction() as session_state:
        session_state["user_id"] = primary_user["id"]

    payload = {
        "projects": [{"id": "project-1", "project": {"bookTitle": "Private Draft"}}],
        "activeProjectId": "project-1",
        "activeView": "dashboard",
        "lastWorkspaceView": "dashboard",
    }

    put_response = primary_client.put("/api/state", json=payload)

    with secondary_client.session_transaction() as session_state:
        session_state["user_id"] = secondary_user["id"]

    get_response = secondary_client.get("/api/state")

    assert put_response.status_code == 200
    assert get_response.status_code == 200
    assert get_response.get_json() == {
        "projects": [],
        "activeProjectId": None,
        "activeView": "dashboard",
        "lastWorkspaceView": "dashboard",
        "extensionDocumentBindings": {},
    }


def test_pages_artifact_matches_flask_template():
    template_file = REPO_ROOT / "writing_app" / "templates" / "index.html"
    pages_file = REPO_ROOT / "docs" / "index.html"

    assert pages_file.read_text(encoding="utf-8") == template_file.read_text(
        encoding="utf-8"
    )
    for filename in ["app.css", *CSS_FILES]:
        template_css_file = REPO_ROOT / "writing_app" / "static" / "css" / filename
        pages_css_file = REPO_ROOT / "docs" / "static" / "css" / filename
        assert pages_css_file.read_text(
            encoding="utf-8"
        ) == template_css_file.read_text(encoding="utf-8")
    for filename in JS_FILES:
        template_js_file = REPO_ROOT / "writing_app" / "static" / "js" / filename
        pages_js_file = REPO_ROOT / "docs" / "static" / "js" / filename
        assert pages_js_file.read_text(encoding="utf-8") == template_js_file.read_text(
            encoding="utf-8"
        )
