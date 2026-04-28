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


def msg_to_dict(row: dict) -> dict:
    return {
        "id": row["id"],
        "conversation_id": row["conversation_id"],
        "sender_id": row["sender_id"],
        "text": row["text"],
        "is_read": row["is_read"],
        "removed": row["removed"],
        "edited": row["edited"],
        "created_at": row["created_at"],
    }


def partner_to_dict(row: dict) -> dict:
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
        "last_seen": row.get("last_seen"),
    }


def handler(event: dict, context) -> dict:
    """Messages API: conversations and messages."""
    method = (event.get("httpMethod") or "").upper()
    path = (event.get("path") or "/").rstrip("/") or "/"
    parts = [p for p in path.split("/") if p]

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": CORS_HEADERS, "body": ""}

    conn = get_conn()
    user, err = require_auth(event, conn)
    if err:
        conn.close()
        return err

    uid = user["id"]
    is_admin = uid == 1
    body = json.loads(event.get("body") or "{}")

    # POST /conversations — create or get
    if method == "POST" and len(parts) == 1 and parts[0] == "conversations":
        partner_id = int(body.get("partner_id", 0))
        if not partner_id or partner_id == uid:
            conn.close()
            return resp(400, {"error": "Неверный partner_id"})
        a, b = min(uid, partner_id), max(uid, partner_id)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id FROM conversations WHERE user1_id = %s AND user2_id = %s", (a, b))
            row = cur.fetchone()
            if row:
                conv_id = row["id"]
            else:
                cur.execute(
                    "INSERT INTO conversations (user1_id, user2_id) VALUES (%s, %s) RETURNING id",
                    (a, b),
                )
                conv_id = cur.fetchone()["id"]
        conn.commit()
        conn.close()
        return resp(200, {"conversation_id": conv_id})

    # GET /conversations — list all
    if method == "GET" and len(parts) == 1 and parts[0] == "conversations":
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT c.id,
                    p.id AS p_id, p.username, p.name, p.avatar_url, p.bio,
                    p.badge, p.badge_label, p.is_developer, p.avatar_border,
                    p.is_banned, p.ban_until, p.last_seen,
                    lm.id AS lm_id, lm.conversation_id AS lm_conv_id,
                    lm.sender_id AS lm_sender_id, lm.text AS lm_text,
                    lm.is_read AS lm_is_read, lm.removed AS lm_removed,
                    lm.edited AS lm_edited, lm.created_at AS lm_created_at,
                    (SELECT COUNT(*) FROM messages m2
                     WHERE m2.conversation_id = c.id AND m2.sender_id != %s
                       AND m2.is_read = FALSE AND m2.removed = FALSE
                    ) AS unread_count
                FROM conversations c
                JOIN users p ON p.id = CASE WHEN c.user1_id = %s THEN c.user2_id ELSE c.user1_id END
                LEFT JOIN LATERAL (
                    SELECT * FROM messages m WHERE m.conversation_id = c.id AND m.removed = FALSE
                    ORDER BY m.created_at DESC LIMIT 1
                ) lm ON TRUE
                WHERE c.user1_id = %s OR c.user2_id = %s
                ORDER BY COALESCE(lm.created_at, c.created_at) DESC
                """,
                (uid, uid, uid, uid),
            )
            rows = cur.fetchall()

        result = []
        for r in rows:
            r = dict(r)
            partner = {
                "id": r["p_id"], "username": r["username"], "name": r["name"],
                "avatar_url": r["avatar_url"], "bio": r.get("bio") or "",
                "badge": r["badge"], "badge_label": r["badge_label"],
                "is_developer": r["is_developer"], "avatar_border": r["avatar_border"],
                "is_banned": r["is_banned"], "ban_until": r["ban_until"], "last_seen": r["last_seen"],
            }
            last_msg = None
            if r.get("lm_id"):
                last_msg = {
                    "id": r["lm_id"], "conversation_id": r["lm_conv_id"],
                    "sender_id": r["lm_sender_id"], "text": r["lm_text"],
                    "is_read": r["lm_is_read"], "removed": r["lm_removed"],
                    "edited": r["lm_edited"], "created_at": r["lm_created_at"],
                }
            result.append({"id": r["id"], "partner": partner, "last_message": last_msg, "unread_count": r["unread_count"]})

        conn.close()
        return resp(200, result)

    # GET /conversations/{id}/messages
    if method == "GET" and len(parts) == 3 and parts[0] == "conversations" and parts[2] == "messages":
        conv_id = int(parts[1])
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM conversations WHERE id = %s AND (user1_id = %s OR user2_id = %s)",
                (conv_id, uid, uid),
            )
            if not cur.fetchone():
                conn.close()
                return resp(403, {"error": "Нет доступа"})
            cur.execute(
                "SELECT * FROM messages WHERE conversation_id = %s ORDER BY created_at ASC LIMIT 100",
                (conv_id,),
            )
            msgs = cur.fetchall()
        conn.close()
        return resp(200, [msg_to_dict(dict(m)) for m in msgs])

    # POST /conversations/{id}/messages — send
    if method == "POST" and len(parts) == 3 and parts[0] == "conversations" and parts[2] == "messages":
        conv_id = int(parts[1])
        text = (body.get("text") or "").strip()
        if not text:
            conn.close()
            return resp(400, {"error": "Пустое сообщение"})

        # check ban
        if user.get("is_banned") and user.get("ban_until"):
            from datetime import datetime, timezone
            ban_until = user["ban_until"]
            if hasattr(ban_until, "tzinfo"):
                if ban_until > datetime.now(timezone.utc):
                    conn.close()
                    return resp(403, {"error": "Вы заблокированы"})

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM conversations WHERE id = %s AND (user1_id = %s OR user2_id = %s)",
                (conv_id, uid, uid),
            )
            if not cur.fetchone():
                conn.close()
                return resp(403, {"error": "Нет доступа"})
            cur.execute(
                "INSERT INTO messages (conversation_id, sender_id, text) VALUES (%s, %s, %s) RETURNING *",
                (conv_id, uid, text),
            )
            msg = dict(cur.fetchone())
        conn.commit()
        conn.close()
        return resp(200, msg_to_dict(msg))

    # POST /conversations/{id}/read
    if method == "POST" and len(parts) == 3 and parts[0] == "conversations" and parts[2] == "read":
        conv_id = int(parts[1])
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE messages SET is_read = TRUE WHERE conversation_id = %s AND sender_id != %s AND is_read = FALSE",
                (conv_id, uid),
            )
        conn.commit()
        conn.close()
        return resp(200, {"ok": True})

    # PUT /messages/{id} — edit
    if method == "PUT" and len(parts) == 2 and parts[0] == "messages":
        msg_id = int(parts[1])
        text = (body.get("text") or "").strip()
        if not text:
            conn.close()
            return resp(400, {"error": "Пустой текст"})
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM messages WHERE id = %s", (msg_id,))
            msg = cur.fetchone()
            if not msg:
                conn.close()
                return resp(404, {"error": "Сообщение не найдено"})
            msg = dict(msg)
            if msg["sender_id"] != uid and not is_admin:
                conn.close()
                return resp(403, {"error": "Нет доступа"})
            cur.execute(
                "UPDATE messages SET text = %s, edited = TRUE WHERE id = %s RETURNING *",
                (text, msg_id),
            )
            updated = dict(cur.fetchone())
        conn.commit()
        conn.close()
        return resp(200, msg_to_dict(updated))

    # POST /messages/{id}/remove
    if method == "POST" and len(parts) == 3 and parts[0] == "messages" and parts[2] == "remove":
        msg_id = int(parts[1])
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM messages WHERE id = %s", (msg_id,))
            msg = cur.fetchone()
            if not msg:
                conn.close()
                return resp(404, {"error": "Сообщение не найдено"})
            msg = dict(msg)
            if msg["sender_id"] != uid and not is_admin:
                conn.close()
                return resp(403, {"error": "Нет доступа"})
            cur.execute(
                "UPDATE messages SET removed = TRUE, text = 'Сообщение удалено' WHERE id = %s",
                (msg_id,),
            )
        conn.commit()
        conn.close()
        return resp(200, {"ok": True})

    conn.close()
    return resp(404, {"error": "Not found"})
