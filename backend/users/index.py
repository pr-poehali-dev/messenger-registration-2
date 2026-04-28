import json
import os

import psycopg2
from psycopg2.extras import RealDictCursor


DATABASE_URL = os.environ["DATABASE_URL"]
SCHEMA = os.environ["MAIN_DB_SCHEMA"]

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
    "Content-Type": "application/json",
}

VALID_BADGES = {
    "red_black", "blue", "green", "gold",
    "silver", "purple", "pink", "orange", "grey_67",
}


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

def get_conn():
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        cur.execute(f"SET search_path TO {SCHEMA}")
    conn.commit()
    return conn


def response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=str),
    }


def extract_token(event: dict):
    headers = event.get("headers") or {}
    auth = headers.get("X-Authorization") or headers.get("x-authorization") or ""
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def user_row_to_dict(row: dict) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "name": row["name"],
        "avatar_url": row.get("avatar_url"),
        "bio": row.get("bio"),
        "badge": row.get("badge"),
        "badge_label": row.get("badge_label"),
        "is_developer": row.get("is_developer", False),
        "avatar_border": row.get("avatar_border"),
        "is_banned": row.get("is_banned", False),
        "ban_until": row.get("ban_until"),
        "created_at": row.get("created_at"),
        "last_seen": row.get("last_seen"),
    }


# ---------------------------------------------------------------------------
# Table bootstrap
# ---------------------------------------------------------------------------

def ensure_tables(conn):
    with conn.cursor() as cur:
        cur.execute(f"SET search_path TO {SCHEMA}")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            SERIAL PRIMARY KEY,
                username      VARCHAR(64) UNIQUE NOT NULL,
                name          VARCHAR(128) NOT NULL,
                password_hash VARCHAR(64) NOT NULL,
                avatar_url    TEXT,
                bio           TEXT,
                badge         VARCHAR(64),
                badge_label   VARCHAR(128),
                is_developer  BOOLEAN NOT NULL DEFAULT FALSE,
                avatar_border VARCHAR(64),
                is_banned     BOOLEAN NOT NULL DEFAULT FALSE,
                ban_until     TIMESTAMPTZ,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_seen     TIMESTAMPTZ
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token      VARCHAR(64) PRIMARY KEY,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
    conn.commit()


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

def require_auth(event, conn):
    """Returns (user_dict, None) on success or (None, error_response) on failure."""
    token = extract_token(event)
    if not token:
        return None, response(401, {"error": "Missing authorization token"})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT u.*
            FROM users u
            JOIN sessions s ON s.user_id = u.id
            WHERE s.token = %s
            """,
            (token,),
        )
        row = cur.fetchone()

    if not row:
        return None, response(401, {"error": "Invalid or expired token"})

    return dict(row), None


def require_admin(current_user):
    """Returns None if user is admin (id=1), or an error response."""
    if current_user["id"] != 1:
        return response(403, {"error": "Admin access required"})
    return None


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

def handle_search(event, conn, current_user):
    params = event.get("queryStringParameters") or {}
    query = (params.get("q") or "").strip()

    if not query:
        return response(400, {"error": "q parameter is required"})

    pattern = f"%{query}%"

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT *
            FROM users
            WHERE (username ILIKE %s OR name ILIKE %s)
              AND id != %s
            ORDER BY username ASC
            LIMIT 50
            """,
            (pattern, pattern, current_user["id"]),
        )
        rows = cur.fetchall()

    users = [user_row_to_dict(dict(r)) for r in rows]
    return response(200, {"users": users})


def handle_get_user(conn, user_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()

    if not row:
        return response(404, {"error": "User not found"})

    return response(200, {"user": user_row_to_dict(dict(row))})


def handle_update_me(conn, current_user, body):
    allowed_fields = {}

    if "name" in body:
        name = (body["name"] or "").strip()
        if not name:
            return response(400, {"error": "name cannot be empty"})
        allowed_fields["name"] = name

    if "bio" in body:
        allowed_fields["bio"] = body["bio"]  # bio can be empty/null

    if not allowed_fields:
        return response(400, {"error": "No updatable fields provided (name, bio)"})

    set_clauses = ", ".join(f"{col} = %s" for col in allowed_fields)
    values = list(allowed_fields.values()) + [current_user["id"]]

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            f"UPDATE users SET {set_clauses} WHERE id = %s RETURNING *",
            values,
        )
        updated = dict(cur.fetchone())

    conn.commit()
    return response(200, {"user": user_row_to_dict(updated)})


def handle_admin_ban(conn, body):
    user_id = body.get("user_id")
    minutes = body.get("minutes")

    if user_id is None or minutes is None:
        return response(400, {"error": "user_id and minutes are required"})

    user_id = int(user_id)
    minutes = int(minutes)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cur.fetchone():
            return response(404, {"error": "User not found"})

        if minutes == 0:
            cur.execute(
                "UPDATE users SET is_banned = FALSE, ban_until = NULL WHERE id = %s RETURNING *",
                (user_id,),
            )
        else:
            cur.execute(
                """
                UPDATE users
                SET is_banned = TRUE,
                    ban_until = NOW() + (%s || ' minutes')::INTERVAL
                WHERE id = %s
                RETURNING *
                """,
                (minutes, user_id),
            )
        updated = dict(cur.fetchone())

    conn.commit()
    return response(200, {"user": user_row_to_dict(updated)})


def handle_admin_set_badge(conn, body):
    user_id = body.get("user_id")
    badge = (body.get("badge") or "").strip()
    badge_label = body.get("badge_label", "")

    if not user_id:
        return response(400, {"error": "user_id is required"})

    if badge and badge not in VALID_BADGES:
        return response(400, {"error": f"Invalid badge. Valid values: {', '.join(sorted(VALID_BADGES))}"})

    user_id = int(user_id)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cur.fetchone():
            return response(404, {"error": "User not found"})

        cur.execute(
            "UPDATE users SET badge = %s, badge_label = %s WHERE id = %s RETURNING *",
            (badge or None, badge_label or None, user_id),
        )
        updated = dict(cur.fetchone())

    conn.commit()
    return response(200, {"user": user_row_to_dict(updated)})


def handle_admin_set_login(conn, body):
    target_user_id = body.get("target_user_id")
    new_username = (body.get("new_username") or "").strip()

    if not target_user_id or not new_username:
        return response(400, {"error": "target_user_id and new_username are required"})

    target_user_id = int(target_user_id)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id FROM users WHERE id = %s", (target_user_id,))
        if not cur.fetchone():
            return response(404, {"error": "User not found"})

        cur.execute(
            "SELECT id FROM users WHERE username = %s AND id != %s",
            (new_username, target_user_id),
        )
        if cur.fetchone():
            return response(409, {"error": "Username already taken"})

        cur.execute(
            "UPDATE users SET username = %s WHERE id = %s RETURNING *",
            (new_username, target_user_id),
        )
        updated = dict(cur.fetchone())

    conn.commit()
    return response(200, {"user": user_row_to_dict(updated)})


def handle_admin_remove_user(conn, body):
    user_id = body.get("user_id")

    if not user_id:
        return response(400, {"error": "user_id is required"})

    user_id = int(user_id)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cur.fetchone():
            return response(404, {"error": "User not found"})

        # Permanent ban: 100 years
        cur.execute(
            """
            UPDATE users
            SET is_banned = TRUE,
                ban_until = NOW() + INTERVAL '100 years'
            WHERE id = %s
            RETURNING *
            """,
            (user_id,),
        )
        updated = dict(cur.fetchone())

    conn.commit()
    return response(200, {"user": user_row_to_dict(updated)})


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

def handler(event: dict, context) -> dict:
    method = (event.get("httpMethod") or "").upper()
    path = (event.get("path") or "").rstrip("/") or "/"

    # Always handle preflight first
    if method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": CORS_HEADERS,
            "body": "",
        }

    conn = get_conn()
    ensure_tables(conn)

    current_user, err = require_auth(event, conn)
    if err:
        conn.close()
        return err

    # Parse body once for POST/PUT routes
    raw_body = event.get("body") or "{}"
    body = json.loads(raw_body) if isinstance(raw_body, str) else (raw_body or {})

    # Split path into segments
    parts = path.split("/")
    segment1 = parts[1] if len(parts) > 1 else ""  # 'search' | 'users' | 'me' | 'admin'
    segment2 = parts[2] if len(parts) > 2 else ""  # user id | admin action
    segment3 = parts[3] if len(parts) > 3 else ""  # admin sub-action

    result = None

    # GET /search?q=...
    if method == "GET" and segment1 == "search":
        result = handle_search(event, conn, current_user)

    # GET /users/{id}
    elif method == "GET" and segment1 == "users" and segment2:
        result = handle_get_user(conn, int(segment2))

    # PUT /me
    elif method == "PUT" and segment1 == "me":
        result = handle_update_me(conn, current_user, body)

    # Admin routes — all require user id=1
    elif segment1 == "admin":
        admin_err = require_admin(current_user)
        if admin_err:
            conn.close()
            return admin_err

        action = segment2  # ban | set-badge | set-login | remove-user

        if method == "POST" and action == "ban":
            result = handle_admin_ban(conn, body)

        elif method == "POST" and action == "set-badge":
            result = handle_admin_set_badge(conn, body)

        elif method == "POST" and action == "set-login":
            result = handle_admin_set_login(conn, body)

        elif method == "POST" and action == "remove-user":
            result = handle_admin_remove_user(conn, body)

        else:
            result = response(404, {"error": f"Admin route not found: {method} /admin/{action}"})

    else:
        result = response(404, {"error": f"Route not found: {method} {path}"})

    conn.close()
    return result
