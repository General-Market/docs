"""Poll Gmail IMAP for new inbox messages.

State = max UID we've already considered. On first run we snapshot the current
high-water mark and forward nothing — Telegram is not a backfill device. After
that, every poll looks for UIDs strictly greater than the cursor that are also
UNSEEN. Cap per cycle to avoid flooding Telegram.
"""

from __future__ import annotations

import asyncio
import email
import json
import logging
import re
from email.header import decode_header, make_header
from email.utils import parseaddr

from imapclient import IMAPClient

from . import blocklist, forwarded_index
from .config import Config, STATE_DIR
from .formatters import GmailMessage, gmail_received
from .telegram_client import Telegram

log = logging.getLogger("jarvis.gmail")
STATE_FILE = STATE_DIR / "gmail.json"
IMAP_HOST = "imap.gmail.com"
MAX_PER_POLL = 10

# Outreach / warmup detection. Patterns that overwhelmingly indicate cold
# sales blast or deliverability-training mail (PlusVibe, Lemwarm, etc).
# Extend the lists below as new offenders surface — order doesn't matter,
# any match drops the message.
OUTREACH_SUBJECT_PATTERNS: list[re.Pattern] = [
    re.compile(r"\b3CYMYP8\b"),
    re.compile(r"\bSPF\s+DKIM\s+DMARC\b", re.IGNORECASE),
    re.compile(r"\bPlusVibe\b", re.IGNORECASE),
    re.compile(r"\bLemwarm\b", re.IGNORECASE),
    re.compile(r"\ballaccs\b", re.IGNORECASE),
    re.compile(r"\|\s*[A-Z0-9]{6,8}\s+[A-Z0-9]{6,8}\s*$"),
]

OUTREACH_SENDER_DOMAINS: set[str] = {
    "joinconversionstack.com",
    "veloryxgroup.com",
}


def _is_outreach(msg: GmailMessage) -> str | None:
    """Return a short reason string if msg looks like cold/warmup mail, else None."""
    subj = msg.subject or ""
    for p in OUTREACH_SUBJECT_PATTERNS:
        if p.search(subj):
            return f"subject:{p.pattern}"
    sender = (msg.sender_email or "").lower()
    for dom in OUTREACH_SENDER_DOMAINS:
        if sender.endswith("@" + dom) or sender.endswith("." + dom):
            return f"sender-domain:{dom}"
    return None


def _drop_reason(msg: GmailMessage) -> str | None:
    """Combined check: hardcoded outreach + runtime ban/mute list."""
    reason = _is_outreach(msg)
    if reason:
        return reason
    blocked = blocklist.is_blocked(msg.sender_email)
    if blocked:
        return f"runtime-{blocked}"
    return None


def _load_max_uid() -> int:
    if not STATE_FILE.exists():
        return 0
    try:
        return int(json.loads(STATE_FILE.read_text()).get("max_uid", 0))
    except Exception:
        return 0


def _save_max_uid(uid: int) -> None:
    STATE_FILE.write_text(json.dumps({"max_uid": uid}))


def _decode(h: str | None) -> str:
    if not h:
        return ""
    try:
        return str(make_header(decode_header(h)))
    except Exception:
        return h


def _extract_preview(msg: email.message.Message, limit: int = 500) -> str:
    text = ""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = str(part.get("Content-Disposition") or "")
            if ctype == "text/plain" and "attachment" not in disp:
                payload = part.get_payload(decode=True) or b""
                charset = part.get_content_charset() or "utf-8"
                try:
                    text = payload.decode(charset, errors="replace")
                except Exception:
                    text = payload.decode("utf-8", errors="replace")
                break
    else:
        payload = msg.get_payload(decode=True) or b""
        charset = msg.get_content_charset() or "utf-8"
        text = payload.decode(charset, errors="replace")
    text = " ".join(text.split())
    return text[:limit]


def _fetch_messages(uids: list[int], client: IMAPClient) -> list[GmailMessage]:
    if not uids:
        return []
    data = client.fetch(uids, [b"BODY.PEEK[]"])
    out: list[GmailMessage] = []
    for uid in uids:
        raw = data.get(uid, {}).get(b"BODY[]")
        if not raw:
            continue
        msg = email.message_from_bytes(raw)
        subject = _decode(msg.get("Subject"))
        from_raw = _decode(msg.get("From"))
        name, addr = parseaddr(from_raw)
        out.append(GmailMessage(
            sender_name=name or "",
            sender_email=addr or from_raw,
            subject=subject or "",
            preview=_extract_preview(msg),
        ))
    return out


def _run_one_poll(cfg: Config, max_uid: int) -> tuple[list[GmailMessage], int, bool]:
    """Return (messages_to_forward, new_max_uid, bootstrapped)."""
    with IMAPClient(IMAP_HOST, ssl=True, timeout=30) as client:
        client.login(cfg.gmail_user, cfg.gmail_app_password)
        client.select_folder("INBOX", readonly=True)

        all_uids = client.search(["ALL"])
        if not all_uids:
            return [], max_uid, False

        current_max = max(all_uids)

        if max_uid == 0:
            return [], current_max, True

        candidates = [u for u in all_uids if u > max_uid]
        if not candidates:
            return [], current_max, False

        unseen = set(client.search(["UNSEEN"]))
        new_uids = sorted(u for u in candidates if u in unseen)
        if not new_uids:
            return [], current_max, False

        to_fetch = new_uids[:MAX_PER_POLL]
        fetched = _fetch_messages(to_fetch, client)
        keepers: list[GmailMessage] = []
        for m in fetched:
            reason = _drop_reason(m)
            if reason:
                log.info(
                    "skipped: from=%s subj=%r (%s)",
                    m.sender_email,
                    (m.subject or "")[:80],
                    reason,
                )
            else:
                keepers.append(m)
        return keepers, max(current_max, to_fetch[-1]), False


async def poll_gmail_loop(cfg: Config, tg: Telegram) -> None:
    log.info("gmail watcher starting for %s", cfg.gmail_user)
    max_uid = _load_max_uid()

    while True:
        try:
            messages, new_max_uid, bootstrapped = await asyncio.to_thread(
                _run_one_poll, cfg, max_uid
            )
            if bootstrapped:
                log.info("gmail bootstrap complete, max_uid=%d (pre-existing mail ignored)", new_max_uid)
            for m in messages:
                msg_id = await tg.send(gmail_received(m), html=True)
                if msg_id is not None:
                    forwarded_index.record(
                        msg_id,
                        source="gmail",
                        sender_email=m.sender_email,
                        sender_name=m.sender_name,
                    )
            if new_max_uid != max_uid:
                max_uid = new_max_uid
                _save_max_uid(max_uid)
        except Exception as e:
            log.error("gmail poll error: %s", e)

        await asyncio.sleep(cfg.gmail_poll_seconds)


def _trash_folder(client: IMAPClient) -> str:
    """Find Gmail's Trash folder via IMAP SPECIAL-USE — works across locales."""
    try:
        for flags, _delim, name in client.list_folders():
            if b"\\Trash" in flags:
                return name
    except Exception as e:
        log.warning("list_folders failed (%s), falling back to [Gmail]/Trash", e)
    return "[Gmail]/Trash"


def trash_sender_messages(cfg: Config, sender_email: str) -> int:
    """Move every INBOX message from sender_email to Gmail's Trash.

    Used by the ban command. Synchronous IMAP call — callers should wrap
    in asyncio.to_thread. Returns the count moved.
    """
    sender = (sender_email or "").strip()
    if not sender:
        return 0
    with IMAPClient(IMAP_HOST, ssl=True, timeout=30) as client:
        client.login(cfg.gmail_user, cfg.gmail_app_password)
        trash = _trash_folder(client)
        client.select_folder("INBOX", readonly=False)
        uids = client.search(["FROM", sender])
        if not uids:
            return 0
        try:
            client.move(uids, trash)
        except Exception as e:
            log.warning("move to %s failed (%s), falling back to flag+expunge", trash, e)
            client.add_flags(uids, [b"\\Deleted"])
            client.expunge()
        return len(uids)
