import os
import smtplib
from email.message import EmailMessage
from functools import wraps

from flask import Flask, jsonify, redirect, render_template, request, session, url_for

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
from state_store import load_state, save_state

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "author-engine-dev-secret")
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
    return get_user_by_id(session.get("user_id"))


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


@app.route("/")
@login_required
def home():
    return render_template("index.html")


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
    message["Subject"] = "Reset your Author Engine password"
    message["From"] = sender or "no-reply@author-engine.local"
    message["To"] = recipient_email
    message.set_content(
        "\n".join(
            [
                "A password reset was requested for your Author Engine account.",
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
    return jsonify(save_state(payload, session.get("user_id")))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(debug=True, port=port)
