"""Telegram HTML formatters. One place, one style. All user-supplied strings are escaped."""

from __future__ import annotations

import html
from dataclasses import dataclass
from typing import Mapping


def _esc(s: str | None) -> str:
    return html.escape(s or "", quote=False)


def _shorten_addr(addr: str) -> str:
    if len(addr) <= 14:
        return addr
    return f"{addr[:8]}…{addr[-6:]}"


def waitlist_signup(*, sub: Mapping, total: int) -> str:
    lines = ["🚪 <b>Waitlist · new signup</b>", ""]

    if sub.get("email"):
        lines.append(f"<b>Email:</b>    <code>{_esc(sub['email'])}</code>")
    if sub.get("twitter"):
        lines.append(f"<b>Twitter:</b>  @{_esc(sub['twitter'])}")
    if sub.get("telegram"):
        lines.append(f"<b>Telegram:</b> @{_esc(sub['telegram'])}")
    if sub.get("wallet"):
        lines.append(f"<b>Wallet:</b>   <code>{_esc(_shorten_addr(sub['wallet']))}</code>")

    context: list[str] = []
    if sub.get("has_invite"):
        invite_value = sub["has_invite"]
        if sub.get("invite"):
            invite_value = f"{invite_value} · {sub['invite']}"
        context.append(f"<b>Has invite:</b>     {_esc(invite_value)}")
    if sub.get("volume"):
        context.append(f"<b>Volume:</b>         {_esc(sub['volume'])}")
    if sub.get("reach"):
        context.append(f"<b>Reach:</b>          {_esc(sub['reach'])}")
    if sub.get("affiliate"):
        context.append(f"<b>Affiliate:</b>      {_esc(sub['affiliate'])}")

    protection = sub.get("protection_from") or []
    if protection:
        joined = ", ".join(p for p in protection if p)
        if joined:
            context.append(f"<b>Protection from:</b> {_esc(joined)}")

    if context:
        lines.append("")
        lines.extend(context)

    notes = (sub.get("notes") or "").strip()
    if notes:
        lines.append("")
        lines.append("<b>Notes:</b>")
        lines.append(f"<i>{_esc(notes)}</i>")

    lines.append("")
    lines.append(f"Total signups: <b>{total}</b>")
    return "\n".join(lines)


def discord_message(
    *,
    guild_id: int | None,
    channel_id: int,
    channel_name: str,
    author: str,
    message_id: int | None,
    content: str,
    attachments: list[str] | None = None,
) -> str:
    lines = [f"💬 <b>Discord</b> · #<code>{_esc(channel_name)}</code>"]
    lines.append(f"<b>{_esc(author)}</b>")
    lines.append("")
    if content:
        lines.append(_esc(content))
    if attachments:
        att = ", ".join(_esc(a) for a in attachments)
        lines.append(f"<i>attachments: {att}</i>")
    if guild_id and message_id:
        link = f"https://discord.com/channels/{guild_id}/{channel_id}/{message_id}"
        lines.append("")
        lines.append(f'<a href="{link}">open in discord</a>')
    return "\n".join(lines)


@dataclass(frozen=True)
class GmailMessage:
    sender_name: str
    sender_email: str
    subject: str
    preview: str


def gmail_received(m: GmailMessage) -> str:
    if m.sender_name and m.sender_email:
        sender = f"<b>{_esc(m.sender_name)}</b>  <i>{_esc(m.sender_email)}</i>"
    elif m.sender_email:
        sender = f"<b>{_esc(m.sender_email)}</b>"
    else:
        sender = "<b>unknown sender</b>"

    subject = _esc(m.subject) if m.subject else "<i>(no subject)</i>"
    body = _esc(m.preview) if m.preview else "<i>(empty body)</i>"

    return (
        f"📧 <b>Gmail</b>\n"
        f"From: {sender}\n"
        f"Subject: <b>{subject}</b>\n\n"
        f"{body}"
    )
