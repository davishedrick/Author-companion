import json
import sqlite3
from pathlib import Path

from flask import current_app


DEFAULT_PERSISTED_STATE = {
    "projects": [],
    "activeProjectId": None,
    "activeView": "dashboard",
    "lastWorkspaceView": "dashboard",
    "extensionDocumentBindings": {},
}


def get_db_path() -> Path:
    configured_path = current_app.config.get("STATE_DB_PATH")
    if configured_path:
        path = Path(configured_path)
    else:
        path = Path(current_app.instance_path) / "author_engine_state.sqlite3"
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
        extension_document_bindings = {
            str(document_id): str(project_id)
            for document_id, project_id in extension_document_bindings.items()
            if document_id and project_id
        }

    return {
        "projects": payload.get("projects")
        if isinstance(payload.get("projects"), list)
        else [],
        "activeProjectId": active_project_id,
        "activeView": active_view,
        "lastWorkspaceView": last_workspace_view,
        "extensionDocumentBindings": extension_document_bindings,
    }


def load_state(user_id=None):
    if not user_id:
        return dict(DEFAULT_PERSISTED_STATE)

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
        return dict(DEFAULT_PERSISTED_STATE)

    try:
        payload = json.loads(row["state_json"])
    except json.JSONDecodeError:
        return dict(DEFAULT_PERSISTED_STATE)

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
