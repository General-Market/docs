# Vision Strategy: Mean Reversion

A contrarian prediction strategy for Vision batches.

## How it works

For each market in a batch, the strategy fetches recent price history and measures the percentage change over a lookback window. If the asset dropped by more than the threshold, it bets UP (expecting a bounce). If it rose by more than the threshold, it bets DOWN (expecting a pullback).

Moves smaller than the threshold default to UP.

## Usage

```python
from strategy import generate_bets

batch_state = {
    "market_ids": ["BTC", "ETH", "SOL"],
    "market_count": 3,
}

bets = generate_bets(batch_state)
# [True, False, True] -- True=UP, False=DOWN
```

Plug the output into the bitmap encoder and bot join flow:

```python
from encode import encode_bitmap  # from vision-bitmap-encoder example

bitmap_bytes, bitmap_hash = encode_bitmap(bets)
```

## Configuration

Edit the constants at the top of `strategy.py`:

- `PRICE_API` -- endpoint for fetching price data
- `LOOKBACK_TICKS` -- number of recent ticks to measure deviation (default: 5)
- `THRESHOLD_PCT` -- minimum percentage move to trigger a contrarian bet (default: 0.5%)

## License

MIT
