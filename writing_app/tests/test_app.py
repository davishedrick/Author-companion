from app import app


def test_home_page_loads():
    client = app.test_client()
    response = client.get("/")
    assert response.status_code == 200


def test_export_csv_contract_is_present():
    client = app.test_client()
    response = client.get("/")
    html = response.get_data(as_text=True)

    assert "Export CSV" in html
    assert "Import CSV" in html
    assert "function bundleToCsv(bundle)" in html
    assert "function importProjectFromCsv(text)" in html
    assert '"row_type"' in html
    assert '"session_notes"' in html


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
    assert 'const formData = new FormData(form);' in html
    assert 'bookTitle: String(formData.get("bookTitle") || "").trim() || projectBundle.project.bookTitle' in html
    assert 'activeView = "projects";' in html


def test_edit_dashboard_view_and_navigation_are_present():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert 'id="view-edit"' in html
    assert 'edit: "Edit"' in html
    assert 'function renderEditDashboard(bundle)' in html
    assert "<h3>Hours Edited</h3>" in html


def test_edit_dashboard_supports_passes_issues_and_edit_sessions():
    client = app.test_client()
    response = client.get("/")
    html = response.data.decode()

    assert 'id="edit-pass-form"' in html
    assert 'id="edit-session-form"' in html
    assert 'id="issue-form"' in html
    assert 'function getEditStats(bundle)' in html
    assert 'row_type: "issue"' in html
