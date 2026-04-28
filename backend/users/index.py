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

VALID_BADGES = {"red_black", "blue", "green", "gold", "silver", "purple", "pink", "orange", "grey_67"}


def get_conn():
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        cur.execute(f"SET search_path TO \"{SCHEMA}\"")
    conn.commit()
    return conn


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


def require_auth(event, conn):
    token = extract_token(event)
    if not token:
        return None, resp(401, {"error": "Нет токена"})
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token = %s",
            (token,),
        )
        row = cur.fetchone()
    if not row:
        return None, resp(401, {"error": "Токен недействителен"})
    return dict(row), None


def handler(event: dict, context) -> dict:
    """Users API: search, profile, admin actions."""
    method = (event.get("httpMethod") or "").upper()
    path = (event.get("path") or "/").rstrip("/") or "/"

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": CORS_HEADERS, "body": ""}

    conn = get_conn()
    user, err = require_auth(event, conn)
    if err:
        conn.close()
        return err

    # GET /search?q=...
    if method == "GET" and "/search" in path:
        q = ((event.get("queryStringParameters") or {}).get("q") or "").strip()
        if not q:
            conn.close()
            return resp(200, {"users": []})
        pattern = f"%{q}%"
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM users WHERE (username ILIKE %s OR name ILIKE %s) AND id != %s ORDER BY name LIMIT 50",
                (pattern, pattern, user["id"]),
            )
            rows = cur.fetchall()
        conn.close()
        return resp(200, {"users": [user_to_dict(dict(r)) for r in rows]})

    # GET /users/{id}
    if method == "GET" and "/users/" in path:
        parts = path.split("/")
        uid = int(parts[-1])
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE id = %s", (uid,))
            row = cur.fetchone()
        conn.close()
        if not row:
            return resp(404, {"error": "Пользователь не найден"})
        return resp(200, user_to_dict(dict(row)))

    # PUT /me
    if method == "PUT" and path.endswith("/me"):
        body = json.loads(event.get("body") or "{}")
        fields = {}
        if "name" in body:
            name = (body["name"] or "").strip()
            if not name:
                conn.close()
                return resp(400, {"error": "Имя не может быть пустым"})
            fields["name"] = name
        if "bio" in body:
            fields["bio"] = body["bio"]
        if not fields:
            conn.close()
            return resp(400, {"error": "Нет полей для обновления"})
        set_sql = ", ".join(f"{k} = %s" for k in fields)
        vals = list(fields.values()) + [user["id"]]
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"UPDATE users SET {set_sql} WHERE id = %s RETURNING *", vals)
            updated = dict(cur.fetchone())
        conn.commit()
        conn.close()
        return resp(200, user_to_dict(updated))

    # Admin routes — only user id=1
    if user["id"] != 1:
        conn.close()
        return resp(403, {"error": "Нет доступа"})

    body = json.loads(event.get("body") or "{}")

    # POST /admin/ban
    if method == "POST" and "/admin/ban" in path:
        uid = int(body.get("user_id", 0))
        minutes = int(body.get("minutes", 0))
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if minutes == 0:
                cur.execute(
                    "UPDATE users SET is_banned = FALSE, ban_until = NULL WHERE id = %s RETURNING *",
                    (uid,),
                )
            else:
                cur.execute(
                    "UPDATE users SET is_banned = TRUE, ban_until = NOW() + (%s || ' minutes')::INTERVAL WHERE id = %s RETURNING *",
                    (str(minutes), uid),
                )
            row = cur.fetchone()
        conn.commit()
        conn.close()
        if not row:
            return resp(404, {"error": "Пользователь не найден"})
        return resp(200, {"ok": True, "user": user_to_dict(dict(row))})

    # POST /admin/set-badge
    if method == "POST" and "/admin/set-badge" in path:
        uid = int(body.get("user_id", 0))
        badge = (body.get("badge") or "").strip()
        label = body.get("badge_label", "")
        if badge and badge not in VALID_BADGES:
            conn.close()
            return resp(400, {"error": "Неверный тип галочки"})
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "UPDATE users SET badge = %s, badge_label = %s WHERE id = %s RETURNING *",
                (badge or None, label, uid),
            )
            row = cur.fetchone()
        conn.commit()
        conn.close()
        if not row:
            return resp(404, {"error": "Пользователь не найден"})
        return resp(200, {"ok": True, "user": user_to_dict(dict(row))})

    # POST /admin/set-login
    if method == "POST" and "/admin/set-login" in path:
        uid = int(body.get("target_user_id", 0))
        new_username = (body.get("new_username") or "").strip().lower()
        if not new_username:
            conn.close()
            return resp(400, {"error": "Укажите новый логин"})
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id FROM users WHERE username = %s AND id != %s", (new_username, uid))
            if cur.fetchone():
                conn.close()
                return resp(409, {"error": "Логин уже занят"})
            cur.execute("UPDATE users SET username = %s WHERE id = %s RETURNING *", (new_username, uid))
            row = cur.fetchone()
        conn.commit()
        conn.close()
        if not row:
            return resp(404, {"error": "Пользователь не найден"})
        return resp(200, {"ok": True, "user": user_to_dict(dict(row))})

    # POST /admin/remove-user
    if method == "POST" and "/admin/remove-user" in path:
        uid = int(body.get("user_id", 0))
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET is_banned = TRUE, ban_until = NOW() + INTERVAL '100 years' WHERE id = %s",
                (uid,),
            )
        conn.commit()
        conn.close()
        return resp(200, {"ok": True})

    conn.close()
    return resp(404, {"error": "Not found"})
