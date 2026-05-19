"""One-shot helper: prints the chat_id of whoever has DM'd the bot most recently.

Usage:
    1. Open Telegram, find your bot, send /start
    2. python -m jarvis.get_chat_id
    3. Copy the chat_id into .env as TELEGRAM_CHAT_ID
"""

from __future__ import annotations

import os
import sys

import requests

from .config import _load_dotenv, ROOT

_load_dotenv(ROOT / ".env")

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    print("set TELEGRAM_BOT_TOKEN in jarvis/.env first", file=sys.stderr)
    sys.exit(1)

r = requests.get(f"https://api.telegram.org/bot{TOKEN}/getUpdates", timeout=15)
r.raise_for_status()
data = r.json()

if not data.get("ok"):
    print("telegram api error:", data)
    sys.exit(1)

updates = data.get("result") or []
if not updates:
    print("no updates yet — send /start to the bot in Telegram, then re-run this.")
    sys.exit(0)

seen: dict[int, str] = {}
for u in updates:
    msg = u.get("message") or u.get("channel_post") or {}
    chat = msg.get("chat") or {}
    cid = chat.get("id")
    if cid is None:
        continue
    title = chat.get("title") or chat.get("username") or chat.get("first_name") or "?"
    seen[cid] = title

for cid, title in seen.items():
    print(f"chat_id={cid}  ({title})")
