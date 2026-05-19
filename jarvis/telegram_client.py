"""Thin async wrapper around the Telegram Bot HTTP API. No deps beyond aiohttp."""

from __future__ import annotations

import logging
from typing import Optional

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

    async def send(self, text: str, *, html: bool = False) -> None:
        if not self._session:
            raise RuntimeError("Telegram client used outside async context")
        payload = {
            "chat_id": self._chat_id,
            "text": text[:4096],
            "disable_web_page_preview": True,
        }
        if html:
            payload["parse_mode"] = "HTML"
        try:
            async with self._session.post(f"{self._base}/sendMessage", json=payload) as r:
                if r.status != 200:
                    body = await r.text()
                    log.error("telegram send failed: %s %s", r.status, body[:200])
        except aiohttp.ClientError as e:
            log.error("telegram network error: %s", e)
