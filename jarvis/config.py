"""Centralised env + paths. Read once at startup; fail loud if a required var is missing."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE_DIR = ROOT / "state"
STATE_DIR.mkdir(exist_ok=True)


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


def _req(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        raise SystemExit(f"missing required env var: {name}")
    return v


def _opt(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


@dataclass(frozen=True)
class Config:
    telegram_bot_token: str
    telegram_chat_id: str

    waitlist_db_url: str
    waitlist_poll_seconds: int

    discord_enabled: bool
    discord_bot_token: str
    discord_channel_id: int

    gmail_enabled: bool
    gmail_user: str
    gmail_app_password: str
    gmail_poll_seconds: int


def load() -> Config:
    discord_enabled = _opt("DISCORD_ENABLED", "true").lower() == "true"
    gmail_enabled = _opt("GMAIL_ENABLED", "true").lower() == "true"

    return Config(
        telegram_bot_token=_req("TELEGRAM_BOT_TOKEN"),
        telegram_chat_id=_req("TELEGRAM_CHAT_ID"),
        waitlist_db_url=_req("WAITLIST_DATABASE_URL"),
        waitlist_poll_seconds=int(_opt("WAITLIST_POLL_SECONDS", "15")),
        discord_enabled=discord_enabled,
        discord_bot_token=_opt("DISCORD_BOT_TOKEN") if discord_enabled else "",
        discord_channel_id=int(_opt("DISCORD_CHANNEL_ID", "0")) if discord_enabled else 0,
        gmail_enabled=gmail_enabled,
        gmail_user=_opt("GMAIL_USER") if gmail_enabled else "",
        gmail_app_password=_opt("GMAIL_APP_PASSWORD") if gmail_enabled else "",
        gmail_poll_seconds=int(_opt("GMAIL_POLL_SECONDS", "30")),
    )
