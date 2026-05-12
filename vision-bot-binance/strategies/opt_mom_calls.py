"""Calls-only momentum. Non-calls default UP — the bitmap covers every market.

Binance options asset_ids look like `binanceoptions_btc-260530-65000-c`. Suffix
`-c` marks calls, `-p` marks puts. See data-node/src/market_data/sources/
binance_options/client.rs:165."""

from ._common import fetch_history


def generate_bets(market_ids: list[str]) -> list[bool]:
    out = []
    for m in market_ids:
        if not m.endswith("-c"):
            out.append(True)
            continue
        h = fetch_history(m, 5)
        out.append(h[-1] > h[0] if len(h) >= 2 else True)
    return out
