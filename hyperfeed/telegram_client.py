"""Async Telegram Bot API wrapper. No deps beyond aiohttp.

Generalized off jarvis/telegram_client.py: `send` takes an explicit chat_id (the feed has many
subscribers, not one fixed chat), and `broadcast` fans a message out to a list of chats.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

import aiohttp

log = logging.getLogger("hyperfeed.tg")


class Telegram:
    def __init__(self, token: str):
        self._base = f"https://api.telegram.org/bot{token}"
        self._session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self) -> "Telegram":
        self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15))
        return self

    async def __aexit__(self, *exc) -> None:
        if self._session:
            await self._session.close()

    async def send(
        self,
        chat_id: int | str,
        text: str,
        *,
        html: bool = False,
        reply_to_message_id: int | None = None,
    ) -> int | None:
        """Send one message. Returns the Telegram message_id, or None on failure."""
        if not self._session:
            raise RuntimeError("Telegram client used outside async context")
        payload: dict[str, Any] = {
            "chat_id": chat_id,
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
                    log.error("telegram send failed (%s): %s %s", chat_id, r.status, body[:200])
                    return None
                data = await r.json()
                msg_id = (data.get("result") or {}).get("message_id")
                return int(msg_id) if msg_id is not None else None
        except aiohttp.ClientError as e:
            log.error("telegram network error: %s", e)
            return None

    async def broadcast(self, chat_ids: list[int], text: str, *, html: bool = False) -> int:
        """Send the same message to many chats. Returns the count delivered."""
        sent = 0
        for cid in chat_ids:
            if await self.send(cid, text, html=html) is not None:
                sent += 1
            await asyncio.sleep(0.05)   # stay clear of Telegram's per-second flood limits
        return sent

    async def get_updates(self, offset: int, timeout: int = 25) -> list[dict]:
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
