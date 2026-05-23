"""Thin async wrapper around the Telegram Bot HTTP API. No deps beyond aiohttp."""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import aiohttp

log = logging.getLogger("jarvis.tg")


class Telegram:
    def __init__(self, token: str, chat_id: str):
        self._base = f"https://api.telegram.org/bot{token}"
        self._chat_id = chat_id
        self._session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self) -> "Telegram":
        self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15))
        return self

    async def __aexit__(self, *exc) -> None:
        if self._session:
            await self._session.close()

    async def send(
        self,
        text: str,
        *,
        html: bool = False,
        reply_to_message_id: int | None = None,
    ) -> int | None:
        """Send a message. Returns the Telegram message_id, or None on failure."""
        if not self._session:
            raise RuntimeError("Telegram client used outside async context")
        payload: dict[str, Any] = {
            "chat_id": self._chat_id,
            "text": text[:4096],
            "disable_web_page_preview": True,
        }
        if html:
            payload["parse_mode"] = "HTML"
        if reply_to_message_id is not None:
            payload["reply_to_message_id"] = reply_to_message_id
        try:
            async with self._session.post(f"{self._base}/sendMessage", json=payload) as r:
                if r.status != 200:
                    body = await r.text()
                    log.error("telegram send failed: %s %s", r.status, body[:200])
                    return None
                data = await r.json()
                result = data.get("result") or {}
                msg_id = result.get("message_id")
                return int(msg_id) if msg_id is not None else None
        except aiohttp.ClientError as e:
            log.error("telegram network error: %s", e)
            return None

    async def get_updates(self, offset: int, timeout: int = 25) -> list[dict]:
        """Long-poll Telegram for updates. Returns a list of update dicts."""
        if not self._session:
            raise RuntimeError("Telegram client used outside async context")
        params = {
            "offset": offset,
            "timeout": timeout,
            "allowed_updates": json.dumps(["message"]),
        }
        try:
            async with self._session.get(
                f"{self._base}/getUpdates",
                params=params,
                timeout=aiohttp.ClientTimeout(total=timeout + 10),
            ) as r:
                if r.status != 200:
                    body = await r.text()
                    log.error("telegram getUpdates failed: %s %s", r.status, body[:200])
                    return []
                data = await r.json()
                return data.get("result") or []
        except aiohttp.ClientError as e:
            log.error("telegram getUpdates network error: %s", e)
            return []
        except Exception as e:
            log.error("telegram getUpdates error: %s", e)
            return []
