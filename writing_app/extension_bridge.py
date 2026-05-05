from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


class ExtensionBridgeError(ValueError):
    status_code = 400


class ProjectNotFoundError(ExtensionBridgeError):
    status_code = 404


class ProjectUnavailableError(ExtensionBridgeError):
    status_code = 409


class DocumentBindingConflictError(ExtensionBridgeError):
    status_code = 409


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _project_summary(bundle: dict[str, Any]) -> dict[str, Any]:
    project = bundle.get("project") if isinstance(bundle.get("project"), dict) else {}
    return {
        "id": _clean_text(bundle.get("id")),
        "bookTitle": _clean_text(project.get("bookTitle")) or "Untitled project",
        "manuscriptType": _clean_text(project.get("manuscriptType")),
        "status": _clean_text(bundle.get("status")) or "active",
    }


def _project_is_archived(bundle: dict[str, Any]) -> bool:
    project = bundle.get("project") if isinstance(bundle.get("project"), dict) else {}
    return bundle.get("status") == "archived" or project.get("status") == "archived"


def _project_is_published_locked(bundle: dict[str, Any]) -> bool:
    publication = bundle.get("publication")
    return isinstance(publication, dict) and bool(publication.get("isPublished"))


def _project_allows_extension_sessions(bundle: dict[str, Any]) -> bool:
    return not _project_is_archived(bundle) and not _project_is_published_locked(bundle)


def _find_project(state: dict[str, Any], project_id: str) -> dict[str, Any] | None:
    return next(
        (
            project
            for project in state.get("projects", [])
            if isinstance(project, dict) and project.get("id") == project_id
        ),
        None,
    )


def _require_project(state: dict[str, Any], project_id: str) -> dict[str, Any]:
    project = _find_project(state, project_id)
    if not project:
        raise ProjectNotFoundError("Project not found.")
    if not _project_allows_extension_sessions(project):
        raise ProjectUnavailableError(
            "Project is not available for extension sessions."
        )
    return project


def _bindings(state: dict[str, Any]) -> dict[str, str]:
    bindings = state.setdefault("extensionDocumentBindings", {})
    if not isinstance(bindings, dict):
        bindings = {}
        state["extensionDocumentBindings"] = bindings
    return bindings


def _parse_iso(value: Any, field_name: str) -> str:
    text = _clean_text(value)
    if not text:
        raise ExtensionBridgeError(f"{field_name} is required.")
    try:
        datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ExtensionBridgeError(f"{field_name} must be an ISO timestamp.") from exc
    return text


def _duration_minutes(value: Any) -> int:
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ExtensionBridgeError("durationMinutes must be a number.") from exc
    if parsed <= 0:
        raise ExtensionBridgeError("durationMinutes must be greater than zero.")
    return max(1, round(parsed))


def _current_editing_pass_name(project: dict[str, Any]) -> str:
    editing = project.get("editing")
    if not isinstance(editing, dict):
        return ""
    return _clean_text(editing.get("passName")) or _clean_text(editing.get("focusKey"))


def get_active_projects(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        _project_summary(project)
        for project in state.get("projects", [])
        if isinstance(project, dict) and _project_allows_extension_sessions(project)
    ]


def get_document_binding(
    state: dict[str, Any], document_id: str
) -> tuple[dict[str, Any] | None, bool]:
    document_id = _clean_text(document_id)
    if not document_id:
        raise ExtensionBridgeError("documentId is required.")

    bindings = _bindings(state)
    project_id = bindings.get(document_id)
    if not project_id:
        return None, False

    project = _find_project(state, project_id)
    if not project or not _project_allows_extension_sessions(project):
        bindings.pop(document_id, None)
        return None, True

    return _project_summary(project), False


def save_document_binding(
    state: dict[str, Any], document_id: str, project_id: str
) -> dict[str, Any]:
    document_id = _clean_text(document_id)
    project_id = _clean_text(project_id)
    if not document_id:
        raise ExtensionBridgeError("documentId is required.")
    if not project_id:
        raise ExtensionBridgeError("projectId is required.")

    project = _require_project(state, project_id)
    _bindings(state)[document_id] = project_id
    return _project_summary(project)


def append_extension_session(
    state: dict[str, Any], payload: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any], bool]:
    if not isinstance(payload, dict):
        raise ExtensionBridgeError("JSON body is required.")

    document_id = _clean_text(payload.get("documentId"))
    project_id = _clean_text(payload.get("projectId"))
    extension_session_id = _clean_text(payload.get("extensionSessionId"))
    session_type = _clean_text(payload.get("sessionType")).lower()

    if not document_id:
        raise ExtensionBridgeError("documentId is required.")
    if not project_id:
        raise ExtensionBridgeError("projectId is required.")
    if not extension_session_id:
        raise ExtensionBridgeError("extensionSessionId is required.")
    if session_type not in {"writing", "editing"}:
        raise ExtensionBridgeError("sessionType must be writing or editing.")

    started_at = _parse_iso(payload.get("startedAt"), "startedAt")
    ended_at = _parse_iso(payload.get("endedAt"), "endedAt")
    duration_minutes = _duration_minutes(payload.get("durationMinutes"))
    notes = _clean_text(payload.get("notes"))
    document_url = _clean_text(payload.get("documentUrl"))
    source = _clean_text(payload.get("source")) or "chrome-extension"

    bindings = _bindings(state)
    bound_project_id = bindings.get(document_id)
    if bound_project_id and bound_project_id != project_id:
        raise DocumentBindingConflictError("Document is bound to a different project.")

    project = _require_project(state, project_id)
    sessions = project.setdefault("sessions", [])
    existing_session = next(
        (
            session
            for session in sessions
            if isinstance(session, dict)
            and (
                session.get("extensionSessionId") == extension_session_id
                or session.get("id") == extension_session_id
            )
        ),
        None,
    )
    if existing_session:
        return existing_session, _project_summary(project), True

    bindings[document_id] = project_id
    normalized_type = "write" if session_type == "writing" else "edit"
    session = {
        "id": extension_session_id or f"extension-{uuid4()}",
        "type": normalized_type,
        "date": ended_at,
        "startedAt": started_at,
        "endedAt": ended_at,
        "durationMinutes": duration_minutes,
        "wordsWritten": 0,
        "wordsEdited": 0,
        "notes": notes,
        "source": source,
        "documentId": document_id,
        "documentUrl": document_url,
        "extensionSessionId": extension_session_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    if normalized_type == "edit":
        session["passName"] = _current_editing_pass_name(project)
        session["sectionLabel"] = ""
    else:
        session["passName"] = ""
        session["sectionLabel"] = ""

    sessions.append(session)
    return session, _project_summary(project), False
