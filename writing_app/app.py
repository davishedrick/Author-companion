import os
from functools import wraps

from flask import Flask, jsonify, redirect, render_template, request, session, url_for

from auth_store import authenticate_user, create_user, get_user_by_id, has_users
from state_store import load_state, save_state

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "author-engine-dev-secret")


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


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user():
        return redirect(url_for("home"))

    setup_mode = not has_users()
    error = None

    if request.method == "POST":
        email = request.form.get("email", "")
        password = request.form.get("password", "")

        try:
            if setup_mode:
                user = create_user(email, password)
            else:
                user = authenticate_user(email, password)
                if not user:
                    raise ValueError("That email and password combination did not match.")
        except ValueError as exc:
            error = str(exc)
        else:
            session.clear()
            session["user_id"] = user["id"]
            return redirect(url_for("home"))

    return render_template("login.html", error=error, setup_mode=setup_mode)


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
