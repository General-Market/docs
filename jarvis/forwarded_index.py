"""Maps Telegram message_id → metadata about the source it carried.

Persisted to state/forwarded.json. Capped at MAX_ENTRIES with FIFO eviction
of the oldest insertions, since Telegram replies on messages older than a
few weeks are vanishingly rare.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from .config import STATE_DIR

log = logging.getLogger("jarvis.fwd")

INDEX_FILE = STATE_DIR / "forwarded.json"
MAX_ENTRIES = 500


def _load() -> dict[str, dict[str, Any]]:
    if not INDEX_FILE.exists():
        return {}
    try:
        data = json.loads(INDEX_FILE.read_text())
        return data if isinstance(data, dict) else {}
    except Exception as e:
        log.warning("forwarded_index load failed, resetting: %s", e)
        return {}


def _save(d: dict[str, dict[str, Any]]) -> None:
    INDEX_FILE.write_text(json.dumps(d))


def record(tg_msg_id: int, *, source: str, **meta: Any) -> None:
    if tg_msg_id is None:
        return
    d = _load()
    d[str(tg_msg_id)] = {"source": source, **meta}
    if len(d) > MAX_ENTRIES:
        # Python dicts preserve insertion order, so the first N keys are the oldest.
        keys = list(d.keys())
        for k in keys[: len(keys) - MAX_ENTRIES]:
            del d[k]
    _save(d)


def lookup(tg_msg_id: int) -> dict[str, Any] | None:
    return _load().get(str(tg_msg_id))
