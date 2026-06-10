"""Telegram command dispatch. Each command maps to a method on the Daemon and replies in-chat.

Commands (slash-prefixed; a trailing @botname and arguments are tolerated):
  /hyperliquid /subscribe /start   subscribe this chat to the feed
  /stop /unsubscribe               unsubscribe
  /status                          counts, threshold, floors, spend
  /recent [n]                      last n fired outliers
  /accounts                        the curated handles
  /calibrate                       recompute baselines + threshold, show distribution + examples
  /help                            this list
"""
from __future__ import annotations

import logging

from . import formatters, store

log = logging.getLogger("hyperfeed.cmd")

HELP = (
    "<b>hyperfeed</b> — Hyperliquid outlier alerts\n"
    "/hyperliquid — subscribe this chat to the feed\n"
    "/stop — unsubscribe\n"
    "/status — accounts, threshold, floors, spend\n"
    "/recent [n] — last n fired outliers\n"
    "/accounts — the watched accounts\n"
    "/calibrate — recompute what counts as an outlier\n"
    "/help — this message"
)

SUBSCRIBE = {"hyperliquid", "subscribe", "start"}
UNSUBSCRIBE = {"stop", "unsubscribe"}


def _parse(text: str) -> tuple[str, list[str]]:
    parts = text.strip().split()
    if not parts:
        return "", []
    cmd = parts[0].lstrip("/").split("@")[0].lower()
    return cmd, parts[1:]


async def handle(daemon, chat_id: int, text: str, message_id: int | None) -> None:
    cmd, args = _parse(text)
    tg = daemon.tg

    async def reply(msg: str) -> None:
        await tg.send(chat_id, msg, html=True, reply_to_message_id=message_id)

    if cmd in SUBSCRIBE:
        added = store.add_subscriber(chat_id)
        head = "✅ Subscribed to the Hyperliquid feed." if added else "Already subscribed."
        await reply(head + "\n\n" + await daemon.status_text())
        return

    if cmd in UNSUBSCRIBE:
        removed = store.remove_subscriber(chat_id)
        await reply("Unsubscribed — no more alerts." if removed else "You weren't subscribed.")
        return

    if cmd == "status":
        await reply(await daemon.status_text())
        return

    if cmd == "accounts":
        await reply(formatters.format_accounts(daemon.accounts))
        return

    if cmd == "recent":
        n = 5
        if args:
            try:
                n = max(1, min(20, int(args[0])))
            except ValueError:
                pass
        await reply(formatters.format_recent(store.recent_fired(n)))
        return

    if cmd == "calibrate":
        await reply("Recalibrating from the last 30 days — this takes a moment…")
        summary = await daemon.do_calibrate()
        await reply(summary)
        return

    if cmd in ("help", "commands"):
        await reply(HELP)
        return

    # Unknown slash command — quietly offer help; ignore non-command chatter.
    if text.strip().startswith("/"):
        await reply(HELP)
