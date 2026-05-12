"""Extreme funding rates revert. Above the threshold, bet toward zero."""

from ._common import fetch_history

THRESHOLD = 5.0  # |rate_bp*10| > 5 → outlier, bet reversion


def generate_bets(market_ids: list[str]) -> list[bool]:
    out = []
    for m in market_ids:
        h = fetch_history(m, 1)
        if h and abs(h[0]) > THRESHOLD:
            out.append(h[0] < 0)  # extreme negative → up; extreme positive → down
        else:
            out.append(True)
    return out
