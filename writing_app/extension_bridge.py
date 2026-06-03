from __future__ import annotations

from datetime import datetime, timezone
import re
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


ISSUE_TITLE_WORD_LIMIT = 8
ISSUE_SECTION_NUMBER_WORDS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}
ISSUE_SECTION_WORD_PATTERN = (
    r"(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|"
    r"twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|"
    r"twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)"
    r"(?:[-\s](?:one|two|three|four|five|six|seven|eight|nine))?"
)
ISSUE_SECTION_REGEX = re.compile(
    rf"(chapter|scene|section)\s+(?:\d+|{ISSUE_SECTION_WORD_PATTERN})\b",
    re.IGNORECASE,
)
ISSUE_TYPE_RULES = [
    ("Dialogue", ["dialogue", "conversation", "line"]),
    ("Pacing", ["slow", "fast", "drag", "rush"]),
    ("Clarity", ["confusing", "unclear", "hard to follow"]),
    ("Character", ["motivation", "arc", "character"]),
    ("Grammar", ["grammar", "typo", "spelling"]),
]
ISSUE_HIGH_PRIORITY_KEYWORDS = ["major", "critical", "big"]
ISSUE_META_FIELDS = [
    "source",
    "documentId",
    "tabId",
    "tabTitle",
    "manuscriptSurfaceId",
    "manuscriptSurfaceLabel",
    "documentUrl",
    "extensionIssueId",
    "quoteLocator",
    "textLocation",
]


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_issue_note_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _normalize_issue_comparison_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _normalize_chapter_label(value: Any) -> str:
    text = _normalize_issue_note_text(value)
    return text or "Unassigned"


def _parse_issue_section_number(value: Any) -> str:
    normalized_value = _normalize_issue_note_text(value)
    if re.fullmatch(r"\d+", normalized_value):
        return normalized_value

    word_tokens = [
        token
        for token in _normalize_issue_comparison_text(normalized_value).split(" ")
        if token
    ]
    if not word_tokens or not all(
        token in ISSUE_SECTION_NUMBER_WORDS for token in word_tokens
    ):
        return normalized_value
    return str(sum(ISSUE_SECTION_NUMBER_WORDS[token] for token in word_tokens))


def _format_derived_issue_section(match: str) -> str:
    section_match = re.match(r"^(chapter|scene|section)\s+(.+)$", match, re.IGNORECASE)
    if not section_match:
        return _normalize_chapter_label(match)
    section_type = section_match.group(1).capitalize()
    return f"{section_type} {_parse_issue_section_number(section_match.group(2))}"


def _derive_issue_title_from_note(note: str) -> str:
    normalized_note = _normalize_issue_note_text(note)
    if not normalized_note:
        return "Untitled issue"
    words = [word for word in normalized_note.split(" ") if word]
    return " ".join(words[: min(ISSUE_TITLE_WORD_LIMIT, len(words))])


def _derive_issue_section_from_note(note: str) -> str:
    matched_section = ISSUE_SECTION_REGEX.search(str(note or ""))
    if matched_section:
        return _format_derived_issue_section(matched_section.group(0))
    return "Unassigned"


def _derive_issue_type_from_note(note: str) -> str:
    normalized_note = _normalize_issue_note_text(note).lower()
    for issue_type, keywords in ISSUE_TYPE_RULES:
        if any(keyword in normalized_note for keyword in keywords):
            return issue_type
    return "General"


def _derive_issue_priority_from_note(note: str) -> str:
    normalized_note = _normalize_issue_note_text(note).lower()
    return (
        "High"
        if any(keyword in normalized_note for keyword in ISSUE_HIGH_PRIORITY_KEYWORDS)
        else "Medium"
    )


def _project_summary(bundle: dict[str, Any]) -> dict[str, Any]:
    project = bundle.get("project") if isinstance(bundle.get("project"), dict) else {}
    return {
        "id": _clean_text(bundle.get("id")),
        "bookTitle": _clean_text(project.get("bookTitle")) or "Untitled project",
        "manuscriptType": _clean_text(project.get("manuscriptType")),
        "currentWordCount": _non_negative_int(project.get("currentWordCount")),
        "startingWordCount": (
            _non_negative_int(project.get("startingWordCount"))
            if project.get("startingWordCount") not in (None, "")
            else None
        ),
        "baselineEstablished": bool(project.get("baselineEstablished"))
        or project.get("startingWordCount") not in (None, ""),
        "startingWordCountSource": _clean_text(project.get("startingWordCountSource")),
        "startingWordCountEstablishedAt": _clean_text(
            project.get("startingWordCountEstablishedAt")
        ),
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


def _bindings(state: dict[str, Any]) -> dict[str, Any]:
    bindings = state.setdefault("extensionDocumentBindings", {})
    if not isinstance(bindings, dict):
        bindings = {}
        state["extensionDocumentBindings"] = bindings
    return bindings


def _deleted_bindings(state: dict[str, Any]) -> dict[str, Any]:
    deleted_bindings = state.setdefault("extensionDeletedBindings", {})
    if not isinstance(deleted_bindings, dict):
        deleted_bindings = {}
        state["extensionDeletedBindings"] = deleted_bindings
    return deleted_bindings


def _binding_project_id(binding: Any) -> str:
    if isinstance(binding, dict):
        return _clean_text(binding.get("projectId"))
    return _clean_text(binding)


def _binding_status(binding: Any) -> str:
    if isinstance(binding, dict):
        status = _clean_text(binding.get("status"))
        return status or "active"
    return "active" if _binding_project_id(binding) else "unbound"


def _is_stale_binding(binding: Any) -> bool:
    return _binding_status(binding).startswith("stale_")


def _binding_record(
    *,
    document_id: str,
    project_id: str,
    manuscript_surface_id: str = "",
    tab_id: str = "",
    tab_title: str = "",
    document_url: str = "",
) -> dict[str, Any]:
    document_id = _clean_text(document_id)
    manuscript_surface_id = _clean_text(manuscript_surface_id) or _binding_key(
        document_id
    )
    tab_id = _clean_text(tab_id) or (
        "default" if manuscript_surface_id == _default_surface_id(document_id) else ""
    )
    now = datetime.now(timezone.utc).isoformat()
    return {
        "documentId": document_id,
        "tabId": tab_id,
        "tabTitle": _clean_text(tab_title),
        "manuscriptSurfaceId": manuscript_surface_id,
        "documentUrl": _clean_text(document_url),
        "projectId": _clean_text(project_id),
        "status": "active",
        "staleReason": "",
        "lastValidatedAt": "",
        "createdAt": now,
        "updatedAt": now,
    }


def _binding_key(document_id: str, manuscript_surface_id: str = "") -> str:
    return _clean_text(manuscript_surface_id) or _clean_text(document_id)


def _default_surface_id(document_id: str) -> str:
    return f"{_clean_text(document_id)}:default" if _clean_text(document_id) else ""


def _binding_lookup_keys(
    document_id: str, manuscript_surface_id: str = ""
) -> list[str]:
    document_id = _clean_text(document_id)
    manuscript_surface_id = _clean_text(manuscript_surface_id)
    keys = [manuscript_surface_id] if manuscript_surface_id else []
    if not manuscript_surface_id or manuscript_surface_id == _default_surface_id(
        document_id
    ):
        keys.append(document_id)
    return [key for index, key in enumerate(keys) if key and key not in keys[:index]]


def _lookup_bound_project_id(
    bindings: dict[str, Any], document_id: str, manuscript_surface_id: str = ""
) -> str:
    for key in _binding_lookup_keys(document_id, manuscript_surface_id):
        project_id = _binding_project_id(bindings.get(key))
        if project_id:
            return project_id
    return ""


def _project_binding_key(
    bindings: dict[str, Any], project_id: str, except_key: str = ""
) -> str:
    project_id = _clean_text(project_id)
    except_key = _clean_text(except_key)
    if not project_id:
        return ""
    for key, binding in bindings.items():
        if key != except_key and _binding_project_id(binding) == project_id:
            return key
    return ""


def _project_binding_entry(
    bindings: dict[str, Any], project_id: str, except_key: str = ""
) -> tuple[str, Any]:
    key = _project_binding_key(bindings, project_id, except_key)
    return key, bindings.get(key) if key else None


def _deleted_binding_record(
    binding: Any,
    status: str,
    stale_reason: str = "",
    *,
    document_id: str = "",
    manuscript_surface_id: str = "",
    tab_id: str = "",
    tab_title: str = "",
) -> dict[str, Any]:
    binding_dict = binding if isinstance(binding, dict) else {}
    resolved_document_id = _clean_text(binding_dict.get("documentId")) or _clean_text(
        document_id
    )
    resolved_tab_title = _clean_text(binding_dict.get("tabTitle")) or _clean_text(
        tab_title
    )
    resolved_url = _clean_text(binding_dict.get("documentUrl"))
    if not resolved_url and resolved_document_id:
        resolved_url = f"https://docs.google.com/document/d/{resolved_document_id}/edit"
    return {
        "projectId": _binding_project_id(binding),
        "documentId": resolved_document_id,
        "tabId": _clean_text(binding_dict.get("tabId")) or _clean_text(tab_id),
        "tabTitle": resolved_tab_title,
        "title": resolved_tab_title,
        "manuscriptSurfaceId": _clean_text(binding_dict.get("manuscriptSurfaceId"))
        or _clean_text(manuscript_surface_id)
        or _binding_key(resolved_document_id, manuscript_surface_id),
        "url": resolved_url,
        "documentUrl": resolved_url,
        "status": status,
        "staleReason": _clean_text(stale_reason),
        "detectedAt": datetime.now(timezone.utc).isoformat(),
    }


def _deleted_extension_session_ids(state: dict[str, Any]) -> set[str]:
    session_ids = state.get("deletedExtensionSessionIds")
    if not isinstance(session_ids, list):
        return set()
    return {
        _clean_text(session_id) for session_id in session_ids if _clean_text(session_id)
    }


def _deleted_extension_project_ids(state: dict[str, Any]) -> set[str]:
    project_ids = state.get("deletedExtensionProjectIds")
    if not isinstance(project_ids, list):
        return set()
    return {
        _clean_text(project_id) for project_id in project_ids if _clean_text(project_id)
    }


def _extension_binding_project_ids(state: dict[str, Any]) -> set[str]:
    project_ids: set[str] = set()
    for binding in _bindings(state).values():
        project_id = _binding_project_id(binding)
        if project_id:
            project_ids.add(project_id)
    for project_id in _deleted_bindings(state):
        if _clean_text(project_id):
            project_ids.add(_clean_text(project_id))
    return project_ids


def _is_extension_created_project(project: dict[str, Any]) -> bool:
    return _clean_text(project.get("source")) == "chrome-extension"


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


def _non_negative_int(value: Any) -> int:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return 0
    if parsed <= 0:
        return 0
    return round(parsed)


def _parse_non_negative_int(value: Any, field_name: str) -> int:
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ExtensionBridgeError(
            f"{field_name} must be a non-negative number."
        ) from exc
    if parsed < 0:
        raise ExtensionBridgeError(f"{field_name} must be a non-negative number.")
    return round(parsed)


def _int_value(value: Any) -> int:
    try:
        return round(float(value))
    except (TypeError, ValueError):
        return 0


def _derive_word_breakdown(
    total_activity: int, net_words_changed: int
) -> tuple[int, int]:
    if total_activity <= 0:
        return 0, 0
    words_added = (total_activity + net_words_changed) / 2
    words_removed = (total_activity - net_words_changed) / 2
    if words_added < 0 or words_removed < 0:
        return 0, 0
    return round(words_added), round(words_removed)


def _current_editing_pass_name(project: dict[str, Any]) -> str:
    editing = project.get("editing")
    if not isinstance(editing, dict):
        return ""
    return _clean_text(editing.get("passName")) or _clean_text(editing.get("focusKey"))


def _add_project_words(project: dict[str, Any], delta: int) -> None:
    if delta <= 0:
        return

    _apply_project_word_delta(project, delta)


def _apply_project_word_delta(project: dict[str, Any], delta: int) -> None:
    if delta == 0:
        return

    project_bundle = project.get("project")
    if isinstance(project_bundle, dict):
        project_bundle["currentWordCount"] = max(
            0,
            _non_negative_int(project_bundle.get("currentWordCount"))
            + _int_value(delta),
        )


def _set_project_current_word_count(project: dict[str, Any], word_count: int) -> None:
    project_bundle = project.get("project")
    if isinstance(project_bundle, dict):
        project_bundle["currentWordCount"] = _non_negative_int(word_count)


def _optional_non_negative_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return round(parsed)


def _session_manuscript_delta(session: dict[str, Any]) -> int:
    if not isinstance(session, dict):
        return 0
    parsed_net = _int_value(session.get("netWordsChanged"))
    if parsed_net is not None:
        return parsed_net
    start_count = _optional_non_negative_int(session.get("startDocumentWordCount"))
    end_count = _optional_non_negative_int(session.get("endDocumentWordCount"))
    if start_count is not None and end_count is not None:
        return end_count - start_count
    if session.get("type") == "edit":
        return _non_negative_int(session.get("wordsAdded")) - _non_negative_int(
            session.get("wordsRemoved")
        )
    return _non_negative_int(session.get("wordsWritten"))


def _establish_project_starting_word_count(
    project: dict[str, Any],
    word_count: int,
    source: str = "google-docs-binding",
) -> None:
    project_bundle = project.get("project")
    if not isinstance(project_bundle, dict):
        return

    verified_word_count = _non_negative_int(word_count)
    previous_current_word_count = _non_negative_int(
        project_bundle.get("currentWordCount")
    )
    existing_starting_count = _optional_non_negative_int(
        project_bundle.get("startingWordCount")
    )
    if existing_starting_count is not None and project_bundle.get(
        "baselineEstablished"
    ):
        project_bundle["startingWordCount"] = existing_starting_count
        project_bundle["currentWordCount"] = verified_word_count
        return

    sessions = (
        project.get("sessions") if isinstance(project.get("sessions"), list) else []
    )
    if sessions:
        tracked_delta = sum(_session_manuscript_delta(session) for session in sessions)
        project_bundle["startingWordCount"] = max(
            0, previous_current_word_count - tracked_delta
        )
        project_bundle["currentWordCount"] = verified_word_count
        project_bundle["baselineEstablished"] = True
        existing_source = _clean_text(project_bundle.get("startingWordCountSource"))
        project_bundle["startingWordCountSource"] = (
            existing_source
            if existing_source and existing_source != "provisional"
            else "migration_estimated_from_sessions"
        )
        project_bundle["startingWordCountEstablishedAt"] = _clean_text(
            project_bundle.get("startingWordCountEstablishedAt")
        )
        return

    project_bundle["currentWordCount"] = verified_word_count
    project_bundle["startingWordCount"] = verified_word_count
    project_bundle["baselineEstablished"] = True
    project_bundle["startingWordCountSource"] = (
        _clean_text(source) or "google-docs-binding"
    )
    project_bundle["startingWordCountEstablishedAt"] = datetime.now(
        timezone.utc
    ).isoformat()


def _session_end_word_count(session: dict[str, Any]) -> int | None:
    if not isinstance(session, dict):
        return None
    if session.get("measurementPending"):
        return None
    trusted_methods = {
        "google-docs-api",
        "google-docs-net-count",
        "stable-visible",
        "stable-visible-count",
        "visible-fallback",
        "catch-up",
    }
    if _clean_text(session.get("wordCountMethod")) not in trusted_methods:
        return None
    if "endDocumentWordCount" not in session:
        return None
    try:
        parsed = float(session.get("endDocumentWordCount"))
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return round(parsed)


def _session_timestamp(session: dict[str, Any]) -> str:
    return _clean_text(
        session.get("endedAt") or session.get("date") or session.get("createdAt")
    )


def _sync_project_word_count_to_latest_extension_snapshot(
    project: dict[str, Any],
) -> None:
    sessions = project.get("sessions")
    if not isinstance(sessions, list):
        return

    latest_session = max(
        (
            session
            for session in sessions
            if isinstance(session, dict)
            and (
                session.get("source") == "chrome-extension"
                or session.get("extensionSessionId")
            )
            and _session_end_word_count(session) is not None
        ),
        key=_session_timestamp,
        default=None,
    )
    latest_word_count = (
        _session_end_word_count(latest_session) if latest_session else None
    )
    if latest_word_count is not None:
        _set_project_current_word_count(project, latest_word_count)


def _preserve_extension_session_metrics(
    project: dict[str, Any],
    incoming_session: dict[str, Any],
    existing_session: dict[str, Any],
) -> None:
    session_type = _clean_text(
        existing_session.get("type") or incoming_session.get("type")
    )
    existing_has_word_count_snapshot = (
        _session_end_word_count(existing_session) is not None
    )

    if not existing_has_word_count_snapshot:
        if session_type == "write":
            existing_words_written = _non_negative_int(
                existing_session.get("wordsWritten")
            )
            incoming_words_written = _non_negative_int(
                incoming_session.get("wordsWritten")
            )
            if existing_words_written > incoming_words_written:
                _add_project_words(
                    project, existing_words_written - incoming_words_written
                )
        elif session_type == "edit" and not existing_session.get("measurementPending"):
            existing_net_words_changed = _int_value(
                existing_session.get("netWordsChanged")
            )
            incoming_net_words_changed = _int_value(
                incoming_session.get("netWordsChanged")
            )
            if existing_net_words_changed != incoming_net_words_changed:
                _apply_project_word_delta(
                    project, existing_net_words_changed - incoming_net_words_changed
                )

    for field in [
        "type",
        "wordsWritten",
        "wordsEdited",
        "wordsAdded",
        "wordsRemoved",
        "netWordsChanged",
        "wordCountMethod",
        "measurementPending",
        "startDocumentWordCount",
        "endDocumentWordCount",
        "source",
        "documentId",
        "tabId",
        "tabTitle",
        "manuscriptSurfaceId",
        "manuscriptSurfaceLabel",
        "documentUrl",
        "extensionSessionId",
        "createdAt",
    ]:
        if field in existing_session:
            incoming_session[field] = existing_session[field]


def get_active_projects(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        _project_summary(project)
        for project in state.get("projects", [])
        if isinstance(project, dict) and _project_allows_extension_sessions(project)
    ]


def get_extension_projects(state: dict[str, Any]) -> list[dict[str, Any]]:
    bindings = _bindings(state)
    deleted_bindings = _deleted_bindings(state)
    rows = []
    for project in state.get("projects", []):
        if not isinstance(project, dict) or not _project_allows_extension_sessions(
            project
        ):
            continue
        project_id = _clean_text(project.get("id"))
        binding_key, binding = _project_binding_entry(bindings, project_id)
        binding_status = _binding_status(binding) if binding_key else "unbound"
        deleted_binding = deleted_bindings.get(project_id)
        if isinstance(deleted_binding, dict) and not binding_key:
            binding_status = (
                _clean_text(deleted_binding.get("status")) or "stale_missing_doc"
            )
        rows.append(
            {
                "project": _project_summary(project),
                "isBound": bool(binding_key),
                "bindingStatus": binding_status,
                "staleReason": _clean_text(binding.get("staleReason"))
                if isinstance(binding, dict)
                else _clean_text(deleted_binding.get("staleReason"))
                if isinstance(deleted_binding, dict)
                else "",
                "binding": binding if isinstance(binding, dict) else None,
                "deletedBinding": deleted_binding
                if isinstance(deleted_binding, dict)
                else None,
            }
        )
    return rows


def get_document_binding(
    state: dict[str, Any], document_id: str, manuscript_surface_id: str = ""
) -> tuple[dict[str, Any] | None, bool]:
    document_id = _clean_text(document_id)
    manuscript_surface_id = _clean_text(manuscript_surface_id)
    if not document_id:
        raise ExtensionBridgeError("documentId is required.")

    bindings = _bindings(state)
    project_id = _lookup_bound_project_id(bindings, document_id, manuscript_surface_id)
    if not project_id:
        return None, False

    project = _find_project(state, project_id)
    if not project or not _project_allows_extension_sessions(project):
        for key in _binding_lookup_keys(document_id, manuscript_surface_id):
            if _binding_project_id(bindings.get(key)) == project_id:
                bindings.pop(key, None)
        return None, True

    return _project_summary(project), False


def save_document_binding(
    state: dict[str, Any],
    document_id: str,
    project_id: str,
    manuscript_surface_id: str = "",
    tab_id: str = "",
    tab_title: str = "",
    document_url: str = "",
    verified_word_count: Any = None,
    verified_word_count_source: str = "google-docs-binding",
) -> dict[str, Any]:
    document_id = _clean_text(document_id)
    project_id = _clean_text(project_id)
    manuscript_surface_id = _clean_text(manuscript_surface_id)
    if not document_id:
        raise ExtensionBridgeError("documentId is required.")
    if not project_id:
        raise ExtensionBridgeError("projectId is required.")

    project = _require_project(state, project_id)
    bindings = _bindings(state)
    deleted_bindings = _deleted_bindings(state)
    binding_key = _binding_key(document_id, manuscript_surface_id)
    existing_project_id = _binding_project_id(bindings.get(binding_key))
    if existing_project_id and existing_project_id != project_id:
        raise DocumentBindingConflictError(
            "This manuscript is already bound. Unbind first."
        )
    lookup_keys = _binding_lookup_keys(document_id, manuscript_surface_id)
    existing_project_key = _project_binding_key(bindings, project_id, binding_key)
    if existing_project_key and existing_project_key not in lookup_keys:
        raise DocumentBindingConflictError("Project is already bound.")

    if manuscript_surface_id:
        bindings[binding_key] = _binding_record(
            document_id=document_id,
            tab_id=tab_id,
            tab_title=tab_title,
            manuscript_surface_id=manuscript_surface_id,
            project_id=project_id,
            document_url=document_url,
        )
    else:
        bindings[binding_key] = project_id
    deleted_bindings.pop(project_id, None)
    parsed_verified_word_count = _optional_non_negative_int(verified_word_count)
    if parsed_verified_word_count is not None:
        _establish_project_starting_word_count(
            project,
            parsed_verified_word_count,
            verified_word_count_source,
        )
    return _project_summary(project)


def delete_document_binding(
    state: dict[str, Any], document_id: str, manuscript_surface_id: str = ""
) -> bool:
    document_id = _clean_text(document_id)
    manuscript_surface_id = _clean_text(manuscript_surface_id)
    if not document_id:
        raise ExtensionBridgeError("documentId is required.")

    bindings = _bindings(state)
    deleted_bindings = _deleted_bindings(state)
    removed = False
    for key in _binding_lookup_keys(document_id, manuscript_surface_id):
        if key in bindings:
            project_id = _binding_project_id(bindings.get(key))
            bindings.pop(key, None)
            if project_id:
                deleted_bindings.pop(project_id, None)
            removed = True
            break
    if not removed:
        for project_id, deleted_binding in list(deleted_bindings.items()):
            if not isinstance(deleted_binding, dict):
                continue
            if _clean_text(deleted_binding.get("documentId")) == document_id and (
                not manuscript_surface_id
                or _clean_text(deleted_binding.get("manuscriptSurfaceId"))
                == manuscript_surface_id
            ):
                deleted_bindings.pop(project_id, None)
                removed = True
                break
    return removed


def update_document_binding_status(
    state: dict[str, Any],
    document_id: str,
    manuscript_surface_id: str = "",
    status: str = "active",
    stale_reason: str = "",
    tab_id: str = "",
    tab_title: str = "",
) -> dict[str, Any] | None:
    document_id = _clean_text(document_id)
    manuscript_surface_id = _clean_text(manuscript_surface_id)
    status = _clean_text(status) or "active"
    if status not in {
        "active",
        "stale_missing_doc",
        "stale_inaccessible",
        "stale_missing_tab",
    }:
        raise ExtensionBridgeError("Invalid binding status.")
    if not document_id:
        raise ExtensionBridgeError("documentId is required.")

    bindings = _bindings(state)
    deleted_bindings = _deleted_bindings(state)
    for key in _binding_lookup_keys(document_id, manuscript_surface_id):
        binding = bindings.get(key)
        project_id = _binding_project_id(binding)
        if not project_id:
            continue
        if not isinstance(binding, dict):
            binding = _binding_record(
                document_id=document_id,
                tab_id=tab_id,
                tab_title=tab_title,
                manuscript_surface_id=manuscript_surface_id,
                project_id=project_id,
            )
        now = datetime.now(timezone.utc).isoformat()
        binding.update(
            {
                "documentId": _clean_text(binding.get("documentId")) or document_id,
                "tabId": _clean_text(binding.get("tabId")) or _clean_text(tab_id),
                "tabTitle": _clean_text(binding.get("tabTitle"))
                or _clean_text(tab_title),
                "manuscriptSurfaceId": _clean_text(binding.get("manuscriptSurfaceId"))
                or manuscript_surface_id
                or _binding_key(document_id, manuscript_surface_id),
                "projectId": project_id,
                "status": status,
                "staleReason": "" if status == "active" else _clean_text(stale_reason),
                "lastValidatedAt": now,
                "createdAt": _clean_text(binding.get("createdAt")) or now,
                "updatedAt": now,
            }
        )
        if status == "active":
            bindings[key] = binding
            deleted_bindings.pop(project_id, None)
        else:
            deleted_bindings[project_id] = _deleted_binding_record(
                binding,
                status,
                stale_reason,
                document_id=document_id,
                manuscript_surface_id=manuscript_surface_id,
                tab_id=tab_id,
                tab_title=tab_title,
            )
            bindings.pop(key, None)
        return binding
    return None


def create_extension_project(
    state: dict[str, Any], payload: dict[str, Any]
) -> dict[str, Any]:
    title = _clean_text(payload.get("title") or payload.get("bookTitle"))
    manuscript_type = _clean_text(payload.get("manuscriptType")) or "Novel"
    structure_unit_label = (
        _clean_text(payload.get("structureUnit") or payload.get("structureUnitLabel"))
        or "Chapter"
    )
    target_word_count = _non_negative_int(payload.get("targetWordCount") or 80000)
    if "wordsWrittenSoFar" in payload:
        current_word_count = _parse_non_negative_int(
            payload.get("wordsWrittenSoFar"), "wordsWrittenSoFar"
        )
    elif "currentWordCount" in payload:
        current_word_count = _parse_non_negative_int(
            payload.get("currentWordCount"), "currentWordCount"
        )
    else:
        current_word_count = 0
    deadline = _clean_text(payload.get("deadline"))

    if not title:
        raise ExtensionBridgeError("Project title is required.")
    if target_word_count <= 0:
        raise ExtensionBridgeError("Target word count must be positive.")

    project_id = f"project-{uuid4()}"
    project = {
        "id": project_id,
        "source": "chrome-extension",
        "extensionCreatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "active",
        "archivedAt": "",
        "project": {
            "bookTitle": title,
            "manuscriptType": manuscript_type,
            "structureUnitLabel": structure_unit_label,
            "targetWordCount": target_word_count,
            "currentWordCount": current_word_count,
            "startingWordCount": None,
            "baselineEstablished": False,
            "startingWordCountSource": "provisional",
            "startingWordCountEstablishedAt": "",
            "deadline": deadline,
            "dailyTarget": 1000,
            "projectStartDate": datetime.now(timezone.utc).date().isoformat(),
        },
        "completion": {},
        "publication": {},
        "editing": {},
        "plot": {},
        "goals": [],
        "snapshots": [],
        "sessions": [],
        "issues": [],
        "milestones": [],
    }
    state.setdefault("projects", []).append(project)
    if not state.get("activeProjectId"):
        state["activeProjectId"] = project_id
    return _project_summary(project)


def _project_for_extension_issue(
    state: dict[str, Any],
    document_id: str,
    project_id: str,
    manuscript_surface_id: str = "",
    tab_id: str = "",
    tab_title: str = "",
) -> dict[str, Any]:
    bindings = _bindings(state)
    binding_key = _binding_key(document_id, manuscript_surface_id)
    bound_project_id = _lookup_bound_project_id(
        bindings, document_id, manuscript_surface_id
    )
    if bound_project_id and project_id and bound_project_id != project_id:
        raise DocumentBindingConflictError("Document is bound to a different project.")
    if manuscript_surface_id and not bound_project_id:
        raise DocumentBindingConflictError("Manuscript surface is not bound.")

    resolved_project_id = bound_project_id or project_id
    if not resolved_project_id:
        raise ExtensionBridgeError("projectId is required for unbound documents.")
    lookup_keys = _binding_lookup_keys(document_id, manuscript_surface_id)
    existing_project_key = _project_binding_key(
        bindings, resolved_project_id, binding_key
    )
    if existing_project_key and existing_project_key not in lookup_keys:
        raise DocumentBindingConflictError("Project is already bound.")

    project = _require_project(state, resolved_project_id)
    if manuscript_surface_id:
        bindings[binding_key] = _binding_record(
            document_id=document_id,
            project_id=resolved_project_id,
            manuscript_surface_id=manuscript_surface_id,
            tab_id=tab_id,
            tab_title=tab_title,
        )
    else:
        bindings[binding_key] = resolved_project_id
    return project


def _normalize_extension_issue(
    project: dict[str, Any], payload: dict[str, Any]
) -> dict[str, Any]:
    note = _normalize_issue_note_text(payload.get("note") or payload.get("notes"))
    if not note:
        raise ExtensionBridgeError("note is required.")

    issue_id = (
        _clean_text(payload.get("extensionIssueId"))
        or _clean_text(payload.get("id"))
        or f"extension-issue-{uuid4()}"
    )
    snippet = _clean_text(payload.get("snippet"))
    created_at = (
        _clean_text(payload.get("createdAt")) or datetime.now(timezone.utc).isoformat()
    )
    raw_status = _clean_text(payload.get("workflowStatus") or payload.get("status"))
    workflow_status = (
        "resolved"
        if raw_status.lower() == "resolved"
        else "in_progress"
        if raw_status.lower() in {"in_progress", "in progress"}
        else "open"
    )
    status = "Resolved" if workflow_status == "resolved" else "Open"
    quote_locator = payload.get("quoteLocator")
    if not isinstance(quote_locator, dict):
        quote_locator = {}

    return {
        "id": issue_id,
        "title": _clean_text(payload.get("title"))
        or _derive_issue_title_from_note(note),
        "type": _clean_text(payload.get("type")) or _derive_issue_type_from_note(note),
        "sectionLabel": _normalize_chapter_label(
            payload.get("sectionLabel") or _derive_issue_section_from_note(note)
        ),
        "priority": _clean_text(payload.get("priority"))
        or _derive_issue_priority_from_note(note),
        "status": status,
        "notes": note,
        "snippet": snippet,
        "createdAt": created_at,
        "resolvedAt": created_at if status == "Resolved" else "",
        "focusKey": _clean_text(payload.get("focusKey"))
        or _clean_text(project.get("editing", {}).get("focusKey"))
        or "revision",
        "passName": "",
        "workflowStatus": workflow_status,
        "textLocation": _clean_text(payload.get("textLocation")),
        "source": _clean_text(payload.get("source")) or "chrome-extension",
        "documentId": _clean_text(payload.get("documentId")),
        "tabId": _clean_text(payload.get("tabId")),
        "tabTitle": _clean_text(payload.get("tabTitle")),
        "manuscriptSurfaceId": _clean_text(payload.get("manuscriptSurfaceId")),
        "manuscriptSurfaceLabel": _clean_text(payload.get("manuscriptSurfaceLabel")),
        "documentUrl": _clean_text(payload.get("documentUrl")),
        "extensionIssueId": issue_id,
        "quoteLocator": {
            "strategy": _clean_text(quote_locator.get("strategy")) or "quote-finder",
            "quote": _clean_text(quote_locator.get("quote")) or snippet,
            "createdAt": _clean_text(quote_locator.get("createdAt")) or created_at,
        },
    }


def append_extension_issue(
    state: dict[str, Any], payload: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any], bool]:
    if not isinstance(payload, dict):
        raise ExtensionBridgeError("JSON body is required.")

    document_id = _clean_text(payload.get("documentId"))
    manuscript_surface_id = _clean_text(payload.get("manuscriptSurfaceId"))
    tab_id = _clean_text(payload.get("tabId"))
    tab_title = _clean_text(payload.get("tabTitle"))
    project_id = _clean_text(payload.get("projectId"))
    if not document_id:
        raise ExtensionBridgeError("documentId is required.")

    project = _project_for_extension_issue(
        state, document_id, project_id, manuscript_surface_id, tab_id, tab_title
    )
    issue_payload = {
        **payload,
        "documentId": document_id,
        "manuscriptSurfaceId": manuscript_surface_id,
        "documentUrl": _clean_text(payload.get("documentUrl")),
    }
    issue = _normalize_extension_issue(project, issue_payload)
    issues = project.setdefault("issues", [])
    existing_issue = next(
        (
            item
            for item in issues
            if isinstance(item, dict)
            and (
                item.get("extensionIssueId") == issue["extensionIssueId"]
                or item.get("id") == issue["id"]
            )
        ),
        None,
    )
    if existing_issue:
        for key, value in issue.items():
            if (
                key in ISSUE_META_FIELDS
                or key not in existing_issue
                or existing_issue.get(key) in {"", None}
            ):
                existing_issue[key] = value
        return existing_issue, _project_summary(project), True

    issues.insert(0, issue)
    return issue, _project_summary(project), False


def get_extension_issues(
    state: dict[str, Any], document_id: str, manuscript_surface_id: str = ""
) -> tuple[list[dict[str, Any]], dict[str, Any] | None, bool]:
    manuscript_surface_id = _clean_text(manuscript_surface_id)
    project, changed = get_document_binding(state, document_id, manuscript_surface_id)
    if not project:
        return [], None, changed

    project_bundle = _find_project(state, project["id"])

    def issue_matches_surface(issue: dict[str, Any]) -> bool:
        if not manuscript_surface_id:
            return True
        issue_surface_id = _clean_text(issue.get("manuscriptSurfaceId"))
        if issue_surface_id:
            return issue_surface_id == manuscript_surface_id
        return manuscript_surface_id == _default_surface_id(
            document_id
        ) and _clean_text(issue.get("documentId")) == _clean_text(document_id)

    issues = [
        issue
        for issue in project_bundle.get("issues", [])
        if isinstance(issue, dict)
        and issue.get("status") != "Resolved"
        and issue_matches_surface(issue)
    ]
    return issues, project, changed


def append_extension_session(
    state: dict[str, Any], payload: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any], bool]:
    if not isinstance(payload, dict):
        raise ExtensionBridgeError("JSON body is required.")

    document_id = _clean_text(payload.get("documentId"))
    tab_id = _clean_text(payload.get("tabId"))
    tab_title = _clean_text(payload.get("tabTitle"))
    manuscript_surface_id = _clean_text(payload.get("manuscriptSurfaceId"))
    manuscript_surface_label = _clean_text(payload.get("manuscriptSurfaceLabel"))
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
    word_count_method = _clean_text(payload.get("wordCountMethod"))
    measurement_pending = bool(payload.get("measurementPending"))
    has_start_document_word_count = "startDocumentWordCount" in payload
    has_end_document_word_count = "endDocumentWordCount" in payload
    if has_start_document_word_count != has_end_document_word_count:
        raise ExtensionBridgeError(
            "startDocumentWordCount and endDocumentWordCount are required together."
        )
    start_document_word_count = (
        _parse_non_negative_int(
            payload.get("startDocumentWordCount"), "startDocumentWordCount"
        )
        if has_start_document_word_count
        else 0
    )
    end_document_word_count = (
        _parse_non_negative_int(
            payload.get("endDocumentWordCount"), "endDocumentWordCount"
        )
        if has_end_document_word_count
        else 0
    )
    words_added = _non_negative_int(payload.get("wordsAdded"))
    words_removed = _non_negative_int(payload.get("wordsRemoved"))
    has_document_word_counts = (
        has_start_document_word_count and has_end_document_word_count
    )
    has_net_words_changed = "netWordsChanged" in payload or has_document_word_counts
    net_words_changed = (
        end_document_word_count - start_document_word_count
        if has_document_word_counts
        else _int_value(payload.get("netWordsChanged"))
        if "netWordsChanged" in payload
        else 0
    )
    has_word_breakdown = "wordsAdded" in payload or "wordsRemoved" in payload
    words_written = (
        _non_negative_int(payload.get("wordsWritten"))
        if session_type == "writing"
        else 0
    )
    if session_type == "editing":
        words_edited = (
            words_added + words_removed
            if has_word_breakdown
            else _non_negative_int(payload.get("wordsEdited"))
        )
        if has_word_breakdown and not has_net_words_changed:
            net_words_changed = words_added - words_removed
            has_net_words_changed = True
        if not has_word_breakdown and has_net_words_changed:
            derived_words_added, derived_words_removed = _derive_word_breakdown(
                words_edited, net_words_changed
            )
            if derived_words_added + derived_words_removed == words_edited:
                words_added = derived_words_added
                words_removed = derived_words_removed
                has_word_breakdown = True
    else:
        words_edited = 0

    bindings = _bindings(state)
    binding_key = _binding_key(document_id, manuscript_surface_id)
    bound_project_id = _lookup_bound_project_id(
        bindings, document_id, manuscript_surface_id
    )
    if bound_project_id and bound_project_id != project_id:
        raise DocumentBindingConflictError("Document is bound to a different project.")
    if manuscript_surface_id and not bound_project_id:
        raise DocumentBindingConflictError("Manuscript surface is not bound.")
    lookup_keys = _binding_lookup_keys(document_id, manuscript_surface_id)
    existing_project_key = _project_binding_key(bindings, project_id, binding_key)
    if existing_project_key and existing_project_key not in lookup_keys:
        raise DocumentBindingConflictError("Project is already bound.")

    project = _require_project(state, project_id)
    sessions = project.setdefault("sessions", [])
    normalized_type = "write" if session_type == "writing" else "edit"
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
        existing_has_word_count_snapshot = (
            _session_end_word_count(existing_session) is not None
        )
        existing_net_words_changed = (
            _int_value(existing_session.get("netWordsChanged"))
            if not existing_has_word_count_snapshot
            else 0
        )
        if word_count_method:
            existing_session["wordCountMethod"] = word_count_method
        if "startDocumentWordCount" in payload:
            existing_session["startDocumentWordCount"] = start_document_word_count
        if "endDocumentWordCount" in payload:
            existing_session["endDocumentWordCount"] = end_document_word_count
            if not measurement_pending:
                _set_project_current_word_count(project, end_document_word_count)
        if "netWordsChanged" in payload:
            existing_session["netWordsChanged"] = net_words_changed
        if "measurementPending" in payload:
            existing_session["measurementPending"] = measurement_pending
        for key, value in {
            "tabId": tab_id,
            "tabTitle": tab_title,
            "manuscriptSurfaceId": manuscript_surface_id,
            "manuscriptSurfaceLabel": manuscript_surface_label,
        }.items():
            if value:
                existing_session[key] = value
        if normalized_type == "write":
            existing_words_written = _non_negative_int(
                existing_session.get("wordsWritten")
            )
            if words_written > existing_words_written:
                existing_session["wordsWritten"] = words_written
                if "endDocumentWordCount" not in payload:
                    _add_project_words(project, words_written - existing_words_written)
        elif normalized_type == "edit":
            existing_words_edited = _non_negative_int(
                existing_session.get("wordsEdited")
            )
            if has_word_breakdown and (
                words_edited >= existing_words_edited
                or not (
                    _non_negative_int(existing_session.get("wordsAdded"))
                    or _non_negative_int(existing_session.get("wordsRemoved"))
                )
            ):
                existing_session["wordsAdded"] = words_added
                existing_session["wordsRemoved"] = words_removed
                existing_session["wordsEdited"] = words_edited
            if words_edited > existing_words_edited:
                existing_session["wordsEdited"] = words_edited
            if (
                "endDocumentWordCount" not in payload
                and has_net_words_changed
                and not measurement_pending
            ):
                _apply_project_word_delta(
                    project,
                    net_words_changed - existing_net_words_changed,
                )
        return existing_session, _project_summary(project), True

    if manuscript_surface_id:
        bindings[binding_key] = _binding_record(
            document_id=document_id,
            tab_id=tab_id,
            tab_title=tab_title,
            manuscript_surface_id=manuscript_surface_id,
            project_id=project_id,
        )
    else:
        bindings[binding_key] = project_id
    session = {
        "id": extension_session_id or f"extension-{uuid4()}",
        "type": normalized_type,
        "date": ended_at,
        "startedAt": started_at,
        "endedAt": ended_at,
        "durationMinutes": duration_minutes,
        "wordsWritten": words_written,
        "wordsEdited": words_edited,
        "wordsAdded": words_added,
        "wordsRemoved": words_removed,
        "netWordsChanged": net_words_changed,
        "notes": notes,
        "source": source,
        "documentId": document_id,
        "tabId": tab_id,
        "tabTitle": tab_title,
        "manuscriptSurfaceId": manuscript_surface_id,
        "manuscriptSurfaceLabel": manuscript_surface_label,
        "documentUrl": document_url,
        "extensionSessionId": extension_session_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "wordCountMethod": word_count_method,
        "measurementPending": measurement_pending,
        "startDocumentWordCount": start_document_word_count,
        "endDocumentWordCount": end_document_word_count,
    }

    if normalized_type == "edit":
        session["passName"] = _current_editing_pass_name(project)
        session["sectionLabel"] = ""
    else:
        session["passName"] = ""
        session["sectionLabel"] = ""
        if "endDocumentWordCount" not in payload:
            _add_project_words(project, words_written)

    if "endDocumentWordCount" in payload and not measurement_pending:
        _set_project_current_word_count(project, end_document_word_count)
    elif (
        normalized_type == "edit" and has_net_words_changed and not measurement_pending
    ):
        _apply_project_word_delta(project, net_words_changed)

    sessions.append(session)
    return session, _project_summary(project), False


def preserve_extension_sessions(
    incoming_state: dict[str, Any], existing_state: dict[str, Any]
) -> dict[str, Any]:
    """Keep extension-created entries when an older app tab saves stale state."""
    if not isinstance(incoming_state, dict) or not isinstance(existing_state, dict):
        return incoming_state

    incoming_projects = incoming_state.get("projects")
    existing_projects = existing_state.get("projects")
    if not isinstance(incoming_projects, list) or not isinstance(
        existing_projects, list
    ):
        return incoming_state

    existing_by_id = {
        project.get("id"): project
        for project in existing_projects
        if isinstance(project, dict) and project.get("id")
    }
    incoming_ids = {
        project.get("id")
        for project in incoming_projects
        if isinstance(project, dict) and project.get("id")
    }
    deleted_project_ids = _deleted_extension_project_ids(incoming_state)
    bound_project_ids = _extension_binding_project_ids(existing_state)

    if deleted_project_ids:
        bindings = _bindings(incoming_state)
        for key, binding in list(bindings.items()):
            if _binding_project_id(binding) in deleted_project_ids:
                bindings.pop(key, None)

    for project_id, existing_project in existing_by_id.items():
        if (
            project_id
            and project_id not in incoming_ids
            and project_id not in deleted_project_ids
            and (
                _is_extension_created_project(existing_project)
                or project_id in bound_project_ids
            )
        ):
            incoming_projects.append(existing_project)
            incoming_ids.add(project_id)

    for incoming_project in incoming_projects:
        if not isinstance(incoming_project, dict):
            continue

        existing_project = existing_by_id.get(incoming_project.get("id"))
        if not existing_project:
            continue

        incoming_sessions = incoming_project.setdefault("sessions", [])
        existing_sessions = existing_project.get("sessions", [])
        if not isinstance(incoming_sessions, list) or not isinstance(
            existing_sessions, list
        ):
            continue

        deleted_session_ids = _deleted_extension_session_ids(incoming_state)
        if deleted_session_ids:
            incoming_sessions[:] = [
                session
                for session in incoming_sessions
                if not (
                    isinstance(session, dict)
                    and (session.get("extensionSessionId") or session.get("id"))
                    in deleted_session_ids
                )
            ]

        incoming_ids = {
            session.get("extensionSessionId") or session.get("id")
            for session in incoming_sessions
            if isinstance(session, dict)
        }
        extension_sessions = [
            session
            for session in existing_sessions
            if isinstance(session, dict)
            and (session.get("extensionSessionId") or session.get("id"))
            and (
                session.get("source") == "chrome-extension"
                or session.get("extensionSessionId")
            )
            and (session.get("extensionSessionId") or session.get("id"))
            not in deleted_session_ids
        ]
        extension_sessions_by_id = {
            session.get("extensionSessionId") or session.get("id"): session
            for session in extension_sessions
        }

        for incoming_session in incoming_sessions:
            if not isinstance(incoming_session, dict):
                continue
            session_id = incoming_session.get(
                "extensionSessionId"
            ) or incoming_session.get("id")
            existing_session = extension_sessions_by_id.get(session_id)
            if not existing_session:
                continue
            _preserve_extension_session_metrics(
                incoming_project, incoming_session, existing_session
            )

        for session in extension_sessions:
            session_id = session.get("extensionSessionId") or session.get("id")
            if session_id not in incoming_ids:
                incoming_sessions.append(session)
                incoming_ids.add(session_id)
                if session.get("type") == "write":
                    project_bundle = incoming_project.get("project")
                    if isinstance(project_bundle, dict):
                        project_bundle["currentWordCount"] = _non_negative_int(
                            project_bundle.get("currentWordCount")
                        ) + _non_negative_int(session.get("wordsWritten"))
                elif (
                    session.get("type") == "edit"
                    and _session_end_word_count(session) is None
                    and not session.get("measurementPending")
                ):
                    _apply_project_word_delta(
                        incoming_project,
                        _int_value(session.get("netWordsChanged")),
                    )

        incoming_issues = incoming_project.setdefault("issues", [])
        existing_issues = existing_project.get("issues", [])
        if not isinstance(incoming_issues, list) or not isinstance(
            existing_issues, list
        ):
            continue

        incoming_issue_ids = {
            issue.get("extensionIssueId") or issue.get("id")
            for issue in incoming_issues
            if isinstance(issue, dict)
        }
        extension_issues = [
            issue
            for issue in existing_issues
            if isinstance(issue, dict)
            and (issue.get("extensionIssueId") or issue.get("id"))
            and (
                issue.get("source") == "chrome-extension"
                or issue.get("extensionIssueId")
            )
        ]
        extension_issues_by_id = {
            issue.get("extensionIssueId") or issue.get("id"): issue
            for issue in extension_issues
        }

        for incoming_issue in incoming_issues:
            if not isinstance(incoming_issue, dict):
                continue
            issue_id = incoming_issue.get("extensionIssueId") or incoming_issue.get(
                "id"
            )
            existing_issue = extension_issues_by_id.get(issue_id)
            if not existing_issue:
                continue
            for field in ISSUE_META_FIELDS:
                if field not in incoming_issue and field in existing_issue:
                    incoming_issue[field] = existing_issue[field]

        for issue in extension_issues:
            issue_id = issue.get("extensionIssueId") or issue.get("id")
            if issue_id not in incoming_issue_ids:
                incoming_issues.insert(0, issue)
                incoming_issue_ids.add(issue_id)

        _sync_project_word_count_to_latest_extension_snapshot(incoming_project)

    return incoming_state
