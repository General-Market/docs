"""Config, env loading, and tiny JSON state persistence for xwatch.

Stdlib only — this is a local launchd daemon, no venv, no pip.
The single in-memory `settings` dict is the source of truth at runtime; it is
persisted to state/settings.json on every change so it survives a restart.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE_DIR = ROOT / "state"
STATE_DIR.mkdir(exist_ok=True)

SETTINGS_FILE = STATE_DIR / "settings.json"
SEEN_FILE = STATE_DIR / "seen.json"
OFFSET_FILE = STATE_DIR / "offset.txt"
LEDGER_FILE = STATE_DIR / "ledger.jsonl"
CALIBRATED_FLAG = STATE_DIR / ".calibrated"

PLACEHOLDER_TOKEN = "PUT-YOUR-BOTFATHER-TOKEN-HERE"


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = val


_load_dotenv(ROOT / ".env")


def twitter_key() -> str:
    k = os.environ.get("TWITTERAPI_API_KEY", "").strip()
    if k:
        return k
    legacy = Path("/tmp/.twapi_key")  # the twapi.py wrapper's key file, if still around
    if legacy.exists():
        return legacy.read_text().strip()
    # No key — return empty so the daemon stays up and reports it on Telegram
    # rather than crashing mid-scan. has_twitter_key() gates the spend paths.
    return ""


def has_twitter_key() -> bool:
    return bool(twitter_key())


def telegram_token() -> str:
    t = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not t or t == PLACEHOLDER_TOKEN:
        raise SystemExit(
            "missing TELEGRAM_BOT_TOKEN — create a bot with @BotFather, "
            "then put its token in xwatch/.env"
        )
    return t


def telegram_chat_id() -> str:
    # Defaults to Max's user id — the same chat Jarvis pings.
    return os.environ.get("TELEGRAM_CHAT_ID", "5688211833").strip()


DEFAULT_SETTINGS = {
    "query": "insider trading",
    "threshold": 15,          # min_faves — deliberately low: tweets are caught ~1h old
    "lang": "en",             # set "" to disable the lang filter
    "start_hour": 10,         # local clock — watch window opens
    "end_hour": 22,           # local clock — watch window closes (exclusive)
    "lookback_hours": 3,      # how far back each scan looks
    "scan_interval_min": 30,
    "max_pings_per_scan": 8,
    "daily_cap_usd": 0.50,    # soft cap on estimated twitterapi.io spend
    "paused": False,
}


def load_settings() -> dict:
    s = dict(DEFAULT_SETTINGS)
    if SETTINGS_FILE.exists():
        try:
            s.update(json.loads(SETTINGS_FILE.read_text()))
        except Exception:
            pass
    return s


def save_settings(s: dict) -> None:
    SETTINGS_FILE.write_text(json.dumps(s, indent=2))


def load_seen() -> dict:
    if SEEN_FILE.exists():
        try:
            return json.loads(SEEN_FILE.read_text())
        except Exception:
            return {}
    return {}


def save_seen(seen: dict) -> None:
    SEEN_FILE.write_text(json.dumps(seen))


def prune_seen(seen: dict, max_age_h: int = 48) -> dict:
    now = datetime.now(timezone.utc)
    keep = {}
    for tid, ts in seen.items():
        try:
            if (now - datetime.fromisoformat(ts)).total_seconds() <= max_age_h * 3600:
                keep[tid] = ts
        except Exception:
            keep[tid] = ts
    return keep


def load_offset() -> int:
    if OFFSET_FILE.exists():
        try:
            return int(OFFSET_FILE.read_text().strip())
        except Exception:
            return 0
    return 0


def save_offset(offset: int) -> None:
    OFFSET_FILE.write_text(str(offset))
