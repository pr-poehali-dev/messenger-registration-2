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


# ---------------------------------------------------------------------------
# Table bootstrap
# ---------------------------------------------------------------------------

def ensure_tables(conn):
    with conn.cursor() as cur:
        cur.execute(f"SET search_path TO {SCHEMA}")
        # users + sessions are created by the auth function; we reference them
        # but still create them here idempotently so this function is standalone.
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
        cur.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id         SERIAL PRIMARY KEY,
                user_a     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                user_b     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT conversations_unique_pair UNIQUE (
                    LEAST(user_a, user_b),
                    GREATEST(user_a, user_b)
                )
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id              SERIAL PRIMARY KEY,
                conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                text            TEXT NOT NULL,
                is_read         BOOLEAN NOT NULL DEFAULT FALSE,
                removed         BOOLEAN NOT NULL DEFAULT FALSE,
                edited          BOOLEAN NOT NULL DEFAULT FALSE,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
    conn.commit()


# ---------------------------------------------------------------------------
# Auth helper — validates token and returns current user row as dict
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


# ---------------------------------------------------------------------------
# Shape helpers
# ---------------------------------------------------------------------------

def message_to_dict(row: dict) -> dict:
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
        "badge": row.get("badge"),
        "badge_label": row.get("badge_label"),
        "is_developer": row.get("is_developer", False),
        "avatar_border": row.get("avatar_border"),
        "is_banned": row.get("is_banned", False),
        "ban_until": row.get("ban_until"),
    }


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

def handle_get_conversations(event, conn, current_user):
    user_id = current_user["id"]

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Fetch all conversations for the user, plus partner info and last message
        cur.execute(
            """
            SELECT
                c.id                  AS conversation_id,
                -- partner columns
                p.id                  AS partner_id,
                p.username            AS partner_username,
                p.name                AS partner_name,
                p.avatar_url          AS partner_avatar_url,
                p.badge               AS partner_badge,
                p.badge_label         AS partner_badge_label,
                p.is_developer        AS partner_is_developer,
                p.avatar_border       AS partner_avatar_border,
                p.is_banned           AS partner_is_banned,
                p.ban_until           AS partner_ban_until,
                -- last message subquery
                lm.id                 AS lm_id,
                lm.conversation_id    AS lm_conversation_id,
                lm.sender_id          AS lm_sender_id,
                lm.text               AS lm_text,
                lm.is_read            AS lm_is_read,
                lm.removed            AS lm_removed,
                lm.edited             AS lm_edited,
                lm.created_at         AS lm_created_at,
                -- unread count
                (
                    SELECT COUNT(*)
                    FROM messages m2
                    WHERE m2.conversation_id = c.id
                      AND m2.sender_id != %s
                      AND m2.is_read = FALSE
                      AND m2.removed = FALSE
                ) AS unread_count
            FROM conversations c
            JOIN users p ON p.id = CASE
                WHEN c.user_a = %s THEN c.user_b
                ELSE c.user_a
            END
            LEFT JOIN LATERAL (
                SELECT *
                FROM messages m
                WHERE m.conversation_id = c.id
                  AND m.removed = FALSE
                ORDER BY m.created_at DESC
                LIMIT 1
            ) lm ON TRUE
            WHERE c.user_a = %s OR c.user_b = %s
            ORDER BY COALESCE(lm.created_at, c.created_at) DESC
            """,
            (user_id, user_id, user_id, user_id),
        )
        rows = cur.fetchall()

    conversations = []
    for row in rows:
        partner = {
            "id": row["partner_id"],
            "username": row["partner_username"],
            "name": row["partner_name"],
            "avatar_url": row["partner_avatar_url"],
            "badge": row["partner_badge"],
            "badge_label": row["partner_badge_label"],
            "is_developer": row["partner_is_developer"],
            "avatar_border": row["partner_avatar_border"],
            "is_banned": row["partner_is_banned"],
            "ban_until": row["partner_ban_until"],
        }

        last_message = None
        if row["lm_id"] is not None:
            last_message = {
                "id": row["lm_id"],
                "conversation_id": row["lm_conversation_id"],
                "sender_id": row["lm_sender_id"],
                "text": row["lm_text"],
                "is_read": row["lm_is_read"],
                "removed": row["lm_removed"],
                "edited": row["lm_edited"],
                "created_at": row["lm_created_at"],
            }

        conversations.append({
            "id": row["conversation_id"],
            "partner": partner,
            "last_message": last_message,
            "unread_count": row["unread_count"],
        })

    return response(200, {"conversations": conversations})


def handle_get_messages(event, conn, current_user, conversation_id):
    user_id = current_user["id"]

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Verify the current user is a participant
        cur.execute(
            "SELECT id FROM conversations WHERE id = %s AND (user_a = %s OR user_b = %s)",
            (conversation_id, user_id, user_id),
        )
        if not cur.fetchone():
            return response(403, {"error": "Conversation not found or access denied"})

        cur.execute(
            """
            SELECT *
            FROM messages
            WHERE conversation_id = %s
              AND removed = FALSE
            ORDER BY created_at ASC
            LIMIT 50
            """,
            (conversation_id,),
        )
        rows = cur.fetchall()

    messages = [message_to_dict(dict(r)) for r in rows]
    return response(200, {"messages": messages})


def handle_post_conversation(event, conn, current_user, body):
    user_id = current_user["id"]
    partner_id = body.get("partner_id")

    if not partner_id:
        return response(400, {"error": "partner_id is required"})

    partner_id = int(partner_id)

    if partner_id == user_id:
        return response(400, {"error": "Cannot create conversation with yourself"})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Check partner exists
        cur.execute("SELECT id FROM users WHERE id = %s", (partner_id,))
        if not cur.fetchone():
            return response(404, {"error": "Partner user not found"})

        # Use LEAST/GREATEST to find existing regardless of direction
        cur.execute(
            """
            SELECT id FROM conversations
            WHERE LEAST(user_a, user_b) = LEAST(%s, %s)
              AND GREATEST(user_a, user_b) = GREATEST(%s, %s)
            """,
            (user_id, partner_id, user_id, partner_id),
        )
        existing = cur.fetchone()

        if existing:
            conn.commit()
            return response(200, {"conversation_id": existing["id"]})

        cur.execute(
            "INSERT INTO conversations (user_a, user_b) VALUES (%s, %s) RETURNING id",
            (user_id, partner_id),
        )
        conversation_id = cur.fetchone()["id"]

    conn.commit()
    return response(200, {"conversation_id": conversation_id})


def handle_send_message(event, conn, current_user, conversation_id, body):
    user_id = current_user["id"]
    text = (body.get("text") or "").strip()

    if not text:
        return response(400, {"error": "text is required"})

    # Ban check
    if current_user.get("is_banned"):
        return response(403, {"error": "You are banned and cannot send messages"})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Re-check ban_until from DB to be safe
        cur.execute(
            "SELECT is_banned, ban_until FROM users WHERE id = %s",
            (user_id,),
        )
        user_live = cur.fetchone()
        if user_live["is_banned"] or (
            user_live["ban_until"] is not None
            and user_live["ban_until"].tzinfo is not None
        ):
            # ban_until comparison done in SQL for correctness
            cur.execute(
                "SELECT (is_banned = TRUE OR (ban_until IS NOT NULL AND ban_until > NOW())) AS banned FROM users WHERE id = %s",
                (user_id,),
            )
            ban_check = cur.fetchone()
            if ban_check["banned"]:
                return response(403, {"error": "You are banned and cannot send messages"})

        # Verify participant
        cur.execute(
            "SELECT id FROM conversations WHERE id = %s AND (user_a = %s OR user_b = %s)",
            (conversation_id, user_id, user_id),
        )
        if not cur.fetchone():
            return response(403, {"error": "Conversation not found or access denied"})

        cur.execute(
            """
            INSERT INTO messages (conversation_id, sender_id, text)
            VALUES (%s, %s, %s)
            RETURNING *
            """,
            (conversation_id, user_id, text),
        )
        msg = dict(cur.fetchone())

    conn.commit()
    return response(200, {"message": message_to_dict(msg)})


def handle_edit_message(event, conn, current_user, message_id, body):
    user_id = current_user["id"]
    text = (body.get("text") or "").strip()

    if not text:
        return response(400, {"error": "text is required"})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM messages WHERE id = %s", (message_id,))
        msg = cur.fetchone()

        if not msg:
            return response(404, {"error": "Message not found"})

        # Only sender can edit, unless current user is id=1
        if msg["sender_id"] != user_id and user_id != 1:
            return response(403, {"error": "Not allowed to edit this message"})

        cur.execute(
            """
            UPDATE messages
            SET text = %s, edited = TRUE
            WHERE id = %s
            RETURNING *
            """,
            (text, message_id),
        )
        updated = dict(cur.fetchone())

    conn.commit()
    return response(200, {"message": message_to_dict(updated)})


def handle_remove_message(event, conn, current_user, message_id):
    user_id = current_user["id"]

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM messages WHERE id = %s", (message_id,))
        msg = cur.fetchone()

        if not msg:
            return response(404, {"error": "Message not found"})

        # Only sender can remove, unless current user is id=1
        if msg["sender_id"] != user_id and user_id != 1:
            return response(403, {"error": "Not allowed to remove this message"})

        cur.execute(
            "UPDATE messages SET removed = TRUE WHERE id = %s",
            (message_id,),
        )

    conn.commit()
    return response(200, {"ok": True})


def handle_read_conversation(event, conn, current_user, conversation_id):
    user_id = current_user["id"]

    with conn.cursor() as cur:
        # Verify participant
        cur.execute(
            "SELECT id FROM conversations WHERE id = %s AND (user_a = %s OR user_b = %s)",
            (conversation_id, user_id, user_id),
        )
        if not cur.fetchone():
            return response(403, {"error": "Conversation not found or access denied"})

        cur.execute(
            """
            UPDATE messages
            SET is_read = TRUE
            WHERE conversation_id = %s
              AND sender_id != %s
              AND is_read = FALSE
            """,
            (conversation_id, user_id),
        )

    conn.commit()
    return response(200, {"ok": True})


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

    # Split path into segments: ['', 'conversations', '{id}', ...]
    parts = path.split("/")
    # parts[0] is always '' (leading slash)
    # parts[1] is first segment: 'conversations' or 'messages'
    segment1 = parts[1] if len(parts) > 1 else ""
    segment2 = parts[2] if len(parts) > 2 else ""  # id or sub-resource
    segment3 = parts[3] if len(parts) > 3 else ""  # sub-resource or action
    segment4 = parts[4] if len(parts) > 4 else ""  # action

    result = None

    # GET /conversations
    if method == "GET" and segment1 == "conversations" and segment2 == "":
        result = handle_get_conversations(event, conn, current_user)

    # GET /conversations/{id}/messages
    elif method == "GET" and segment1 == "conversations" and segment2 and segment3 == "messages":
        result = handle_get_messages(event, conn, current_user, int(segment2))

    # POST /conversations
    elif method == "POST" and segment1 == "conversations" and segment2 == "":
        result = handle_post_conversation(event, conn, current_user, body)

    # POST /conversations/{id}/messages
    elif method == "POST" and segment1 == "conversations" and segment2 and segment3 == "messages":
        result = handle_send_message(event, conn, current_user, int(segment2), body)

    # POST /conversations/{id}/read
    elif method == "POST" and segment1 == "conversations" and segment2 and segment3 == "read":
        result = handle_read_conversation(event, conn, current_user, int(segment2))

    # PUT /messages/{id}
    elif method == "PUT" and segment1 == "messages" and segment2:
        result = handle_edit_message(event, conn, current_user, int(segment2), body)

    # POST /messages/{id}/remove
    elif method == "POST" and segment1 == "messages" and segment2 and segment3 == "remove":
        result = handle_remove_message(event, conn, current_user, int(segment2))

    else:
        result = response(404, {"error": f"Route not found: {method} {path}"})

    conn.close()
    return result
