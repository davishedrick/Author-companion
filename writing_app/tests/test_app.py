from pathlib import Path

from app import app
from auth_store import create_user


REPO_ROOT = Path(__file__).resolve().parents[2]
JS_FILES = [
    "state.js",
    "dashboard.js",
    "edit.js",
    "app.js",
]
CSS_FILES = [
    "base.css",
    "layout.css",
    "dashboard.css",
    "edit.css",
]


def get_html():
    return (
        REPO_ROOT / "writing_app" / "templates" / "index.html"
    ).read_text(encoding="utf-8")


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
    assert "Everything stays editable." in response.get_data(as_text=True)


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
    assert ".writing-launch {" in get_css_asset("dashboard.css")
    assert ".edit-columns {" in get_css_asset("edit.css")
    assert 'const STORAGE_KEY = "author-engine-mvp";' in get_js_asset("state.js")
    assert 'const STATE_API_ENDPOINT = "/api/state";' in get_js_asset("state.js")
    assert "fetchRemoteState()" in get_js_asset("app.js")
    assert "function renderDashboard(bundle)" in get_js_asset("dashboard.js")
    assert "function renderEditDashboard(bundle)" in get_js_asset("edit.js")
    assert "function renderProjects()" in get_js_asset("app.js")


def test_export_csv_contract_is_present():
    html = get_html()
    js = get_app_js()

    assert "Export Write" in html
    assert "Export Edit" in html
    assert "Export All" in html
    assert "Import CSV" in html
    assert 'function bundleToCsv(bundle, mode = "all")' in js
    assert "function importProjectFromCsv(text)" in js
    assert '"row_type"' in js
    assert '"session_notes"' in js


def test_settings_modal_replaces_separate_import_export_controls():
    html = get_html()
    js = get_app_js()

    assert 'id="open-settings-modal-btn"' in js
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
    html = get_html()

    assert '<option value="write_minutes">Spend time writing</option>' in html


def test_goal_time_logic_present_for_calendar_and_progress():
    js = get_app_js()

    assert 'goalType === "write_minutes" ? "minutes" : "words"' in js
    assert '(goal.type === "write_words" || goal.type === "write_minutes")' in js


def test_goal_form_uses_type_presets_for_minutes_and_words():
    html = get_html()
    js = get_app_js()

    assert 'id="goal-target-label"' in html
    assert "function applyGoalTypePreset(form, goalType)" in js
    assert 'targetLabel.textContent = "Daily target (minutes)";' in js
    assert 'targetLabel.textContent = "Daily target (words)";' in js
    assert 'titleInput.placeholder = "Example: Spend 30 minutes writing today"' in js
    assert 'titleInput.placeholder = "Example: Write 1,000 words today"' in js


def test_edit_project_submit_returns_to_projects_and_includes_back_button():
    js = get_app_js()

    assert 'id="back-to-projects-btn"' in js
    assert "const formData = new FormData(form);" in js
    assert (
        'bookTitle: String(formData.get("bookTitle") || "").trim() || projectBundle.project.bookTitle'
        in js
    )
    assert 'activeView = "projects";' in js


def test_edit_dashboard_view_and_navigation_are_present():
    html = get_html()
    js = get_app_js()

    assert 'id="view-edit"' in html
    assert 'edit: "Edit"' in js
    assert "function renderEditDashboard(bundle)" in js
    assert "<h3>Hours Edited</h3>" in js


def test_edit_dashboard_supports_passes_issues_and_edit_sessions():
    html = get_html()
    js = get_app_js()

    assert 'id="edit-pass-form"' in html
    assert 'id="edit-session-form"' in html
    assert 'id="issue-form"' in html
    assert "function getEditStats(bundle)" in js
    assert 'row_type: "issue"' in js

def test_workspace_empty_states_exist_for_no_project_flow():
    js = get_app_js()

    assert 'const DEFAULT_VIEW = "dashboard";' in js
    assert 'function renderWorkspaceEmptyState(label)' in js
    assert "Create a project to track your progress" in js
    assert 'Create first project' in js


def test_initial_load_and_project_deletion_fall_back_to_dashboard_workspace():
    js = get_app_js()

    assert "function normalizeStoredActiveView(snapshot, normalizedState = normalizeLoadedState(snapshot))" in js
    assert "const hasProjects = normalizedState.projects.length > 0;" in js
    assert "if (!hasProjects) return DEFAULT_VIEW;" in js
    assert "return isProjectWorkspaceView(storedView) ? storedView : DEFAULT_VIEW;" in js
    assert 'activeView = state.activeProjectId ? preferredWorkspaceView() : DEFAULT_VIEW;' in js


def test_last_workspace_tab_is_persisted_separately_from_active_view():
    js = get_app_js()

    assert 'const WORKSPACE_VIEWS = ["dashboard", "edit", "stats"];' in js
    assert "function loadLastWorkspaceView()" in js
    assert "lastWorkspaceView" in js
    assert "function preferredWorkspaceView()" in js


def test_edit_dashboard_session_history_matches_writing_dashboard_today_scope():
    js = get_app_js()

    assert "<h3>Session History</h3>" in js
    assert "<p>All editing sessions logged today.</p>" in js
    assert ".filter((session) => dateKey(session.date) === todayKey)" in js


def test_state_loading_reconnects_active_project_id_to_normalized_projects():
    js = get_app_js()

    assert (
        "const normalizedProjects = snapshot.projects.map(normalizeProjectBundle);"
        in js
    )
    assert (
        "const hasStoredActiveId = normalizedProjects.some((project) => project.id === snapshot.activeProjectId);"
        in js
    )
    assert "activeProjectId: hasStoredActiveId" in js
    assert "normalizedProjects[0]?.id || null" in js


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
                    "passName": "Developmental Edit",
                    "passStage": "Developmental",
                    "passStatus": "Not started",
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
        assert pages_css_file.read_text(encoding="utf-8") == template_css_file.read_text(
            encoding="utf-8"
        )
    for filename in JS_FILES:
        template_js_file = REPO_ROOT / "writing_app" / "static" / "js" / filename
        pages_js_file = REPO_ROOT / "docs" / "static" / "js" / filename
        assert pages_js_file.read_text(encoding="utf-8") == template_js_file.read_text(
            encoding="utf-8"
        )
