"""Poll Postgres for new waitlist signups (submissions table). State = last-seen created_at."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

import asyncpg

from .config import Config, STATE_DIR
from .formatters import waitlist_signup
from .telegram_client import Telegram

log = logging.getLogger("jarvis.waitlist")
STATE_FILE = STATE_DIR / "submissions.json"


def _load_cursor() -> datetime:
    if not STATE_FILE.exists():
        return datetime.now(tz=timezone.utc)
    try:
        raw = json.loads(STATE_FILE.read_text())
        return datetime.fromisoformat(raw["last_seen"])
    except Exception:
        log.warning("submissions state unreadable, starting from now")
        return datetime.now(tz=timezone.utc)


def _save_cursor(ts: datetime) -> None:
    STATE_FILE.write_text(json.dumps({"last_seen": ts.isoformat()}))


async def poll_waitlist_loop(cfg: Config, tg: Telegram) -> None:
    pool = await asyncpg.create_pool(cfg.waitlist_db_url, min_size=1, max_size=2)
    try:
        cursor = _load_cursor()
        log.info("submissions watcher starting, cursor=%s", cursor.isoformat())

        while True:
            try:
                async with pool.acquire() as conn:
                    rows = await conn.fetch(
                        """
                        SELECT id, twitter, telegram, email, protection_from,
                               has_invite, invite, volume, affiliate, reach,
                               notes, wallet, ip, ua, created_at
                          FROM submissions
                         WHERE created_at > $1
                         ORDER BY created_at ASC
                        """,
                        cursor,
                    )
                    if rows:
                        total = await conn.fetchval("SELECT COUNT(*) FROM submissions")
                        for r in rows:
                            body = waitlist_signup(sub=dict(r), total=total)
                            await tg.send(body, html=True)
                            cursor = r["created_at"]
                        _save_cursor(cursor)
            except Exception as e:
                log.error("submissions poll error: %s", e)

            await asyncio.sleep(cfg.waitlist_poll_seconds)
    finally:
        await pool.close()
