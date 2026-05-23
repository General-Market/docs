"""Watches Telegram for replies to forwarded messages and applies commands.

The only commands today are `ban` and `mute`, both addressed at Gmail
forwards by replying to (or quoting) the original Telegram notification.

- mute: add sender to runtime mute list, future mail from them is
  dropped before reaching Telegram. Inbox is untouched.
- ban:  add sender to runtime ban list AND move every existing INBOX
  message from that sender to Gmail Trash. Recoverable for 30 days
  if you change your mind.

Both commands accept the first word `ban|block` or `mute|silence`,
case-insensitive, with any trailing text ignored — so you can reply
"ban — these guys never stop" and it still parses.
"""

from __future__ import annotations

import asyncio
import logging

from . import blocklist, forwarded_index
from .config import Config
from .gmail_poller import trash_sender_messages
from .telegram_client import Telegram

log = logging.getLogger("jarvis.cmd")

POLL_TIMEOUT = 25  # long-poll seconds


def _parse_command(text: str | None) -> str | None:
    if not text:
        return None
    stripped = text.strip()
    if not stripped:
        return None
    first = stripped.split()[0].lower().strip(",.;:!?")
    if first in ("ban", "block"):
        return "ban"
    if first in ("mute", "silence"):
        return "mute"
    return None


async def _apply_mute(tg: Telegram, sender_email: str, reply_to: int) -> None:
    added = blocklist.add_mute(sender_email)
    if added:
        msg = f"🔇 muted <code>{sender_email}</code>. Future mail is silenced; inbox untouched."
    else:
        msg = f"already muted (or banned) <code>{sender_email}</code>."
    await tg.send(msg, html=True, reply_to_message_id=reply_to)


async def _apply_ban(
    cfg: Config, tg: Telegram, sender_email: str, reply_to: int
) -> None:
    added = blocklist.add_ban(sender_email)
    try:
        trashed = await asyncio.to_thread(trash_sender_messages, cfg, sender_email)
    except Exception as e:
        log.error("trash failed for %s: %s", sender_email, e)
        trashed = -1

    if trashed < 0:
        tail = "trash step failed — see logs"
    elif trashed == 0:
        tail = "no existing mail to clear"
    elif trashed == 1:
        tail = "1 existing mail moved to Trash"
    else:
        tail = f"{trashed} existing mails moved to Trash"

    verb = "banned" if added else "already banned"
    msg = f"🚫 {verb} <code>{sender_email}</code>. {tail}; future mail blocked."
    await tg.send(msg, html=True, reply_to_message_id=reply_to)


async def poll_commands_loop(cfg: Config, tg: Telegram) -> None:
    log.info("command watcher starting")
    offset = 0
    while True:
        try:
            updates = await tg.get_updates(offset, timeout=POLL_TIMEOUT)
            for u in updates:
                update_id = u.get("update_id")
                if isinstance(update_id, int):
                    offset = max(offset, update_id + 1)

                msg = u.get("message") or {}
                reply = msg.get("reply_to_message")
                if not reply:
                    continue

                reply_id = reply.get("message_id")
                user_msg_id = msg.get("message_id")
                if not isinstance(reply_id, int):
                    continue

                cmd = _parse_command(msg.get("text"))
                if not cmd:
                    continue

                entry = forwarded_index.lookup(reply_id)
                if not entry:
                    if isinstance(user_msg_id, int):
                        await tg.send(
                            "I don't remember that message — index only keeps the last 500.",
                            reply_to_message_id=user_msg_id,
                        )
                    continue

                if entry.get("source") != "gmail":
                    if isinstance(user_msg_id, int):
                        await tg.send(
                            f"<code>{cmd}</code> only applies to Gmail forwards.",
                            html=True,
                            reply_to_message_id=user_msg_id,
                        )
                    continue

                sender_email = entry.get("sender_email") or ""
                if not sender_email:
                    if isinstance(user_msg_id, int):
                        await tg.send(
                            "no sender_email on that entry, cannot apply.",
                            reply_to_message_id=user_msg_id,
                        )
                    continue

                target_reply = user_msg_id if isinstance(user_msg_id, int) else reply_id
                if cmd == "mute":
                    await _apply_mute(tg, sender_email, target_reply)
                elif cmd == "ban":
                    await _apply_ban(cfg, tg, sender_email, target_reply)

        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.error("command poll error: %s", e)
            await asyncio.sleep(5)
