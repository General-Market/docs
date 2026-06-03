"""Appends every group / supergroup message Jarvis receives to a JSONL transcript.

state/group_log.jsonl — one JSON object per line, append-only. Private chats
(your own DM with the bot) and channel posts are skipped; only `group` and
`supergroup` chats are recorded.

IMPORTANT: Telegram only delivers ordinary group messages to a bot when the
bot's privacy mode is OFF (BotFather → /setprivacy → Disable) or the bot is a
group admin. With privacy mode ON (the default) this logger will only ever see
commands, @mentions, and replies to the bot — re-add the bot after toggling.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from .config import STATE_DIR

log = logging.getLogger("jarvis.grouplog")

LOG_FILE = STATE_DIR / "group_log.jsonl"

_GROUP_TYPES = {"group", "supergroup"}


def _sender_name(frm: dict[str, Any]) -> str:
    parts = [frm.get("first_name") or "", frm.get("last_name") or ""]
    name = " ".join(p for p in parts if p).strip()
    return name or (frm.get("username") or f"id:{frm.get('id')}")


def record_message(msg: dict[str, Any]) -> None:
    """Append one group message to the transcript. No-op for non-group chats."""
    chat = msg.get("chat") or {}
    if chat.get("type") not in _GROUP_TYPES:
        return

    text = msg.get("text") or msg.get("caption")
    if text is None:
        # Non-text content (sticker, photo with no caption, service msg). Note the kind.
        text = next(
            (k for k in ("photo", "sticker", "document", "voice", "video",
                         "audio", "animation", "poll", "location", "contact")
             if k in msg),
            "<non-text>",
        )

    frm = msg.get("from") or {}
    ts = msg.get("date")
    iso = (
        datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
        if isinstance(ts, int)
        else datetime.now(tz=timezone.utc).isoformat()
    )

    entry = {
        "ts": iso,
        "chat_id": chat.get("id"),
        "chat_title": chat.get("title"),
        "from_id": frm.get("id"),
        "from": _sender_name(frm),
        "username": frm.get("username"),
        "message_id": msg.get("message_id"),
        "reply_to": (msg.get("reply_to_message") or {}).get("message_id"),
        "text": text,
    }

    try:
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:
        log.error("group_log write failed: %s", e)
