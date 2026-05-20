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
    if not word_tokens or not all(token in ISSUE_SECTION_NUMBER_WORDS for token in word_tokens):
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


def _deleted_extension_session_ids(state: dict[str, Any]) -> set[str]:
    session_ids = state.get("deletedExtensionSessionIds")
    if not isinstance(session_ids, list):
        return set()
    return {_clean_text(session_id) for session_id in session_ids if _clean_text(session_id)}


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


def _int_value(value: Any) -> int:
    try:
        return round(float(value))
    except (TypeError, ValueError):
        return 0


def _derive_word_breakdown(total_activity: int, net_words_changed: int) -> tuple[int, int]:
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


def _session_end_word_count(session: dict[str, Any]) -> int | None:
    if not isinstance(session, dict):
        return None
    if session.get("measurementPending"):
        return None
    if _clean_text(session.get("wordCountMethod")) != "google-docs-api":
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
            and (session.get("source") == "chrome-extension" or session.get("extensionSessionId"))
            and _session_end_word_count(session) is not None
        ),
        key=_session_timestamp,
        default=None,
    )
    latest_word_count = _session_end_word_count(latest_session) if latest_session else None
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
    existing_has_word_count_snapshot = _session_end_word_count(existing_session) is not None

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


def _project_for_extension_issue(
    state: dict[str, Any], document_id: str, project_id: str
) -> dict[str, Any]:
    bindings = _bindings(state)
    bound_project_id = bindings.get(document_id)
    if bound_project_id and project_id and bound_project_id != project_id:
        raise DocumentBindingConflictError("Document is bound to a different project.")

    resolved_project_id = bound_project_id or project_id
    if not resolved_project_id:
        raise ExtensionBridgeError("projectId is required for unbound documents.")

    project = _require_project(state, resolved_project_id)
    bindings[document_id] = resolved_project_id
    return project


def _normalize_extension_issue(
    project: dict[str, Any], payload: dict[str, Any]
) -> dict[str, Any]:
    note = _normalize_issue_note_text(payload.get("note") or payload.get("notes"))
    if not note:
        raise ExtensionBridgeError("note is required.")

    issue_id = _clean_text(payload.get("extensionIssueId")) or _clean_text(
        payload.get("id")
    ) or f"extension-issue-{uuid4()}"
    snippet = _clean_text(payload.get("snippet"))
    created_at = _clean_text(payload.get("createdAt")) or datetime.now(
        timezone.utc
    ).isoformat()
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
        "title": _clean_text(payload.get("title")) or _derive_issue_title_from_note(note),
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
    project_id = _clean_text(payload.get("projectId"))
    if not document_id:
        raise ExtensionBridgeError("documentId is required.")

    project = _project_for_extension_issue(state, document_id, project_id)
    issue_payload = {
        **payload,
        "documentId": document_id,
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
            if key in ISSUE_META_FIELDS or key not in existing_issue or existing_issue.get(key) in {"", None}:
                existing_issue[key] = value
        return existing_issue, _project_summary(project), True

    issues.insert(0, issue)
    return issue, _project_summary(project), False


def get_extension_issues(
    state: dict[str, Any], document_id: str
) -> tuple[list[dict[str, Any]], dict[str, Any] | None, bool]:
    project, changed = get_document_binding(state, document_id)
    if not project:
        return [], None, changed

    project_bundle = _find_project(state, project["id"])
    issues = [
        issue
        for issue in project_bundle.get("issues", [])
        if isinstance(issue, dict)
        and issue.get("status") != "Resolved"
    ]
    return issues, project, changed


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
    word_count_method = _clean_text(payload.get("wordCountMethod"))
    measurement_pending = bool(payload.get("measurementPending"))
    start_document_word_count = _non_negative_int(payload.get("startDocumentWordCount"))
    end_document_word_count = _non_negative_int(payload.get("endDocumentWordCount"))
    words_added = _non_negative_int(payload.get("wordsAdded"))
    words_removed = _non_negative_int(payload.get("wordsRemoved"))
    has_document_word_counts = (
        "startDocumentWordCount" in payload or "endDocumentWordCount" in payload
    )
    has_net_words_changed = "netWordsChanged" in payload or has_document_word_counts
    net_words_changed = (
        _int_value(payload.get("netWordsChanged"))
        if "netWordsChanged" in payload
        else end_document_word_count - start_document_word_count
        if has_document_word_counts
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
    bound_project_id = bindings.get(document_id)
    if bound_project_id and bound_project_id != project_id:
        raise DocumentBindingConflictError("Document is bound to a different project.")

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
        existing_has_word_count_snapshot = _session_end_word_count(existing_session) is not None
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

    bindings[document_id] = project_id
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
    elif normalized_type == "edit" and has_net_words_changed and not measurement_pending:
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
            session_id = incoming_session.get("extensionSessionId") or incoming_session.get(
                "id"
            )
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
