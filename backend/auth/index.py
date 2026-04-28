import json
import os
import hashlib
import secrets

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
        cur.execute(f"SET search_path TO \"{SCHEMA}\"")
    conn.commit()
    return conn


def hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def resp(code: int, body: dict) -> dict:
    return {"statusCode": code, "headers": CORS_HEADERS, "body": json.dumps(body, default=str)}


def extract_token(event: dict):
    h = event.get("headers") or {}
    auth = h.get("X-Authorization") or h.get("x-authorization") or h.get("Authorization") or h.get("authorization") or ""
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def user_to_dict(row: dict) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "name": row["name"],
        "avatar_url": row.get("avatar_url"),
        "bio": row.get("bio") or "",
        "badge": row.get("badge"),
        "badge_label": row.get("badge_label"),
        "is_developer": row.get("is_developer", False),
        "avatar_border": row.get("avatar_border"),
        "is_banned": row.get("is_banned", False),
        "ban_until": row.get("ban_until"),
        "created_at": row.get("created_at"),
        "last_seen": row.get("last_seen"),
    }


def handle_register(body: dict) -> dict:
    """Регистрация нового пользователя."""
    username = (body.get("username") or "").strip().lower()
    name = (body.get("name") or "").strip()
    password = body.get("password") or ""

    if not username or not name or not password:
        return resp(400, {"error": "Заполните все поля"})
    if len(username) < 3:
        return resp(400, {"error": "Логин минимум 3 символа"})
    if len(password) < 6:
        return resp(400, {"error": "Пароль минимум 6 символов"})

    conn = get_conn()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cur.fetchone():
            conn.close()
            return resp(409, {"error": "Этот логин уже занят"})

        cur.execute("SELECT COUNT(*) AS cnt FROM users")
        is_first = cur.fetchone()["cnt"] == 0

        pw_hash = hash_pw(password)
        if is_first:
            cur.execute(
                "INSERT INTO users (username, name, password_hash, badge, badge_label, is_developer, avatar_border, bio) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING *",
                (username, name, pw_hash, "red_black", "Разработчик", True, "gold", "Разработчик приложения"),
            )
        else:
            cur.execute(
                "INSERT INTO users (username, name, password_hash) VALUES (%s, %s, %s) RETURNING *",
                (username, name, pw_hash),
            )
        user = dict(cur.fetchone())

        token = secrets.token_hex(32)
        cur.execute("INSERT INTO sessions (token, user_id) VALUES (%s, %s)", (token, user["id"]))
        cur.execute("UPDATE users SET last_seen = NOW() WHERE id = %s", (user["id"],))

    conn.commit()
    conn.close()
    return resp(200, {"token": token, "user": user_to_dict(user)})


def handle_login(body: dict) -> dict:
    """Вход в аккаунт."""
    username = (body.get("username") or "").strip().lower()
    password = body.get("password") or ""

    if not username or not password:
        return resp(400, {"error": "Заполните все поля"})

    conn = get_conn()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT * FROM users WHERE username = %s AND password_hash = %s",
            (username, hash_pw(password)),
        )
        user = cur.fetchone()
        if not user:
            conn.close()
            return resp(401, {"error": "Неверный логин или пароль"})

        user = dict(user)

        if user.get("is_banned") and user.get("ban_until"):
            from datetime import datetime, timezone
            ban_until = user["ban_until"]
            if hasattr(ban_until, "tzinfo"):
                now = datetime.now(timezone.utc)
                if ban_until > now:
                    conn.close()
                    return resp(403, {"error": f"Аккаунт заблокирован до {ban_until}"})
            cur.execute("UPDATE users SET is_banned = FALSE, ban_until = NULL WHERE id = %s", (user["id"],))

        token = secrets.token_hex(32)
        cur.execute("INSERT INTO sessions (token, user_id) VALUES (%s, %s)", (token, user["id"]))
        cur.execute("UPDATE users SET last_seen = NOW() WHERE id = %s", (user["id"],))

    conn.commit()
    conn.close()
    return resp(200, {"token": token, "user": user_to_dict(user)})


def handle_logout(event: dict) -> dict:
    """Выход из аккаунта."""
    token = extract_token(event)
    if not token:
        return resp(401, {"error": "Нет токена"})

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM sessions WHERE token = %s", (token,))
    conn.commit()
    conn.close()
    return resp(200, {"ok": True})


def handle_me(event: dict) -> dict:
    """Получить текущего пользователя."""
    token = extract_token(event)
    if not token:
        return resp(401, {"error": "Нет токена"})

    conn = get_conn()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token = %s",
            (token,),
        )
        user = cur.fetchone()
        if not user:
            conn.close()
            return resp(401, {"error": "Токен недействителен"})
        user = dict(user)
        cur.execute("UPDATE users SET last_seen = NOW() WHERE id = %s", (user["id"],))
    conn.commit()
    conn.close()
    return resp(200, user_to_dict(user))


def handler(event: dict, context) -> dict:
    """Auth функция: /register, /login, /logout, /me"""
    method = (event.get("httpMethod") or "").upper()
    path = (event.get("path") or "/").rstrip("/") or "/"

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": CORS_HEADERS, "body": ""}

    if method == "POST" and path.endswith("/register"):
        body = json.loads(event.get("body") or "{}")
        return handle_register(body)

    if method == "POST" and path.endswith("/login"):
        body = json.loads(event.get("body") or "{}")
        return handle_login(body)

    if method == "POST" and path.endswith("/logout"):
        return handle_logout(event)

    if method == "GET" and path.endswith("/me"):
        return handle_me(event)

    return resp(404, {"error": "Not found"})
