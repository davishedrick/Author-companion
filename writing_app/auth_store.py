import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from state_store import get_connection


PASSWORD_RESET_TOKEN_TTL_SECONDS = 60 * 60


def normalize_email(email):
    return str(email or "").strip().lower()


def _utcnow():
    return datetime.now(timezone.utc)


def _serialize_timestamp(value):
    return value.astimezone(timezone.utc).isoformat()


def _parse_timestamp(value):
    if not value:
        return None

    parsed = datetime.fromisoformat(str(value))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _hash_reset_token(token):
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()


def _validate_password(password):
    password = str(password or "")
    if len(password) < 8:
        raise ValueError("Use a password with at least 8 characters.")
    return password


def get_user_count():
    with get_connection() as connection:
        row = connection.execute("SELECT COUNT(*) AS count FROM users").fetchone()
    return int(row["count"]) if row else 0


def has_users():
    return get_user_count() > 0


def get_user_by_id(user_id):
    if not user_id:
        return None

    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, email, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

    return dict(row) if row else None


def get_user_by_email(email):
    normalized_email = normalize_email(email)
    if not normalized_email:
        return None

    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, email, created_at FROM users WHERE email = ?",
            (normalized_email,),
        ).fetchone()

    return dict(row) if row else None


def authenticate_user(email, password):
    normalized_email = normalize_email(email)
    if not normalized_email or not password:
        return None

    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, email, password_hash, created_at FROM users WHERE email = ?",
            (normalized_email,),
        ).fetchone()

    if not row or not check_password_hash(row["password_hash"], password):
        return None

    return {
        "id": row["id"],
        "email": row["email"],
        "created_at": row["created_at"],
    }


def create_user(email, password):
    normalized_email = normalize_email(email)
    password = _validate_password(password)

    if not normalized_email:
        raise ValueError("Enter an email address to create your account.")

    password_hash = generate_password_hash(password)

    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id FROM users WHERE email = ?",
            (normalized_email,),
        ).fetchone()
        if existing:
            raise ValueError("That email is already registered.")

        cursor = connection.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (normalized_email, password_hash),
        )
        connection.commit()
        user_id = cursor.lastrowid

    return get_user_by_id(user_id)


def update_user_password(user_id, password):
    if not user_id:
        raise ValueError("Unable to update that account.")

    password_hash = generate_password_hash(_validate_password(password))

    with get_connection() as connection:
        connection.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (password_hash, user_id),
        )
        connection.commit()


def create_password_reset_token(email, ttl_seconds=PASSWORD_RESET_TOKEN_TTL_SECONDS):
    user = get_user_by_email(email)
    if not user:
        return None

    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_reset_token(raw_token)
    expires_at = _serialize_timestamp(
        _utcnow() + timedelta(seconds=max(60, int(ttl_seconds)))
    )

    with get_connection() as connection:
        connection.execute(
            "DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at <= ?",
            (user["id"], _serialize_timestamp(_utcnow())),
        )
        connection.execute(
            """
            INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
            VALUES (?, ?, ?)
            """,
            (user["id"], token_hash, expires_at),
        )
        connection.commit()

    return {
        "token": raw_token,
        "user": user,
        "expires_at": expires_at,
    }


def get_password_reset_token_status(token):
    if not str(token or "").strip():
        return {"valid": False, "error": "This password reset link is no longer valid."}

    token_hash = _hash_reset_token(token)

    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT password_reset_tokens.id,
                   password_reset_tokens.user_id,
                   password_reset_tokens.expires_at,
                   password_reset_tokens.used_at,
                   users.email
            FROM password_reset_tokens
            JOIN users ON users.id = password_reset_tokens.user_id
            WHERE password_reset_tokens.token_hash = ?
            """,
            (token_hash,),
        ).fetchone()

    if not row:
        return {"valid": False, "error": "This password reset link is no longer valid."}

    if row["used_at"]:
        return {
            "valid": False,
            "error": "This password reset link has already been used.",
        }

    expires_at = _parse_timestamp(row["expires_at"])
    if not expires_at or expires_at <= _utcnow():
        return {"valid": False, "error": "This password reset link has expired."}

    return {
        "valid": True,
        "token_id": row["id"],
        "user_id": row["user_id"],
        "email": row["email"],
        "expires_at": row["expires_at"],
    }


def reset_password_with_token(token, password):
    status = get_password_reset_token_status(token)
    if not status["valid"]:
        raise ValueError(status["error"])

    password_hash = generate_password_hash(_validate_password(password))
    used_at = _serialize_timestamp(_utcnow())

    with get_connection() as connection:
        connection.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (password_hash, status["user_id"]),
        )
        connection.execute(
            "UPDATE password_reset_tokens SET used_at = ? WHERE id = ?",
            (used_at, status["token_id"]),
        )
        connection.commit()

    return get_user_by_id(status["user_id"])
