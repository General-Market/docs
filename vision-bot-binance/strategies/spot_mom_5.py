"""Momentum on a 5-sample window. If the last price beat the first, bet UP."""

from ._common import fetch_history


def generate_bets(market_ids: list[str]) -> list[bool]:
    out = []
    for m in market_ids:
        h = fetch_history(m, 5)
        out.append(h[-1] > h[0] if len(h) >= 2 else True)
    return out
