from __future__ import annotations

from pathlib import Path

from app import app

from backend_contract_helpers import (
    assert_net_session,
    bind_surface,
    client_for,
    create_second_user,
    extension_session_payload,
    get_project,
    get_state,
    login_client,
    post_extension_session,
    post_issue,
    project_bundle,
    seed_state,
    surface,
)


def test_project_creation_validates_fields_and_persists_after_reload(tmp_path):
    client = client_for(tmp_path)

    missing_title = client.post(
        "/api/extension/projects",
        json={"title": "", "targetWordCount": 50000},
    )
    invalid_target = client.post(
        "/api/extension/projects",
        json={"title": "Bad target", "targetWordCount": "nope"},
    )
    negative_words = client.post(
        "/api/extension/projects",
        json={"title": "Bad current", "wordsWrittenSoFar": -10},
    )
    created = client.post(
        "/api/extension/projects",
        json={
            "title": "Backend Contract Novel",
            "manuscriptType": "Novel",
            "structureUnit": "Scene",
            "targetWordCount": 90000,
            "wordsWrittenSoFar": 1200,
            "deadline": "2026-12-31",
        },
    )

    assert missing_title.status_code == 400
    assert invalid_target.status_code == 400
    assert negative_words.status_code == 400
    assert created.status_code == 201

    project_id = created.get_json()["project"]["id"]
    reloaded_client = app.test_client()
    reloaded_client.set_cookie(
        "session",
        client.get_cookie("session").value,
        domain="localhost",
    )
    projects_response = reloaded_client.get("/api/extension/projects")
    row = next(
        item
        for item in projects_response.get_json()["projects"]
        if item["project"]["id"] == project_id
    )

    assert row["project"]["bookTitle"] == "Backend Contract Novel"
    assert row["project"]["currentWordCount"] == 1200
    assert row["project"]["startingWordCount"] is None
    assert row["project"]["baselineEstablished"] is False
    assert row["isBound"] is False


def test_first_document_binding_establishes_verified_manuscript_baseline(tmp_path):
    client = client_for(tmp_path)
    seed_state(
        client,
        projects=[project_bundle("project-a", "Project A", current_word_count=10000)],
    )

    bind_surface(
        client, verifiedWordCount=10305, verifiedWordCountSource="stable-visible"
    )
    project = get_project(client)

    assert project["project"]["startingWordCount"] == 10305
    assert project["project"]["currentWordCount"] == 10305
    assert project["project"]["baselineEstablished"] is True
    assert project["project"]["startingWordCountSource"] == "stable-visible"
    assert project["sessions"] == []


def test_initial_zero_delta_extension_session_does_not_become_activity(tmp_path):
    client = client_for(tmp_path)
    seed_state(
        client,
        projects=[project_bundle("project-a", "Project A", current_word_count=0)],
    )
    bind_surface(client, verifiedWordCount=320, verifiedWordCountSource="stable-visible")

    response = post_extension_session(
        client,
        extensionSessionId="baseline-confirmation-session",
        durationMinutes=1,
        wordsWritten=0,
        startDocumentWordCount=320,
        endDocumentWordCount=320,
        netWordsChanged=0,
        wordCountMethod="stable-visible",
    )
    project = get_project(client)

    assert response.status_code == 200
    assert response.get_json()["duplicate"] is True
    assert response.get_json()["session"]["netWordsChanged"] == 0
    assert project["project"]["currentWordCount"] == 320
    assert project["project"]["startingWordCount"] == 320
    assert project["sessions"] == []


def test_rebinding_preserves_starting_word_count_but_updates_current_count(tmp_path):
    client = client_for(tmp_path)
    seed_state(client)

    bind_surface(client, verifiedWordCount=10305)
    bind_surface(client, verifiedWordCount=22000)
    project = get_project(client)

    assert project["project"]["startingWordCount"] == 10305
    assert project["project"]["currentWordCount"] == 22000


def test_verified_bind_does_not_overwrite_baseline_when_sessions_exist(tmp_path):
    client = client_for(tmp_path)
    seeded_project = project_bundle("project-a", "Project A", current_word_count=10000)
    seeded_project["sessions"] = [
        {
            "id": "session-1",
            "type": "write",
            "startDocumentWordCount": 8000,
            "endDocumentWordCount": 10000,
            "netWordsChanged": 2000,
            "wordsWritten": 2000,
        }
    ]
    seed_state(client, projects=[seeded_project])

    bind_surface(client, verifiedWordCount=10305)
    project = get_project(client)

    assert project["project"]["startingWordCount"] == 8000
    assert project["project"]["currentWordCount"] == 10305
    assert project["project"]["baselineEstablished"] is True
    assert (
        project["project"]["startingWordCountSource"]
        == "migration_estimated_from_sessions"
    )
    assert len(project["sessions"]) == 1


def test_bound_project_without_sessions_migrates_starting_count_to_current_count(
    tmp_path,
):
    client = client_for(tmp_path)
    seed_state(
        client,
        projects=[project_bundle("project-a", "Project A", current_word_count=15000)],
        bindings={"google-doc-a:tab-a": {"projectId": "project-a"}},
    )

    project = get_project(client)

    assert project["project"]["startingWordCount"] == 15000
    assert project["project"]["baselineEstablished"] is True
    assert (
        project["project"]["startingWordCountSource"] == "migration_bound_no_sessions"
    )


def test_bound_project_with_sessions_migrates_starting_count_from_tracked_delta(
    tmp_path,
):
    client = client_for(tmp_path)
    seeded_project = project_bundle("project-a", "Project A", current_word_count=12000)
    seeded_project["sessions"] = [
        {
            "id": "session-1",
            "type": "write",
            "startDocumentWordCount": 10305,
            "endDocumentWordCount": 11000,
            "netWordsChanged": 695,
            "wordsWritten": 695,
        },
        {
            "id": "session-2",
            "type": "write",
            "startDocumentWordCount": 11000,
            "endDocumentWordCount": 12000,
            "netWordsChanged": 1000,
            "wordsWritten": 1000,
        },
    ]
    seed_state(
        client,
        projects=[seeded_project],
        bindings={"google-doc-a:tab-a": {"projectId": "project-a"}},
    )

    project = get_project(client)

    assert project["project"]["startingWordCount"] == 10305
    assert project["project"]["baselineEstablished"] is True
    assert (
        project["project"]["startingWordCountSource"]
        == "migration_estimated_from_sessions"
    )


def test_extension_session_ingests_canonical_net_cases(tmp_path):
    client = client_for(tmp_path)
    seed_state(client)
    bind_surface(client)

    cases = [
        ("positive", "writing", 1000, 1200, 200, "write"),
        ("negative", "editing", 1000, 800, -200, "edit"),
        ("zero", "writing", 1000, 1000, 0, "write"),
        ("zero-doc", "writing", 0, 0, 0, "write"),
        ("full-delete", "editing", 2300, 0, -2300, "edit"),
    ]
    for label, session_type, start, end, net, normalized_type in cases:
        response = post_extension_session(
            client,
            extensionSessionId=f"session-{label}",
            sessionType=session_type,
            startDocumentWordCount=start,
            endDocumentWordCount=end,
            netWordsChanged=net,
        )
        assert response.status_code == 201
        assert_net_session(
            response.get_json()["session"],
            start=start,
            end=end,
            net=net,
            session_type=normalized_type,
        )


def test_extension_session_derives_and_normalizes_net_from_document_counts(tmp_path):
    client = client_for(tmp_path)
    seed_state(client)
    bind_surface(client)

    without_net = post_extension_session(
        client,
        extensionSessionId="session-without-net",
        startDocumentWordCount=1000,
        endDocumentWordCount=1200,
    )
    mismatched_net = post_extension_session(
        client,
        extensionSessionId="session-mismatched-net",
        startDocumentWordCount=1000,
        endDocumentWordCount=1200,
        netWordsChanged=999,
    )

    assert without_net.status_code == 201
    assert without_net.get_json()["session"]["netWordsChanged"] == 200
    assert mismatched_net.status_code == 201
    assert mismatched_net.get_json()["session"]["netWordsChanged"] == 200


def test_extension_session_rejects_malformed_canonical_counts_and_unbound_tabs(
    tmp_path,
):
    client = client_for(tmp_path)
    seed_state(client)

    unbound = post_extension_session(client)
    bind_surface(client)
    missing_end_payload = extension_session_payload(
        extensionSessionId="session-missing-end",
        startDocumentWordCount=100,
    )
    missing_end_payload.pop("endDocumentWordCount")
    missing_end = client.post("/api/extension/sessions", json=missing_end_payload)
    nonnumeric = post_extension_session(
        client,
        extensionSessionId="session-nonnumeric-count",
        startDocumentWordCount="many",
        endDocumentWordCount=120,
    )

    assert unbound.status_code == 409
    assert "not bound" in unbound.get_json()["error"]
    assert missing_end.status_code == 400
    assert "required together" in missing_end.get_json()["error"]
    assert nonnumeric.status_code == 400
    assert "startDocumentWordCount" in nonnumeric.get_json()["error"]


def test_tab_specific_binding_sessions_and_issues_do_not_leak(tmp_path):
    client = client_for(tmp_path)
    seed_state(client)
    tab_a = bind_surface(client, project_id="project-a", tab_id="tab-a")
    tab_b = bind_surface(
        client,
        project_id="project-b",
        tab_id="tab-b",
        tab_title="Draft V2",
    )

    session_a = post_extension_session(
        client,
        **tab_a,
        extensionSessionId="session-tab-a",
        startDocumentWordCount=100,
        endDocumentWordCount=150,
        netWordsChanged=50,
    )
    issue_a = post_issue(
        client,
        **tab_a,
        extensionIssueId="issue-tab-a",
    )
    issue_b = post_issue(
        client,
        **tab_b,
        extensionIssueId="issue-tab-b",
    )
    list_b = client.get(
        "/api/extension/issues?documentId=google-doc-a"
        "&manuscriptSurfaceId=google-doc-a:tab-b"
    )

    assert session_a.status_code == 201
    assert issue_a.status_code == 201
    assert issue_b.status_code == 201
    assert [issue["id"] for issue in list_b.get_json()["issues"]] == ["issue-tab-b"]
    assert len(get_project(client, "project-a")["sessions"]) == 1
    assert get_project(client, "project-b")["sessions"] == []


def test_binding_lifecycle_stale_clear_keeps_history_and_makes_project_available(
    tmp_path,
):
    client = client_for(tmp_path)
    seed_state(client)
    deleted_surface = bind_surface(
        client,
        project_id="project-a",
        document_id="deleted-doc",
        tab_id="tab-a",
    )
    post_extension_session(
        client,
        **deleted_surface,
        extensionSessionId="session-before-clear",
    )
    post_issue(
        client,
        **deleted_surface,
        extensionIssueId="issue-before-clear",
    )

    stale = client.patch(
        "/api/extension/document-binding/status",
        json={
            **deleted_surface,
            "status": "stale_missing_doc",
            "staleReason": "404",
        },
    )
    stale_state = get_state(client)
    rebound_after_stale = client.put(
        "/api/extension/document-binding",
        json={
            **surface(document_id="new-doc", tab_id="tab-b"),
            "projectId": "project-a",
        },
    )
    clear = client.delete("/api/extension/document-binding", json=deleted_surface)
    rebound = client.put(
        "/api/extension/document-binding",
        json={
            **surface(document_id="new-doc", tab_id="tab-b"),
            "projectId": "project-a",
        },
    )
    project = get_project(client, "project-a")
    picker = client.get("/api/extension/projects").get_json()["projects"]
    project_row = next(row for row in picker if row["project"]["id"] == "project-a")

    assert stale.status_code == 200
    assert (
        deleted_surface["manuscriptSurfaceId"]
        not in stale_state["extensionDocumentBindings"]
    )
    assert (
        stale_state["extensionDeletedBindings"]["project-a"]["documentId"]
        == "deleted-doc"
    )
    assert rebound_after_stale.status_code == 200
    assert clear.status_code == 200
    assert rebound.status_code == 200
    assert project_row["bindingStatus"] == "active"
    assert project_row["deletedBinding"] is None
    assert len(project["sessions"]) == 1
    assert len(project["issues"]) == 1


def test_catch_up_sessions_are_distinguishable_idempotent_and_update_history(tmp_path):
    client = client_for(tmp_path)
    seed_state(client, projects=[project_bundle("project-a", "Project A", 2300)])
    bind_surface(client)

    payload = extension_session_payload(
        extensionSessionId="catch-up-delete",
        sessionType="editing",
        source="catch-up",
        startDocumentWordCount=2300,
        endDocumentWordCount=0,
        netWordsChanged=-2300,
        wordCountMethod="stable-visible-count",
    )
    first = client.post("/api/extension/sessions", json=payload)
    duplicate = client.post("/api/extension/sessions", json=payload)
    project = get_project(client, "project-a")

    assert first.status_code == 201
    assert duplicate.status_code == 200
    assert duplicate.get_json()["duplicate"] is True
    assert len(project["sessions"]) == 1
    assert project["sessions"][0]["source"] == "catch-up"
    assert project["sessions"][0]["netWordsChanged"] == -2300
    assert project["project"]["currentWordCount"] == 0


def test_issue_ingestion_requires_bound_surface_and_persists_surface_metadata(tmp_path):
    client = client_for(tmp_path)
    seed_state(client)

    unbound = post_issue(client)
    bound_surface = bind_surface(client)
    valid = post_issue(client, **bound_surface, note="major pacing drag in scene ten")

    assert unbound.status_code == 409
    assert "not bound" in unbound.get_json()["error"]
    assert valid.status_code == 201
    issue = valid.get_json()["issue"]
    assert issue["manuscriptSurfaceId"] == "google-doc-a:tab-a"
    assert issue["tabId"] == "tab-a"
    assert issue["sectionLabel"] == "Scene 10"


def test_extension_api_auth_and_user_isolation(tmp_path):
    client = client_for(tmp_path, email="a@example.com")
    seed_state(client)
    bind_surface(client)
    project_a_response = post_extension_session(client, extensionSessionId="a-session")
    create_second_user("b@example.com")
    other_client = login_client("b@example.com")

    unauthenticated = app.test_client().get("/api/extension/projects")
    other_user_post = other_client.post(
        "/api/extension/sessions",
        json=extension_session_payload(projectId="project-a"),
    )
    other_user_projects = other_client.get("/api/projects")

    assert project_a_response.status_code == 201
    assert unauthenticated.status_code == 401
    assert other_user_post.status_code == 409
    assert other_user_projects.get_json()["projects"] == []


def test_sqlite_persists_sessions_bindings_issues_and_stale_status_after_reload(
    tmp_path,
):
    client = client_for(tmp_path)
    seed_state(client)
    bound_surface = bind_surface(client)
    post_extension_session(client, **bound_surface)
    post_issue(client, **bound_surface)
    client.patch(
        "/api/extension/document-binding/status",
        json={**bound_surface, "status": "stale_missing_tab", "staleReason": "missing"},
    )

    reloaded_client = app.test_client()
    reloaded_client.set_cookie(
        "session",
        client.get_cookie("session").value,
        domain="localhost",
    )
    state = reloaded_client.get("/api/state").get_json()
    binding = state["extensionDeletedBindings"]["project-a"]
    project = next(
        project for project in state["projects"] if project["id"] == "project-a"
    )

    assert binding["status"] == "stale_missing_tab"
    assert project["sessions"][0]["netWordsChanged"] == 200
    assert project["issues"][0]["manuscriptSurfaceId"] == "google-doc-a:tab-a"


def test_legacy_document_binding_applies_only_to_default_surface(tmp_path):
    client = client_for(tmp_path)
    seed_state(client, bindings={"google-doc-a": "project-a"})

    default_binding = client.get(
        "/api/extension/document-binding?documentId=google-doc-a"
        "&manuscriptSurfaceId=google-doc-a:default"
    )
    tab_binding = client.get(
        "/api/extension/document-binding?documentId=google-doc-a"
        "&manuscriptSurfaceId=google-doc-a:tab-a"
    )

    assert default_binding.get_json()["project"]["id"] == "project-a"
    assert tab_binding.get_json()["project"] is None


def test_state_preservation_treats_stable_visible_snapshots_as_canonical(tmp_path):
    client = client_for(tmp_path)
    original_state = seed_state(
        client,
        projects=[project_bundle("project-a", "Project A", 1000)],
    )
    bind_surface(client)
    post_extension_session(
        client,
        extensionSessionId="stable-visible-session",
        startDocumentWordCount=1000,
        endDocumentWordCount=1200,
        netWordsChanged=200,
        wordCountMethod="stable-visible-count",
        wordsWritten=0,
    )

    stale_state = {
        **original_state,
        "projects": [
            {
                **original_state["projects"][0],
                "project": {
                    **original_state["projects"][0]["project"],
                    "currentWordCount": 1000,
                },
                "sessions": [],
            }
        ],
    }
    save_response = client.put("/api/state", json=stale_state)
    project = get_project(client, "project-a")

    assert save_response.status_code == 200
    assert project["project"]["currentWordCount"] == 1200
    assert project["sessions"][0]["wordCountMethod"] == "stable-visible-count"


def test_static_backend_contract_hooks_exist():
    html = Path("templates/index.html").read_text(encoding="utf-8")
    js_assets = [
        Path("static/js/state.js").read_text(encoding="utf-8"),
        Path("static/js/dashboard.js").read_text(encoding="utf-8"),
        Path("static/js/edit.js").read_text(encoding="utf-8"),
        Path("static/js/edit2.js").read_text(encoding="utf-8"),
        Path("static/js/app.js").read_text(encoding="utf-8"),
    ]
    combined_js = "\n".join(js_assets)

    for asset in [
        "static/js/state.js",
        "static/js/dashboard.js",
        "static/js/plot.js",
        "static/js/edit.js",
        "static/js/edit2.js",
        "static/js/app.js",
    ]:
        assert asset in html
    for dom_id in [
        'id="session-modal"',
        'id="issue-form"',
        'id="view-create-project"',
        'id="view-projects"',
        'id="view-dashboard"',
    ]:
        assert dom_id in html
    assert "netWordsChanged" in combined_js
    assert "words edited" not in combined_js
