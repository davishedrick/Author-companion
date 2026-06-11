import os
import smtplib
from email.message import EmailMessage
from functools import wraps

from flask import (
    Flask,
    jsonify,
    make_response,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from auth_store import (
    PASSWORD_RESET_TOKEN_TTL_SECONDS,
    authenticate_user,
    create_password_reset_token,
    create_user,
    get_password_reset_token_status,
    get_user_by_id,
    has_users,
    reset_password_with_token,
)
from extension_bridge import (
    ExtensionBridgeError,
    append_extension_issue,
    append_extension_session,
    create_extension_project,
    delete_document_binding,
    get_active_projects,
    get_document_binding,
    get_extension_projects,
    get_extension_issues,
    preserve_extension_sessions,
    save_document_binding,
    update_document_binding_status,
)
from state_store import load_state, save_state

app = Flask(__name__)
SCRIPTOR_SESSION_HEADER = "X-Scriptor-Session"
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "scriptor-dev-secret")
app.config["SESSION_COOKIE_SAMESITE"] = os.environ.get(
    "SESSION_COOKIE_SAMESITE", "None"
)
app.config["SESSION_COOKIE_SECURE"] = (
    os.environ.get("SESSION_COOKIE_SECURE", "true").lower() != "false"
)
app.config["MAIL_HOST"] = os.environ.get("MAIL_HOST", "smtp.gmail.com").strip()
app.config["MAIL_PORT"] = int(os.environ.get("MAIL_PORT", "587"))
app.config["MAIL_USERNAME"] = os.environ.get(
    "MAIL_USERNAME",
    os.environ.get("GMAIL_ADDRESS", ""),
).strip()
app.config["MAIL_PASSWORD"] = os.environ.get(
    "MAIL_PASSWORD",
    os.environ.get("GMAIL_APP_PASSWORD", ""),
)
app.config["MAIL_SENDER"] = os.environ.get(
    "MAIL_SENDER", app.config["MAIL_USERNAME"]
).strip()
app.config["MAIL_USE_TLS"] = os.environ.get("MAIL_USE_TLS", "true").lower() != "false"
app.config["MAIL_USE_SSL"] = os.environ.get("MAIL_USE_SSL", "false").lower() == "true"
app.config["PASSWORD_RESET_TOKEN_TTL_SECONDS"] = int(
    os.environ.get(
        "PASSWORD_RESET_TOKEN_TTL_SECONDS", str(PASSWORD_RESET_TOKEN_TTL_SECONDS)
    )
)


def current_user():
    return get_user_by_id(current_user_id())


def current_user_id():
    return session.get("user_id") or extension_session_user_id()


def extension_session_user_id():
    if not (
        request.path.startswith("/api/extension/") or request.path == "/api/projects"
    ):
        return None
    cookie_value = request.headers.get(SCRIPTOR_SESSION_HEADER, "").strip()
    if not cookie_value:
        return None
    serializer = app.session_interface.get_signing_serializer(app)
    if not serializer:
        return None
    try:
        session_data = serializer.loads(cookie_value)
    except Exception:
        return None
    return session_data.get("user_id")


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        user = current_user()
        if not user:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required"}), 401
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped_view


def extension_api_response(payload=None, status=200):
    response = make_response(jsonify(payload or {}), status)
    add_extension_cors_headers(response)
    return response


def is_allowed_extension_origin(origin):
    return (
        origin == "https://docs.google.com"
        or origin.startswith("chrome-extension://")
        or origin.startswith("http://localhost")
    )


@app.before_request
def handle_extension_preflight():
    if request.method == "OPTIONS" and (
        request.path.startswith("/api/extension/") or request.path == "/api/projects"
    ):
        return extension_api_response()


@app.after_request
def add_extension_cors_headers(response):
    if not (
        request.path.startswith("/api/extension/") or request.path == "/api/projects"
    ):
        return response

    origin = request.headers.get("Origin", "")
    if is_allowed_extension_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Headers"] = (
        f"Content-Type, {SCRIPTOR_SESSION_HEADER}"
    )
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, POST, OPTIONS"
    return response


@app.route("/")
@login_required
def home():
    return render_template("index.html")


@app.route("/design-system")
@login_required
def design_system():
    return render_template("design_system.html")


def mail_is_configured():
    if isinstance(app.config.get("MAIL_OUTBOX"), list):
        return True
    return bool(
        app.config.get("MAIL_HOST")
        and app.config.get("MAIL_SENDER")
        and app.config.get("MAIL_USERNAME")
        and app.config.get("MAIL_PASSWORD")
    )


def send_password_reset_email(recipient_email, reset_url):
    sender = app.config.get("MAIL_SENDER", "").strip()
    host = app.config.get("MAIL_HOST", "").strip()
    username = app.config.get("MAIL_USERNAME", "").strip()
    password = app.config.get("MAIL_PASSWORD", "")
    port = int(app.config.get("MAIL_PORT", 587))
    use_tls = bool(app.config.get("MAIL_USE_TLS", True))
    use_ssl = bool(app.config.get("MAIL_USE_SSL", False))

    message = EmailMessage()
    message["Subject"] = "Reset your Scriptor password"
    message["From"] = sender or "no-reply@scriptor.local"
    message["To"] = recipient_email
    message.set_content(
        "\n".join(
            [
                "A password reset was requested for your Scriptor account.",
                "",
                f"Open this link to choose a new password: {reset_url}",
                "",
                "If you did not request this change, you can ignore this email.",
            ]
        )
    )

    outbox = app.config.get("MAIL_OUTBOX")
    if isinstance(outbox, list):
        outbox.append(
            {
                "to": recipient_email,
                "from": message["From"],
                "subject": message["Subject"],
                "body": message.get_content(),
            }
        )
        return

    if not host or not sender:
        raise RuntimeError(
            "Password reset email is not configured yet. Set GMAIL_ADDRESS and GMAIL_APP_PASSWORD to enable it."
        )

    smtp_client = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
    with smtp_client(host, port, timeout=10) as smtp:
        if not use_ssl and use_tls:
            smtp.starttls()
        if username:
            smtp.login(username, password)
        smtp.send_message(message)


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user():
        return redirect(url_for("home"))

    setup_mode = not has_users()
    error = None
    notice = None

    if request.args.get("reset") == "success":
        notice = "Your password has been reset. Sign in with your new password."

    if request.method == "POST":
        email = request.form.get("email", "")
        password = request.form.get("password", "")

        try:
            if setup_mode:
                user = create_user(email, password)
            else:
                user = authenticate_user(email, password)
                if not user:
                    raise ValueError(
                        "That email and password combination did not match."
                    )
        except ValueError as exc:
            error = str(exc)
        else:
            session.clear()
            session["user_id"] = user["id"]
            return redirect(url_for("home"))

    return render_template(
        "login.html", error=error, notice=notice, setup_mode=setup_mode
    )


@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if current_user():
        return redirect(url_for("home"))

    setup_mode = not has_users()
    error = None
    notice = None
    email = ""

    if request.method == "POST":
        email = request.form.get("email", "")
        if setup_mode:
            error = "Create your owner account before using password reset."
        elif not mail_is_configured():
            error = "Password reset email is not configured yet. Set GMAIL_ADDRESS and GMAIL_APP_PASSWORD to enable it."
        else:
            try:
                token_bundle = create_password_reset_token(
                    email,
                    ttl_seconds=app.config["PASSWORD_RESET_TOKEN_TTL_SECONDS"],
                )
                if token_bundle:
                    reset_url = url_for(
                        "reset_password",
                        token=token_bundle["token"],
                        _external=True,
                    )
                    send_password_reset_email(token_bundle["user"]["email"], reset_url)
            except Exception:
                app.logger.exception("Unable to send password reset email")
                error = "We couldn't send the reset email right now. Please try again in a moment."
            else:
                notice = (
                    "If that email is registered, a password reset link has been sent."
                )

    return render_template(
        "forgot_password.html",
        email=email,
        error=error,
        notice=notice,
        setup_mode=setup_mode,
    )


@app.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token):
    if current_user():
        return redirect(url_for("home"))

    status = get_password_reset_token_status(token)
    error = None if status["valid"] else status["error"]

    if request.method == "POST":
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        if not status["valid"]:
            error = status["error"]
        elif password != confirm_password:
            error = "Enter the same password in both fields."
        else:
            try:
                reset_password_with_token(token, password)
            except ValueError as exc:
                error = str(exc)
            else:
                return redirect(url_for("login", reset="success"))

    return render_template(
        "reset_password.html",
        error=error,
        token=token,
        token_valid=status["valid"],
    )


@app.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.get("/api/session")
@login_required
def get_session_status():
    user = current_user()
    return jsonify(
        {
            "email": user["email"],
            "authenticated": True,
        }
    )


@app.get("/api/state")
@login_required
def get_state():
    return jsonify(load_state(session.get("user_id")))


@app.put("/api/state")
@login_required
def put_state():
    payload = request.get_json(silent=True)
    existing_state = load_state(session.get("user_id"))
    if isinstance(payload, dict) and "extensionDocumentBindings" not in payload:
        payload["extensionDocumentBindings"] = existing_state.get(
            "extensionDocumentBindings", {}
        )
    if isinstance(payload, dict) and "deletedExtensionSessionIds" not in payload:
        payload["deletedExtensionSessionIds"] = existing_state.get(
            "deletedExtensionSessionIds", []
        )
    if isinstance(payload, dict) and "deletedExtensionProjectIds" not in payload:
        payload["deletedExtensionProjectIds"] = existing_state.get(
            "deletedExtensionProjectIds", []
        )
    if isinstance(payload, dict):
        payload = preserve_extension_sessions(payload, existing_state)
    return jsonify(save_state(payload, session.get("user_id")))


@app.get("/api/projects")
@login_required
def get_projects():
    state = load_state(current_user_id())
    return jsonify({"projects": get_active_projects(state)})


@app.get("/api/extension/projects")
@login_required
def get_extension_project_picker():
    state = load_state(current_user_id())
    return jsonify({"projects": get_extension_projects(state)})


@app.post("/api/extension/projects")
@login_required
def post_extension_project():
    user_id = current_user_id()
    state = load_state(user_id)
    payload = request.get_json(silent=True) or {}
    try:
        project = create_extension_project(state, payload)
    except ExtensionBridgeError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    save_state(state, user_id)
    return jsonify({"project": project}), 201


@app.get("/api/extension/document-binding")
@login_required
def get_extension_document_binding():
    user_id = current_user_id()
    state = load_state(user_id)
    document_id = request.args.get("documentId", "")
    manuscript_surface_id = request.args.get("manuscriptSurfaceId", "")
    try:
        project, changed = get_document_binding(
            state, document_id, manuscript_surface_id
        )
    except ExtensionBridgeError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    if changed:
        save_state(state, user_id)
    return jsonify(
        {
            "documentId": document_id,
            "manuscriptSurfaceId": manuscript_surface_id,
            "project": project,
        }
    )


@app.put("/api/extension/document-binding")
@login_required
def put_extension_document_binding():
    user_id = current_user_id()
    state = load_state(user_id)
    payload = request.get_json(silent=True) or {}
    try:
        project = save_document_binding(
            state,
            payload.get("documentId", ""),
            payload.get("projectId", ""),
            payload.get("manuscriptSurfaceId", ""),
            payload.get("tabId", ""),
            payload.get("tabTitle", ""),
            payload.get("documentTitle", ""),
            payload.get("documentUrl", ""),
            payload.get("verifiedWordCount", payload.get("baselineWordCount")),
            payload.get("verifiedWordCountSource", "google-docs-binding"),
        )
    except ExtensionBridgeError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    save_state(state, user_id)
    return jsonify(
        {
            "documentId": payload.get("documentId", ""),
            "manuscriptSurfaceId": payload.get("manuscriptSurfaceId", ""),
            "project": project,
        }
    )


@app.delete("/api/extension/document-binding")
@login_required
def delete_extension_document_binding():
    user_id = current_user_id()
    state = load_state(user_id)
    payload = request.get_json(silent=True) or {}
    document_id = payload.get("documentId") or request.args.get("documentId", "")
    manuscript_surface_id = payload.get("manuscriptSurfaceId") or request.args.get(
        "manuscriptSurfaceId", ""
    )
    try:
        removed = delete_document_binding(state, document_id, manuscript_surface_id)
    except ExtensionBridgeError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    save_state(state, user_id)
    return jsonify(
        {
            "documentId": document_id,
            "manuscriptSurfaceId": manuscript_surface_id,
            "removed": removed,
        }
    )


@app.patch("/api/extension/document-binding/status")
@login_required
def patch_extension_document_binding_status():
    user_id = current_user_id()
    state = load_state(user_id)
    payload = request.get_json(silent=True) or {}
    try:
        binding = update_document_binding_status(
            state,
            payload.get("documentId", ""),
            payload.get("manuscriptSurfaceId", ""),
            payload.get("status", "active"),
            payload.get("staleReason", ""),
            payload.get("tabId", ""),
            payload.get("tabTitle", ""),
            payload.get("documentTitle", ""),
        )
    except ExtensionBridgeError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    if binding:
        save_state(state, user_id)
    return jsonify({"binding": binding})


@app.post("/api/extension/sessions")
@login_required
def post_extension_session():
    user_id = current_user_id()
    state = load_state(user_id)
    payload = request.get_json(silent=True) or {}
    app.logger.info(
        "[ACE] extension session received: type=%s start=%s end=%s net=%s legacy=(edited=%s added=%s removed=%s)",
        payload.get("sessionType"),
        payload.get("startDocumentWordCount"),
        payload.get("endDocumentWordCount"),
        payload.get("netWordsChanged"),
        payload.get("wordsEdited"),
        payload.get("wordsAdded"),
        payload.get("wordsRemoved"),
    )
    try:
        created_session, project, duplicate = append_extension_session(state, payload)
    except ExtensionBridgeError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    app.logger.info(
        "[ACE] extension session persisted: id=%s type=%s start=%s end=%s net=%s legacy=(edited=%s added=%s removed=%s)",
        created_session.get("id"),
        created_session.get("type"),
        created_session.get("startDocumentWordCount"),
        created_session.get("endDocumentWordCount"),
        created_session.get("netWordsChanged"),
        created_session.get("wordsEdited"),
        created_session.get("wordsAdded"),
        created_session.get("wordsRemoved"),
    )
    save_state(state, user_id)
    return jsonify(
        {
            "session": created_session,
            "project": project,
            "duplicate": duplicate,
        }
    ), 200 if duplicate else 201


@app.get("/api/extension/issues")
@login_required
def get_extension_issue_list():
    user_id = current_user_id()
    state = load_state(user_id)
    document_id = request.args.get("documentId", "")
    manuscript_surface_id = request.args.get("manuscriptSurfaceId", "")
    try:
        issues, project, changed = get_extension_issues(
            state, document_id, manuscript_surface_id
        )
    except ExtensionBridgeError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    if changed:
        save_state(state, user_id)
    return jsonify(
        {
            "documentId": document_id,
            "manuscriptSurfaceId": manuscript_surface_id,
            "project": project,
            "issues": issues,
        }
    )


@app.post("/api/extension/issues")
@login_required
def post_extension_issue():
    user_id = current_user_id()
    state = load_state(user_id)
    try:
        issue, project, duplicate = append_extension_issue(
            state, request.get_json(silent=True) or {}
        )
    except ExtensionBridgeError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    save_state(state, user_id)
    return jsonify(
        {
            "issue": issue,
            "project": project,
            "duplicate": duplicate,
        }
    ), 200 if duplicate else 201


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(debug=True, port=port)
