"""Funding-rate sign-flip detector. Bet UP iff the last two samples disagree."""

from ._common import fetch_history


def generate_bets(market_ids: list[str]) -> list[bool]:
    out = []
    for m in market_ids:
        h = fetch_history(m, 2)
        if len(h) >= 2:
            out.append((h[-1] > 0) != (h[-2] > 0))
        else:
            out.append(True)
    return out
