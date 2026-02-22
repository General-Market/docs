# Vision Strategy: Momentum

A momentum-based prediction strategy for Vision batches.

## How it works

For each market in a batch, the strategy fetches recent price history and measures the trend over a lookback window (default: 5 ticks). If the asset price increased over that window, it bets UP; otherwise DOWN.

This is a trend-following approach -- it assumes recent winners will keep winning in the short term.

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
- `LOOKBACK_TICKS` -- number of recent ticks to measure trend (default: 5)

## License

MIT
