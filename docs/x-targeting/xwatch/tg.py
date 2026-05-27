"""Telegram Bot API over stdlib urllib. No external deps."""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

log = logging.getLogger("xwatch.tg")
BASE = "https://api.telegram.org"


class Telegram:
    def __init__(self, token: str, chat_id: str):
        self._base = f"{BASE}/bot{token}"
        self._chat_id = chat_id

    def _post(self, method: str, payload: dict, timeout: int = 20):
        url = f"{self._base}/{method}"
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read() if e.fp else b""
            log.error("telegram %s failed: %s %s", method, e.code, body[:200])
        except Exception as e:
            log.error("telegram %s error: %s", method, e)
        return None

    def send(self, text: str, html: bool = True, reply_to: int | None = None) -> int | None:
        payload = {
            "chat_id": self._chat_id,
            "text": text[:4096],
            "disable_web_page_preview": True,
        }
        if html:
            payload["parse_mode"] = "HTML"
        if reply_to is not None:
            payload["reply_to_message_id"] = reply_to
        res = self._post("sendMessage", payload)
        if res and res.get("ok"):
            return (res.get("result") or {}).get("message_id")
        return None

    def get_updates(self, offset: int, timeout: int = 25) -> list:
        url = f"{self._base}/getUpdates?" + urllib.parse.urlencode(
            {
                "offset": offset,
                "timeout": timeout,
                "allowed_updates": json.dumps(["message"]),
            }
        )
        try:
            with urllib.request.urlopen(url, timeout=timeout + 10) as r:
                return (json.load(r) or {}).get("result") or []
        except Exception as e:
            log.error("telegram getUpdates error: %s", e)
            return []
