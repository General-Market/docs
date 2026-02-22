"""
Vision Strategy: Mean Reversion

Bets opposite to the recent price direction. If an asset went up recently,
bet DOWN (expecting it to revert); if it went down, bet UP.

Uses the General Market price API to fetch recent price data.
"""

import requests

PRICE_API = "https://generalmarket.io/api/prices"
LOOKBACK_TICKS = 5  # Number of recent ticks to measure deviation
THRESHOLD_PCT = 0.5  # Minimum % move to trigger a contrarian bet


def fetch_prices(asset_ids: list[str], ticks: int = LOOKBACK_TICKS) -> dict[str, list[float]]:
    """Fetch recent price history for each asset from the data-node API."""
    prices: dict[str, list[float]] = {}
    for asset_id in asset_ids:
        try:
            resp = requests.get(
                f"{PRICE_API}/history",
                params={"asset": asset_id, "limit": ticks},
                timeout=10,
            )
            if resp.ok:
                data = resp.json()
                prices[asset_id] = [p["price"] for p in data.get("prices", [])]
        except requests.RequestException:
            prices[asset_id] = []
    return prices


def generate_bets(batch_state: dict) -> list[bool]:
    """
    Generate mean-reversion bets for a batch.

    Args:
        batch_state: Dict with at least:
            - market_ids: list of asset/market identifiers
            - market_count: number of markets

    Returns:
        List of booleans: True = UP (expecting reversion up), False = DOWN.
    """
    market_ids = batch_state.get("market_ids", [])
    prices = fetch_prices(market_ids)
    bets: list[bool] = []

    for market_id in market_ids:
        history = prices.get(market_id, [])
        if len(history) >= 2 and history[0] != 0:
            pct_change = (history[-1] - history[0]) / history[0] * 100
            if abs(pct_change) >= THRESHOLD_PCT:
                # Bet opposite to the recent move (mean reversion)
                bets.append(pct_change < 0)  # UP if price dropped
            else:
                # Move too small -- default to UP
                bets.append(True)
        else:
            # No data -- default to UP
            bets.append(True)

    return bets


if __name__ == "__main__":
    # Demo with synthetic batch state
    demo_state = {
        "market_ids": ["BTC", "ETH", "SOL", "AVAX", "DOGE"],
        "market_count": 5,
    }
    bets = generate_bets(demo_state)
    labels = ["UP" if b else "DOWN" for b in bets]
    for market, label in zip(demo_state["market_ids"], labels):
        print(f"  {market}: {label}")
