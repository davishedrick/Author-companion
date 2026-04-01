from pathlib import Path

from app import app


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_home_page_loads():
    client = app.test_client()
    response = client.get("/")
    assert response.status_code == 200


def test_export_csv_contract_is_present():
    client = app.test_client()
    response = client.get("/")
    html = response.get_data(as_text=True)

    assert "Export Write" in html
    assert "Export Edit" in html
    assert "Export All" in html
    assert "Import CSV" in html
    assert 'function bundleToCsv(bundle, mode = "all")' in html
    assert "function importProjectFromCsv(text)" in html
    assert '"row_type"' in html
    assert '"session_notes"' in html


def test_settings_modal_replaces_separate_import_export_controls():
    client = app.test_client()
    response = client.get("/")
    html = response.get_data(as_text=True)

    assert 'id="open-settings-modal-btn"' in html
    assert 'id="settings-modal"' in html
    assert 'id="close-settings-modal-btn"' in html
    assert "Manage data actions now, with room to add more project settings later." in html
    assert 'id="export-write-modal-btn"' in html
    assert 'id="export-edit-modal-btn"' in html
    assert 'id="export-all-modal-btn"' in html
    assert 'id="choose-import-csv-btn"' in html
    assert "More Settings" in html
    assert 'id="open-import-modal-btn"' not in html
    assert 'id="open-export-modal-btn"' not in html
    assert 'id="export-project-csv-btn"' not in html


def test_goal_type_dropdown_includes_writing_time():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert '<option value="write_minutes">Spend time writing</option>' in html


def test_goal_time_logic_present_for_calendar_and_progress():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert 'goalType === "write_minutes" ? "minutes" : "words"' in html
    assert '(goal.type === "write_words" || goal.type === "write_minutes")' in html


def test_goal_form_uses_type_presets_for_minutes_and_words():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert 'id="goal-target-label"' in html
    assert "function applyGoalTypePreset(form, goalType)" in html
    assert 'targetLabel.textContent = "Daily target (minutes)";' in html
    assert 'targetLabel.textContent = "Daily target (words)";' in html
    assert 'titleInput.placeholder = "Example: Spend 30 minutes writing today"' in html
    assert 'titleInput.placeholder = "Example: Write 1,000 words today"' in html


def test_edit_project_submit_returns_to_projects_and_includes_back_button():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert 'id="back-to-projects-btn"' in html
    assert "const formData = new FormData(form);" in html
    assert (
        'bookTitle: String(formData.get("bookTitle") || "").trim() || projectBundle.project.bookTitle'
        in html
    )
    assert 'activeView = "projects";' in html


def test_edit_dashboard_view_and_navigation_are_present():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert 'id="view-edit"' in html
    assert 'edit: "Edit"' in html
    assert "function renderEditDashboard(bundle)" in html
    assert "<h3>Hours Edited</h3>" in html


def test_edit_dashboard_supports_passes_issues_and_edit_sessions():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert 'id="edit-pass-form"' in html
    assert 'id="edit-session-form"' in html
    assert 'id="issue-form"' in html
    assert "function getEditStats(bundle)" in html
    assert 'row_type: "issue"' in html

def test_workspace_empty_states_exist_for_no_project_flow():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert 'const DEFAULT_VIEW = "dashboard";' in html
    assert 'function renderWorkspaceEmptyState(label)' in html
    assert "Create a project to track your progress" in html
    assert 'Create first project' in html


def test_initial_load_and_project_deletion_fall_back_to_dashboard_workspace():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert "const hasProjects = Array.isArray(stored?.projects)" in html
    assert "if (!hasProjects) return DEFAULT_VIEW;" in html
    assert "return isProjectWorkspaceView(storedView) ? storedView : DEFAULT_VIEW;" in html
    assert 'activeView = state.activeProjectId ? preferredWorkspaceView() : DEFAULT_VIEW;' in html


def test_last_workspace_tab_is_persisted_separately_from_active_view():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert 'const WORKSPACE_VIEWS = ["dashboard", "edit", "stats"];' in html
    assert "function loadLastWorkspaceView()" in html
    assert "lastWorkspaceView" in html
    assert "function preferredWorkspaceView()" in html


def test_edit_dashboard_session_history_matches_writing_dashboard_today_scope():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert "<h3>Session History</h3>" in html
    assert "<p>All editing sessions logged today.</p>" in html
    assert ".filter((session) => dateKey(session.date) === todayKey)" in html


def test_state_loading_reconnects_active_project_id_to_normalized_projects():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert (
        "const normalizedProjects = stored.projects.map(normalizeProjectBundle);"
        in html
    )
    assert (
        "const hasStoredActiveId = normalizedProjects.some((project) => project.id === stored.activeProjectId);"
        in html
    )
    assert "activeProjectId: hasStoredActiveId" in html
    assert "normalizedProjects[0]?.id || null" in html


def test_pages_artifact_matches_flask_template():
    template_file = REPO_ROOT / "writing_app" / "templates" / "index.html"
    pages_file = REPO_ROOT / "docs" / "index.html"

    assert pages_file.read_text(encoding="utf-8") == template_file.read_text(
        encoding="utf-8"
    )
