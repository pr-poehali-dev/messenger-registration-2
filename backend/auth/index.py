import json
import os
import hashlib
import secrets
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import RealDictCursor


DATABASE_URL = os.environ["DATABASE_URL"]
SCHEMA = os.environ["MAIN_DB_SCHEMA"]

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
    "Content-Type": "application/json",
}


def get_conn():
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        cur.execute(f"SET search_path TO {SCHEMA}")
    conn.commit()
    return conn


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=str),
    }


def extract_token(event: dict) -> str | None:
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


def ensure_tables(conn):
    with conn.cursor() as cur:
        cur.execute(f"SET search_path TO {SCHEMA}")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id               SERIAL PRIMARY KEY,
                username         VARCHAR(64) UNIQUE NOT NULL,
                name             VARCHAR(128) NOT NULL,
                password_hash    VARCHAR(64) NOT NULL,
                avatar_url       TEXT,
                bio              TEXT,
                badge            VARCHAR(64),
                badge_label      VARCHAR(128),
                is_developer     BOOLEAN NOT NULL DEFAULT FALSE,
                avatar_border    VARCHAR(64),
                is_banned        BOOLEAN NOT NULL DEFAULT FALSE,
                ban_until        TIMESTAMPTZ,
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_seen        TIMESTAMPTZ
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


def handle_register(body: dict) -> dict:
    username = (body.get("username") or "").strip()
    name = (body.get("name") or "").strip()
    password = body.get("password") or ""

    if not username or not name or not password:
        return response(400, {"error": "username, name and password are required"})

    conn = get_conn()
    ensure_tables(conn)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cur.fetchone():
            conn.close()
            return response(409, {"error": "Username already taken"})

        pw_hash = hash_password(password)

        # Check if this will be the first user
        cur.execute("SELECT COUNT(*) AS cnt FROM users")
        count = cur.fetchone()["cnt"]
        is_first = count == 0

        if is_first:
            cur.execute(
                """
                INSERT INTO users
                    (username, name, password_hash, badge, badge_label, is_developer, avatar_border, bio)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    username,
                    name,
                    pw_hash,
                    "red_black",
                    "Разработчик",
                    True,
                    "gold",
                    "Разработчик приложения",
                ),
            )
        else:
            cur.execute(
                """
                INSERT INTO users (username, name, password_hash)
                VALUES (%s, %s, %s)
                RETURNING *
                """,
                (username, name, pw_hash),
            )

        user = dict(cur.fetchone())

        token = secrets.token_hex(32)
        cur.execute(
            "INSERT INTO sessions (token, user_id) VALUES (%s, %s)",
            (token, user["id"]),
        )

        cur.execute(
            "UPDATE users SET last_seen = NOW() WHERE id = %s",
            (user["id"],),
        )

    conn.commit()
    conn.close()

    return response(200, {"token": token, "user": user_row_to_dict(user)})


def handle_login(body: dict) -> dict:
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    if not username or not password:
        return response(400, {"error": "username and password are required"})

    conn = get_conn()
    ensure_tables(conn)

    pw_hash = hash_password(password)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT * FROM users WHERE username = %s AND password_hash = %s",
            (username, pw_hash),
        )
        user = cur.fetchone()

        if not user:
            conn.close()
            return response(401, {"error": "Invalid username or password"})

        user = dict(user)
        token = secrets.token_hex(32)

        cur.execute(
            "INSERT INTO sessions (token, user_id) VALUES (%s, %s)",
            (token, user["id"]),
        )
        cur.execute(
            "UPDATE users SET last_seen = NOW() WHERE id = %s",
            (user["id"],),
        )

    conn.commit()
    conn.close()

    return response(200, {"token": token, "user": user_row_to_dict(user)})


def handle_logout(event: dict) -> dict:
    token = extract_token(event)

    if not token:
        return response(401, {"error": "Missing authorization token"})

    conn = get_conn()
    ensure_tables(conn)

    with conn.cursor() as cur:
        cur.execute("DELETE FROM sessions WHERE token = %s", (token,))

    conn.commit()
    conn.close()

    return response(200, {"success": True})


def handle_me(event: dict) -> dict:
    token = extract_token(event)

    if not token:
        return response(401, {"error": "Missing authorization token"})

    conn = get_conn()
    ensure_tables(conn)

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
        user = cur.fetchone()

        if not user:
            conn.close()
            return response(401, {"error": "Invalid or expired token"})

        user = dict(user)

        cur.execute(
            "UPDATE users SET last_seen = NOW() WHERE id = %s",
            (user["id"],),
        )

    conn.commit()
    conn.close()

    return response(200, {"user": user_row_to_dict(user)})


def handler(event: dict, context) -> dict:
    method = (event.get("httpMethod") or "").upper()
    path = event.get("path") or ""

    # Strip trailing slash for consistency
    path = path.rstrip("/") or "/"

    if method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": CORS_HEADERS,
            "body": "",
        }

    if method == "POST" and path == "/register":
        raw_body = event.get("body") or "{}"
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
        return handle_register(body)

    if method == "POST" and path == "/login":
        raw_body = event.get("body") or "{}"
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
        return handle_login(body)

    if method == "POST" and path == "/logout":
        return handle_logout(event)

    if method == "GET" and path == "/me":
        return handle_me(event)

    return response(404, {"error": f"Route not found: {method} {path}"})
