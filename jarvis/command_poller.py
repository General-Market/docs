"""Owns the bot's single getUpdates consumer: logs group messages and applies commands.

This is the *only* place allowed to long-poll getUpdates — Telegram delivers
each update to one consumer, so a second poller would steal updates. Every
group/supergroup message is handed to `group_log.record_message` first; the
reply-command logic below runs on top of the same stream.

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

from . import blocklist, forwarded_index, group_log
from . import deploy
from .config import Config, STATE_DIR
from .gmail_poller import trash_sender_messages
from .telegram_client import Telegram

log = logging.getLogger("jarvis.cmd")

POLL_TIMEOUT = 25  # long-poll seconds


_SURFACES = {
    "app": "app.crxfx.com",
    "docs": "docs.crxfx.com",
    "landing": "crxfx.com (landing)",
    "blog": "blog.crxfx.com",
    "solver-dash": "solver.crxfx.com (desk)",
}


# Who may run /golive: Max (telegram_chat_id) plus any id listed in
# state/golive_allowed.txt — one numeric id per line (a trailing @handle/comment
# is fine). Read fresh on each use, so adding someone needs no restart: just
# append their id to /root/jarvis/state/golive_allowed.txt on the host.
_ALLOWED_FILE = STATE_DIR / "golive_allowed.txt"


def _golive_allowed(cfg: Config) -> set[str]:
    ids = {str(cfg.telegram_chat_id)}
    try:
        for line in _ALLOWED_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                ids.add(line.split()[0])
    except FileNotFoundError:
        pass
    return ids


# One tap must ship exactly one surface. A getUpdates batch is processed
# sequentially, so a stray/duplicate/old-menu tap can arrive as a second
# callback_query in the same batch and — without these guards — deploy a
# second surface in turn. Two guards close that door:
#   _CONSUMED_MENUS — menu message_ids already acted on. A repeat callback on
#     an already-acted menu is answered and dropped (the keyboard is also
#     retired on tap, so normally there is no button left to fire).
#   _DEPLOY_LOCK    — single-flight: while one deploy runs, any further tap is
#     answered with "already in progress" and never reaches run_deploy.
_CONSUMED_MENUS: set[int] = set()
_DEPLOY_LOCK = asyncio.Lock()


async def _handle_golive_callback(cfg: Config, tg: Telegram, cq: dict) -> None:
    """Inline-button tap on the /golive menu. Replies in the tapper's own chat."""
    await tg.answer_callback(cq.get("id", ""))
    frm = str((cq.get("from") or {}).get("id", ""))
    menu = cq.get("message") or {}
    menu_chat = (menu.get("chat") or {}).get("id")
    menu_id = menu.get("message_id")
    chat = str(menu_chat if menu_chat is not None else "") or frm
    if frm not in _golive_allowed(cfg):
        return
    data = cq.get("data", "")
    if data == "crxcancel":
        # Retire the keyboard so the dead menu can't be re-tapped, then ack.
        if menu_chat is not None and isinstance(menu_id, int):
            _CONSUMED_MENUS.add(menu_id)
            await tg.edit_reply_markup(menu_chat, menu_id, markup=None)
        await tg.send("Cancelled — nothing deployed.", chat_id=chat)
        return
    if not data.startswith("crxgo:"):
        return
    target = data.split(":", 1)[1]
    if target not in _SURFACES:
        return

    # Consume-once: a repeat tap on a menu we've already acted on ships nothing.
    if isinstance(menu_id, int) and menu_id in _CONSUMED_MENUS:
        await tg.send("That menu was already used — run /golive again.", chat_id=chat)
        return

    # Retire this menu's keyboard the instant a valid surface is tapped, and
    # mark it consumed — both happen before any awaited deploy, so a second
    # queued callback on the same menu finds it spent.
    if menu_chat is not None and isinstance(menu_id, int):
        _CONSUMED_MENUS.add(menu_id)
        await tg.edit_reply_markup(menu_chat, menu_id, markup=None)

    # Single-flight: never run two deploys at once. A tap that arrives while a
    # deploy is in flight is told to wait, and ships nothing.
    if _DEPLOY_LOCK.locked():
        await tg.send("A deploy is already in progress — wait for it to finish.", chat_id=chat)
        return

    async with _DEPLOY_LOCK:
        await tg.send(f"⏳ deploying <b>{_SURFACES[target]}</b> to LIVE…", html=True, chat_id=chat)
        result = await asyncio.to_thread(deploy.run_deploy, target)
        await tg.send(f"✅ {result}", chat_id=chat)
        # Audit: if anyone other than Max ships, notify Max too.
        if frm != str(cfg.telegram_chat_id):
            await tg.send(f"🛬 LIVE deploy by <code>{frm}</code> → {_SURFACES[target]}\n{result}", html=True)


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

                # Inline-button taps (the /golive Approve/Cancel buttons).
                cq = u.get("callback_query")
                if cq:
                    await _handle_golive_callback(cfg, tg, cq)
                    continue

                msg = u.get("message") or {}

                # Transcribe every group message before the command filter below
                # drops everything that isn't a reply-command.
                group_log.record_message(msg)

                text = (msg.get("text") or "").strip()
                chat_id = str((msg.get("chat") or {}).get("id", ""))
                from_id = str((msg.get("from") or {}).get("id", ""))
                first = text.split("@")[0].split()[0:1]

                # /id — anyone can ask for their own numeric id (needed to be
                # added to the /golive allow-list). Harmless: an id isn't secret.
                if first in (["/id"], ["/whoami"]):
                    handle = (msg.get("from") or {}).get("username", "")
                    log.info("/id from %s (@%s)", from_id, handle)
                    await tg.send(
                        f"Your Telegram id: <code>{from_id}</code>\nAsk Max to add it to /golive.",
                        html=True, chat_id=chat_id,
                    )
                    continue

                # /golive — production deploy gate. Allowed = Max + anyone in
                # state/golive_allowed.txt. The menu/replies go to the caller's
                # own chat. Unauthorized callers are logged and ignored.
                if first == ["/golive"]:
                    if from_id not in _golive_allowed(cfg):
                        handle = (msg.get("from") or {}).get("username", "")
                        log.info("/golive denied for %s (@%s)", from_id, handle)
                        continue
                    kb = {"inline_keyboard": [
                        [{"text": "📱 App", "callback_data": "crxgo:app"},
                         {"text": "📖 Docs", "callback_data": "crxgo:docs"}],
                        [{"text": "🛬 Landing", "callback_data": "crxgo:landing"},
                         {"text": "🗞 Blog", "callback_data": "crxgo:blog"}],
                        [{"text": "📊 Solver Dash", "callback_data": "crxgo:solver-dash"}],
                        [{"text": "❌ Cancel", "callback_data": "crxcancel"}],
                    ]}
                    await tg.send(
                        "Deploy which surface to LIVE? <i>(one at a time — each ships only its own site)</i>",
                        html=True, reply_markup=kb, chat_id=chat_id,
                    )
                    continue

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
