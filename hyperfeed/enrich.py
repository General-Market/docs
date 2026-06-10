"""Client for the codex enrichment sidecar.

When an outlier fires, ask the host-side sidecar to web-search the tweet and return a sourced
confirm/dispute/context verdict. Returns the verdict text, or None on any failure — enrichment
is best-effort and must never block or break an alert.
"""
from __future__ import annotations

import logging

import aiohttp

log = logging.getLogger("hyperfeed.enrich")


async def enrich(url: str, timeout_s: int, *, text: str, handle: str) -> str | None:
    payload = {"text": text, "handle": handle}
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout_s)) as s:
            async with s.post(url, json=payload) as r:
                if r.status != 200:
                    log.warning("enrich http %s", r.status)
                    return None
                data = await r.json()
    except Exception as e:
        log.warning("enrich failed: %s", e)
        return None
    if not data.get("ok"):
        log.info("enrich no verdict: %s", data.get("reason"))
        return None
    txt = (data.get("text") or "").strip()
    return txt or None
