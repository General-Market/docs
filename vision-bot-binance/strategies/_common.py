"""Shared helpers for strategy modules."""

import os

import requests

PRICE_API = os.environ.get(
    "PRICE_API_BASE", "https://api.generalmarket.io/prices"
)


def fetch_history(market_id: str, limit: int) -> list[float]:
    """Return up to `limit` recent prices for `market_id`, oldest first.

    Empty list on any error — the strategy must handle that and pick a default."""
    try:
        r = requests.get(
            f"{PRICE_API}/history",
            params={"asset": market_id, "limit": limit},
            timeout=8,
        )
        if not r.ok:
            return []
        return [p["price"] for p in r.json().get("prices", [])]
    except requests.RequestException:
        return []
