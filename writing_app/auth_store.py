from werkzeug.security import check_password_hash, generate_password_hash

from state_store import get_connection


def normalize_email(email):
    return str(email or "").strip().lower()


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
    password = str(password or "")

    if not normalized_email:
        raise ValueError("Enter an email address to create your account.")
    if len(password) < 8:
        raise ValueError("Use a password with at least 8 characters.")

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
