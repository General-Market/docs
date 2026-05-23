"""Runtime ban/mute list for Gmail senders.

Persisted to state/blocklist.json. Separate from the hardcoded outreach
filter in gmail_poller.py — that one ships in the code, this one is
mutated by Telegram reply commands at runtime.
"""

from __future__ import annotations

import json
import logging

from .config import STATE_DIR

log = logging.getLogger("jarvis.block")

FILE = STATE_DIR / "blocklist.json"


def _default() -> dict[str, list[str]]:
    return {"banned_emails": [], "muted_emails": []}


def _load() -> dict[str, list[str]]:
    if not FILE.exists():
        return _default()
    try:
        d = json.loads(FILE.read_text())
        if not isinstance(d, dict):
            return _default()
        d.setdefault("banned_emails", [])
        d.setdefault("muted_emails", [])
        return d
    except Exception as e:
        log.warning("blocklist load failed, resetting: %s", e)
        return _default()


def _save(d: dict[str, list[str]]) -> None:
    FILE.write_text(json.dumps(d, indent=2))


def _norm(email: str) -> str:
    return (email or "").strip().lower()


def add_ban(email: str) -> bool:
    """Add to ban list. Returns True if newly added, False if already banned."""
    e = _norm(email)
    if not e:
        return False
    d = _load()
    if e in d["banned_emails"]:
        return False
    # Promotion: if previously muted, remove from mute side.
    if e in d["muted_emails"]:
        d["muted_emails"].remove(e)
    d["banned_emails"].append(e)
    _save(d)
    return True


def add_mute(email: str) -> bool:
    """Add to mute list. Returns True if newly added, False if already muted."""
    e = _norm(email)
    if not e:
        return False
    d = _load()
    if e in d["muted_emails"] or e in d["banned_emails"]:
        return False
    d["muted_emails"].append(e)
    _save(d)
    return True


def is_blocked(email: str) -> str | None:
    """Return 'banned', 'muted', or None."""
    e = _norm(email)
    if not e:
        return None
    d = _load()
    if e in d["banned_emails"]:
        return "banned"
    if e in d["muted_emails"]:
        return "muted"
    return None
