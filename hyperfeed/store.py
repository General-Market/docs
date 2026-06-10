"""Tiny JSON / JSONL state persistence. The files in state/ are the source of truth at rest;
they survive container restarts via the bind-mounted state/ dir.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from . import config

log = logging.getLogger("hyperfeed.store")


def _load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception as e:
        log.warning("could not read %s: %s", path.name, e)
        return default


def _save_json(path: Path, obj) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2))
    tmp.replace(path)


# -- subscribers -------------------------------------------------------------

def load_subscribers() -> list[int]:
    return [int(x) for x in _load_json(config.SUBSCRIBERS_FILE, [])]


def add_subscriber(chat_id: int) -> bool:
    subs = load_subscribers()
    if chat_id in subs:
        return False
    subs.append(chat_id)
    _save_json(config.SUBSCRIBERS_FILE, subs)
    return True


def remove_subscriber(chat_id: int) -> bool:
    subs = load_subscribers()
    if chat_id not in subs:
        return False
    subs = [c for c in subs if c != chat_id]
    _save_json(config.SUBSCRIBERS_FILE, subs)
    return True


# -- accounts ----------------------------------------------------------------

def load_accounts() -> dict:
    return _load_json(config.ACCOUNTS_FILE, {})


def save_accounts(accounts: dict) -> None:
    _save_json(config.ACCOUNTS_FILE, accounts)


# -- calibration -------------------------------------------------------------

def load_calibration() -> dict:
    return _load_json(config.CALIBRATION_FILE, {})


def save_calibration(cal: dict) -> None:
    _save_json(config.CALIBRATION_FILE, cal)


# -- seen --------------------------------------------------------------------

def load_seen() -> dict:
    return _load_json(config.SEEN_FILE, {})


def save_seen(seen: dict) -> None:
    _save_json(config.SEEN_FILE, seen)


def _latest_ts(v):
    """seen value is either a legacy iso string or a {'followed':iso,'outlier':iso} dict."""
    if isinstance(v, dict):
        times = [t for t in v.values() if t]
        return max(times) if times else None
    return v


def prune_seen(seen: dict, max_age_hours: int) -> dict:
    now = datetime.now(timezone.utc)
    keep = {}
    for tid, v in seen.items():
        ts = _latest_ts(v)
        if not ts:
            keep[tid] = v
            continue
        try:
            if (now - datetime.fromisoformat(ts)).total_seconds() <= max_age_hours * 3600:
                keep[tid] = v
        except Exception:
            keep[tid] = v
    return keep


# -- fired log ---------------------------------------------------------------

def append_fired(row: dict) -> None:
    with config.FIRED_FILE.open("a") as f:
        f.write(json.dumps(row) + "\n")


def recent_fired(n: int) -> list[dict]:
    if not config.FIRED_FILE.exists():
        return []
    rows: list[dict] = []
    for line in config.FIRED_FILE.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return rows[-n:]


# -- telegram offset ---------------------------------------------------------

def load_offset() -> int:
    if not config.OFFSET_FILE.exists():
        return 0
    try:
        return int(config.OFFSET_FILE.read_text().strip())
    except Exception:
        return 0


def save_offset(offset: int) -> None:
    config.OFFSET_FILE.write_text(str(offset))
