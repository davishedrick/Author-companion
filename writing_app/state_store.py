import json
import sqlite3
from copy import deepcopy
from pathlib import Path

from flask import current_app


DEFAULT_PERSISTED_STATE = {
    "projects": [],
    "activeProjectId": None,
    "activeView": "dashboard",
    "lastWorkspaceView": "dashboard",
    "extensionDocumentBindings": {},
    "extensionDeletedBindings": {},
    "deletedExtensionSessionIds": [],
    "deletedExtensionProjectIds": [],
}


def _non_negative_int(value, default=0):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    if parsed < 0:
        return default
    return round(parsed)


def _optional_non_negative_int(value):
    if value in (None, ""):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return round(parsed)


def _int_value(value, default=0):
    try:
        return round(float(value))
    except (TypeError, ValueError):
        return default


def _binding_project_id(binding):
    if isinstance(binding, dict):
        return str(binding.get("projectId") or "").strip()
    return str(binding or "").strip()


def _bound_project_ids(extension_document_bindings, extension_deleted_bindings):
    project_ids = set()
    for binding in extension_document_bindings.values():
        project_id = _binding_project_id(binding)
        if project_id:
            project_ids.add(project_id)
    for project_id, binding in extension_deleted_bindings.items():
        if isinstance(binding, dict) and binding:
            project_ids.add(str(project_id))
    return project_ids


def _session_manuscript_delta(session):
    if not isinstance(session, dict):
        return 0
    start = _optional_non_negative_int(session.get("startDocumentWordCount"))
    end = _optional_non_negative_int(session.get("endDocumentWordCount"))
    if start is not None and end is not None:
        return end - start
    net_words = session.get("netWordsChanged")
    try:
        parsed_net = float(net_words)
    except (TypeError, ValueError):
        parsed_net = None
    if parsed_net is not None:
        return round(parsed_net)
    if session.get("type") == "edit":
        return _non_negative_int(session.get("wordsAdded")) - _non_negative_int(
            session.get("wordsRemoved")
        )
    return _non_negative_int(session.get("wordsWritten"))


def _normalize_project_baselines(projects, bound_project_ids):
    normalized_projects = projects if isinstance(projects, list) else []
    for project_bundle in normalized_projects:
        if not isinstance(project_bundle, dict):
            continue
        project_id = str(project_bundle.get("id") or "").strip()
        project = project_bundle.get("project")
        if not isinstance(project, dict):
            continue

        current_word_count = _non_negative_int(project.get("currentWordCount"))
        project["currentWordCount"] = current_word_count
        existing_starting_count = _optional_non_negative_int(
            project.get("startingWordCount")
        )
        if existing_starting_count is not None:
            project["startingWordCount"] = existing_starting_count
            project["baselineEstablished"] = bool(
                project.get("baselineEstablished", True)
            )
            project["startingWordCountSource"] = str(
                project.get("startingWordCountSource") or "existing"
            )
            project["startingWordCountEstablishedAt"] = str(
                project.get("startingWordCountEstablishedAt") or ""
            )
            continue

        if project_id not in bound_project_ids:
            project["startingWordCount"] = None
            project["baselineEstablished"] = False
            project["startingWordCountSource"] = str(
                project.get("startingWordCountSource") or "provisional"
            )
            project["startingWordCountEstablishedAt"] = str(
                project.get("startingWordCountEstablishedAt") or ""
            )
            continue

        sessions = (
            project_bundle.get("sessions")
            if isinstance(project_bundle.get("sessions"), list)
            else []
        )
        if sessions:
            tracked_delta = sum(
                _session_manuscript_delta(session) for session in sessions
            )
            project["startingWordCount"] = max(0, current_word_count - tracked_delta)
            project["startingWordCountSource"] = "migration_estimated_from_sessions"
        else:
            project["startingWordCount"] = current_word_count
            project["startingWordCountSource"] = "migration_bound_no_sessions"
        project["baselineEstablished"] = True
        project["startingWordCountEstablishedAt"] = str(
            project.get("startingWordCountEstablishedAt") or ""
        )

    return normalized_projects


def get_db_path() -> Path:
    configured_path = current_app.config.get("STATE_DB_PATH")
    if configured_path:
        path = Path(configured_path)
    else:
        instance_path = Path(current_app.instance_path)
        path = instance_path / "scriptor_state.sqlite3"
        legacy_path = instance_path / "author_engine_state.sqlite3"
        if legacy_path.exists() and not path.exists():
            path = legacy_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(get_db_path())
    connection.row_factory = sqlite3.Row
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS app_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            state_json TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS user_state (
            user_id INTEGER PRIMARY KEY,
            state_json TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            used_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )
    return connection


def normalize_state_payload(payload):
    if not isinstance(payload, dict):
        return dict(DEFAULT_PERSISTED_STATE)

    active_project_id = payload.get("activeProjectId")
    if active_project_id is not None and not isinstance(active_project_id, str):
        active_project_id = None

    active_view = payload.get("activeView")
    if not isinstance(active_view, str):
        active_view = DEFAULT_PERSISTED_STATE["activeView"]

    last_workspace_view = payload.get("lastWorkspaceView")
    if not isinstance(last_workspace_view, str):
        last_workspace_view = DEFAULT_PERSISTED_STATE["lastWorkspaceView"]

    extension_document_bindings = payload.get("extensionDocumentBindings")
    if not isinstance(extension_document_bindings, dict):
        extension_document_bindings = {}
    else:
        normalized_bindings = {}
        for document_id, binding in extension_document_bindings.items():
            if not document_id or not binding:
                continue
            if isinstance(binding, dict):
                project_id = binding.get("projectId")
                if project_id:
                    normalized_bindings[str(document_id)] = {
                        **binding,
                        "projectId": str(project_id),
                    }
                continue
            normalized_bindings[str(document_id)] = str(binding)
        extension_document_bindings = normalized_bindings

    extension_deleted_bindings = payload.get("extensionDeletedBindings")
    if not isinstance(extension_deleted_bindings, dict):
        extension_deleted_bindings = {}
    else:
        normalized_deleted_bindings = {}
        for project_id, binding in extension_deleted_bindings.items():
            if not project_id or not isinstance(binding, dict):
                continue
            normalized_deleted_bindings[str(project_id)] = {
                **binding,
                "projectId": str(project_id),
            }
        extension_deleted_bindings = normalized_deleted_bindings

    deleted_extension_session_ids = payload.get("deletedExtensionSessionIds")
    if not isinstance(deleted_extension_session_ids, list):
        deleted_extension_session_ids = []
    else:
        deleted_extension_session_ids = [
            str(session_id)
            for session_id in deleted_extension_session_ids
            if session_id
        ]

    deleted_extension_project_ids = payload.get("deletedExtensionProjectIds")
    if not isinstance(deleted_extension_project_ids, list):
        deleted_extension_project_ids = []
    else:
        deleted_extension_project_ids = [
            str(project_id)
            for project_id in deleted_extension_project_ids
            if project_id
        ]

    projects = _normalize_project_baselines(
        payload.get("projects") if isinstance(payload.get("projects"), list) else [],
        _bound_project_ids(extension_document_bindings, extension_deleted_bindings),
    )

    return {
        "projects": projects,
        "activeProjectId": active_project_id,
        "activeView": active_view,
        "lastWorkspaceView": last_workspace_view,
        "extensionDocumentBindings": extension_document_bindings,
        "extensionDeletedBindings": extension_deleted_bindings,
        "deletedExtensionSessionIds": deleted_extension_session_ids,
        "deletedExtensionProjectIds": deleted_extension_project_ids,
    }


def load_state(user_id=None):
    if not user_id:
        return deepcopy(DEFAULT_PERSISTED_STATE)

    with get_connection() as connection:
        row = connection.execute(
            "SELECT state_json FROM user_state WHERE user_id = ?",
            (user_id,),
        ).fetchone()

        if not row:
            user_count = connection.execute(
                "SELECT COUNT(*) AS count FROM users"
            ).fetchone()
            if user_count and int(user_count["count"]) == 1:
                row = connection.execute(
                    "SELECT state_json FROM app_state WHERE id = 1"
                ).fetchone()

    if not row:
        return deepcopy(DEFAULT_PERSISTED_STATE)

    try:
        payload = json.loads(row["state_json"])
    except json.JSONDecodeError:
        return deepcopy(DEFAULT_PERSISTED_STATE)

    return normalize_state_payload(payload)


def save_state(payload, user_id=None):
    normalized_payload = normalize_state_payload(payload)
    if not user_id:
        return normalized_payload

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO user_state (user_id, state_json)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json
            """,
            (user_id, json.dumps(normalized_payload)),
        )
        connection.commit()

    return normalized_payload
