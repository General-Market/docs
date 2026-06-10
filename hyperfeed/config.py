"""Centralised env, paths, and tunables. Read once at startup; fail loud on a missing required var.

Mirrors the jarvis/xwatch dotenv pattern. The twitter key is read lazily by twitter.py so the
daemon stays up and reports a missing key on Telegram rather than crashing mid-scan.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE_DIR = ROOT / "state"
STATE_DIR.mkdir(exist_ok=True)

ACCOUNTS_FILE = STATE_DIR / "accounts.json"
CALIBRATION_FILE = STATE_DIR / "calibration.json"
SUBSCRIBERS_FILE = STATE_DIR / "subscribers.json"
SEEN_FILE = STATE_DIR / "seen.json"
FIRED_FILE = STATE_DIR / "fired.jsonl"
LEDGER_FILE = STATE_DIR / "ledger.jsonl"
OFFSET_FILE = STATE_DIR / "offset.txt"

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


def _opt(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Config:
    telegram_bot_token: str

    x_targeting_dir: str          # bind-mounted radar source for the live HL vocab
    twitterapi_key: str           # resolved key string ("" if none found)
    seed_handle: str              # whose followings we harvest (vibe_trading)

    max_accounts: int
    scan_interval_min: int
    scan_lookback_min: int        # search window per scan; > interval so cycles overlap
    calibration_window_days: int
    threshold_percentile: int     # historical outlier_score percentile that becomes the fire line
    author_min_age_hours: int     # ignore a tweet younger than this when forming a baseline
    daily_cap_usd: float
    seen_max_age_hours: int


def _resolve_twitter_key() -> str:
    k = _opt("TWITTERAPI_API_KEY").strip()
    if k:
        return k
    for candidate in (_opt("TWITTERAPI_KEY_FILE"), "/root/.secrets/twitterapi_io_key", "/tmp/.twapi_key"):
        if candidate:
            p = Path(candidate)
            if p.exists():
                txt = p.read_text().strip()
                if txt:
                    return txt
    return ""


def load() -> Config:
    token = _opt("TELEGRAM_BOT_TOKEN").strip()
    if not token or token == PLACEHOLDER_TOKEN:
        raise SystemExit(
            "missing TELEGRAM_BOT_TOKEN — create a bot with @BotFather, then put its token in hyperfeed/.env"
        )
    return Config(
        telegram_bot_token=token,
        x_targeting_dir=_opt("X_TARGETING_DIR", str(ROOT.parent / "docs" / "x-targeting")),
        twitterapi_key=_resolve_twitter_key(),
        seed_handle=_opt("VIBE_SEED_HANDLE", "vibe_trading").lstrip("@"),
        max_accounts=_int("MAX_ACCOUNTS", 40),
        scan_interval_min=_int("SCAN_INTERVAL_MIN", 10),
        scan_lookback_min=_int("SCAN_LOOKBACK_MIN", 15),
        calibration_window_days=_int("CALIBRATION_WINDOW_DAYS", 30),
        threshold_percentile=_int("THRESHOLD_PERCENTILE", 90),
        author_min_age_hours=_int("AUTHOR_MIN_AGE_HOURS", 6),
        daily_cap_usd=_float("DAILY_CAP_USD", 0.50),
        seen_max_age_hours=_int("SEEN_MAX_AGE_HOURS", 48),
    )
