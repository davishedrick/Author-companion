from __future__ import annotations

from app import app
from auth_store import create_user


def use_isolated_db(tmp_path):
    app.config["STATE_DB_PATH"] = str(tmp_path / "scriptor-contracts.sqlite3")
    app.config["SECRET_KEY"] = "test-secret"
    app.config["MAIL_OUTBOX"] = []
    app.config["MAIL_HOST"] = ""
    app.config["MAIL_SENDER"] = ""
    app.config["PASSWORD_RESET_TOKEN_TTL_SECONDS"] = 3600


def client_for(tmp_path, email="writer@example.com", password="verysecure"):
    use_isolated_db(tmp_path)
    client = app.test_client()
    client.post(
        "/login",
        data={"email": email, "password": password},
        follow_redirects=False,
    )
    return client


def create_second_user(email="other@example.com", password="verysecure"):
    with app.app_context():
        return create_user(email, password)


def login_client(email="writer@example.com", password="verysecure"):
    client = app.test_client()
    response = client.post(
        "/login",
        data={"email": email, "password": password},
        follow_redirects=False,
    )
    assert response.status_code == 302
    return client


def project_bundle(project_id="project-a", title="Project A", current_word_count=0):
    return {
        "id": project_id,
        "status": "active",
        "project": {
            "bookTitle": title,
            "manuscriptType": "Novel",
            "structureUnitLabel": "Chapter",
            "targetWordCount": 80000,
            "currentWordCount": current_word_count,
            "deadline": "",
            "dailyTarget": 1000,
            "projectStartDate": "2026-04-01",
        },
        "completion": {},
        "publication": {},
        "editing": {
            "focusKey": "revision",
            "passName": "Line edit",
            "passStage": "",
            "passStatus": "",
            "passObjective": "",
            "progressCurrent": 0,
            "progressTotal": 0,
        },
        "plot": {},
        "goals": [],
        "snapshots": [],
        "sessions": [],
        "issues": [],
        "milestones": [],
    }


def seed_state(client, projects=None, bindings=None, active_project_id="project-a"):
    payload = {
        "projects": projects
        if projects is not None
        else [
            project_bundle("project-a", "Project A"),
            project_bundle("project-b", "Project B"),
        ],
        "activeProjectId": active_project_id,
        "activeView": "dashboard",
        "lastWorkspaceView": "dashboard",
        "extensionDocumentBindings": bindings or {},
        "extensionDeletedBindings": {},
        "deletedExtensionSessionIds": [],
        "deletedExtensionProjectIds": [],
    }
    response = client.put("/api/state", json=payload)
    assert response.status_code == 200
    return response.get_json()


def get_state(client):
    response = client.get("/api/state")
    assert response.status_code == 200
    return response.get_json()


def get_project(client, project_id="project-a"):
    state = get_state(client)
    return next(project for project in state["projects"] if project["id"] == project_id)


def surface(
    document_id="google-doc-a",
    tab_id="tab-a",
    tab_title="Draft V1",
):
    return {
        "documentId": document_id,
        "tabId": tab_id,
        "tabTitle": tab_title,
        "manuscriptSurfaceId": f"{document_id}:{tab_id}",
    }


def bind_surface(client, project_id="project-a", **overrides):
    binding_overrides = {
        key: overrides.pop(key)
        for key in list(overrides.keys())
        if key not in {"document_id", "tab_id", "tab_title"}
    }
    payload = {
        **surface(**overrides),
        "projectId": project_id,
        **binding_overrides,
    }
    response = client.put("/api/extension/document-binding", json=payload)
    assert response.status_code == 200
    return payload


def extension_session_payload(**overrides):
    payload = {
        **surface(),
        "projectId": "project-a",
        "extensionSessionId": "extension-session-1",
        "sessionType": "writing",
        "startedAt": "2026-05-04T12:00:00.000Z",
        "endedAt": "2026-05-04T12:42:00.000Z",
        "durationMinutes": 42,
        "startDocumentWordCount": 1000,
        "endDocumentWordCount": 1200,
        "netWordsChanged": 200,
        "wordCountMethod": "google-docs-api",
        "measurementPending": False,
        "source": "chrome-extension",
        "documentUrl": "https://docs.google.com/document/d/google-doc-a/edit",
        "notes": "",
        "wordsWritten": 0,
        "wordsEdited": 0,
        "wordsAdded": 0,
        "wordsRemoved": 0,
    }
    payload.update(overrides)
    return payload


def post_extension_session(client, **overrides):
    return client.post(
        "/api/extension/sessions",
        json=extension_session_payload(**overrides),
    )


def issue_payload(**overrides):
    payload = {
        **surface(),
        "projectId": "project-a",
        "extensionIssueId": "extension-issue-1",
        "note": "chapter three dialogue stiff and confusing here",
        "snippet": "I was not sure why she said it that way.",
        "contextBefore": "Before",
        "contextAfter": "After",
        "documentUrl": "https://docs.google.com/document/d/google-doc-a/edit",
        "source": "chrome-extension",
    }
    payload.update(overrides)
    return payload


def post_issue(client, **overrides):
    return client.post("/api/extension/issues", json=issue_payload(**overrides))


def assert_net_session(session, *, start, end, net, session_type=None):
    assert session["startDocumentWordCount"] == start
    assert session["endDocumentWordCount"] == end
    assert session["netWordsChanged"] == net
    if session_type:
        assert session["type"] == session_type
