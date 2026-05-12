"""Funding-rate momentum. Positive rate now? The carry persists — bet UP."""

from ._common import fetch_history


def generate_bets(market_ids: list[str]) -> list[bool]:
    out = []
    for m in market_ids:
        h = fetch_history(m, 1)
        out.append(h[0] > 0 if h else True)
    return out
