"""Funding-rate mean reversion. Negative rate now? Bet it reverts to zero (UP)."""

from ._common import fetch_history


def generate_bets(market_ids: list[str]) -> list[bool]:
    out = []
    for m in market_ids:
        h = fetch_history(m, 1)
        out.append(h[0] < 0 if h else True)
    return out
