---
title: Portfolio and simulation
navTitle: Portfolio & simulation
description: Positions, trade history, PnL curves, and the SSE-streaming index backtester.
order: 12
group: Index API
mode: reference
---

```gmplain
These endpoints answer two questions. First: what does a wallet hold, what did it trade, and how has it done over time. Second: how would an index strategy have performed in the past — the backtester runs a full historical simulation and streams its progress to you live while it computes.
```

```gmsummary
GET /dn/portfolio :: Current positions with cost basis and unrealized PnL
GET /dn/portfolio/history :: Day-by-day portfolio value replayed from trades
GET /dn/portfolio/trades :: Every order the wallet placed, display-formatted
GET /account/{address}/pnl-history :: Precomputed PnL curve in four ranges
GET /dn/sim/categories :: The category universe the backtester can simulate
GET /dn/sim/run-stream :: Run one backtest, streamed over SSE
GET /dn/sim/sweep-stream :: Run a parameter sweep, one SSE event per variant
GET /dn/sim/holdings :: What the simulated index held at a rebalance date
GET /dn/sim/results :: Previously computed runs, newest first
GET /dn/sim/benchmarks :: BTC and ETH series normalized to 1.0 for comparison
```

Base URL `https://generalmarket.io/api`. No authentication on any endpoint here as deployed — the sim endpoints carry an optional bearer-token gate in code (`SIM_AUTH_TOKEN`); when that env var is unset the gate is off, and the app itself sends no token. Endpoints under `/dn/` proxy into the data-node; the proxy streams SSE without buffering and allows up to 5 minutes per request, because a cold backtest can take that long.

**Testnet only.** All positions and PnL figures describe testnet funds.

## GET /dn/portfolio

Returns a wallet's current DTF positions with cost basis and unrealized PnL, computed from its filled trades.

```gm-try
{"method": "GET", "path": "/dn/portfolio", "params": [{"name": "user", "in": "query", "type": "string", "required": true, "desc": "Wallet address (lowercased internally)"}], "body": null, "response": {"user": "0xabc…", "positions": [{"itp_id": "0x0000000000000000000000000000000000000000000000000000000000000001", "shares_bought": "100.0000", "shares_sold": "20.0000", "avg_cost": "1.000000", "current_nav": "1.052340", "current_value": "84.19", "pnl": "4.19", "pnl_pct": "5.2"}], "total_value": "84.19", "total_invested": "80.00", "total_pnl": "4.19", "total_pnl_pct": "5.2"}}
```

- Positions are aggregated per DTF from filled trades: buys accumulate shares and cost, sells reduce shares. Average cost is volume-weighted over buys. Positions with zero or negative net shares are dropped.
- `current_nav` is computed live the same way as `GET /itp-price` — see [Prices and DTFs](/docs/developers/index-api/markets) (~5 min).
- All numbers are display-formatted decimal strings: shares to 4 places, NAV and cost to 6, values and PnL to 2, percentages to 1. These are *not* wei-scale — the raw 18-decimal values live in the trades, not here.
- A wallet with no fills returns empty `positions` and zeroed totals, status 200.

## GET /dn/portfolio/history

Returns the wallet's portfolio value day by day, computed by replaying its trades against each DTF's historical NAV.

```gm-try
{"method": "GET", "path": "/dn/portfolio/history", "params": [{"name": "user", "in": "query", "type": "string", "required": true, "desc": "Wallet address"}, {"name": "days", "in": "query", "type": "number", "required": false, "desc": "Lookback window in days (default 30)"}], "body": null, "response": {"points": [{"date": "2026-06-09", "value": 84.19, "pnl": 4.19, "pnl_pct": 5.2}]}}
```

- One point per day across the window. `value` is the mark-to-market portfolio value, `pnl` is value minus cumulative cost basis, `pnl_pct` the same as a percentage. Numbers, not strings, rounded to 2 (value, pnl) and 1 (pnl_pct) decimal places.
- Days before the wallet's first trade are omitted. A wallet with no filled trades returns `{"points": []}`.
- NAV history comes from stored basket snapshots, so the curve stays correct across rebalances.

## GET /dn/portfolio/trades

Returns every order the wallet has placed, newest first, display-formatted.

```gm-try
{"method": "GET", "path": "/dn/portfolio/trades", "params": [{"name": "user", "in": "query", "type": "string", "required": true, "desc": "Wallet address"}], "body": null, "response": {"trades": [{"order_id": 4211, "itp_id": "0x0000000000000000000000000000000000000000000000000000000000000001", "side": "BUY", "amount": "100.00", "fill_price": "1.000000", "shares": "100.0000", "status": "filled", "timestamp": "2026-06-09T14:02:11+00:00"}]}}
```

- `side` is `BUY` or `SELL`. For buys, `amount` is USDC spent; for sells, shares sold — both divided down from 18 decimals and formatted to 2 places. **L3 USDC has 18 decimals.**
- `fill_price` and `shares` are `null` until the order fills.
- `status` is `pending`, `filled`, or `unknown(N)` for any other on-chain status code — cancelled and expired orders surface as `unknown(3)` etc. on this endpoint.

## GET /account/{address}/pnl-history

Returns a precomputed account PnL curve — the chart behind the account page — in one of four ranges.

```gm-try
{"method": "GET", "path": "/account/{address}/pnl-history", "params": [{"name": "address", "in": "path", "type": "string", "required": true, "desc": "Wallet address"}, {"name": "range", "in": "query", "type": "string", "required": false, "desc": "1d | 1w | 1m | all (default all; invalid values fall back to all)"}], "body": null, "response": {"range": "1w", "bucket_secs": 2100, "points": [{"ts": 1765365600000, "value": 84.19, "cost": 80.0, "pnl": 4.19, "realized_pnl": 0.5}], "last_updated": "2026-06-10T12:00:00+00:00"}}
```

- The curve is written ahead of time by a background job; this endpoint only reads it. Cached 30 seconds.
- Bucket width follows the range: `1d` → 300 s, `1w` → 2100 s, `1m` → 10 800 s, `all` → 21 600 s. At most 500 points.
- `ts` is unix **milliseconds**. `pnl` is total (realized + unrealized); `realized_pnl` is the locked-in part.
- Errors: every failure — malformed address included — returns `502` with an empty-points body, so charts degrade instead of breaking. The data-node rejects a bad address with `400`, but the proxy converts any upstream error into the `502` shape.

## GET /dn/sim/categories

Returns the category universe the backtester can simulate — CoinGecko categories plus DefiLlama (`dl-`) categories, served from memory.

```gm-try
{"method": "GET", "path": "/dn/sim/categories", "params": [], "body": null, "response": {"categories": [{"id": "layer-1", "name": "Layer 1 (L1)", "coin_count": 214, "market_cap": 2400000000000, "source": "coingecko"}]}}
```

- Stablecoin, wrapped-token, and bridged-token categories are filtered out — an index of pegged assets backtests to a flat line.
- `source` is `coingecko` or `defillama`. DefiLlama categories enable the TVL/fees/revenue weighting strategies on the run endpoint.

## GET /dn/sim/run-stream

Runs one backtest and streams progress and the final result over Server-Sent Events. This is the real simulator: it walks the category's daily history, rebalances on schedule, charges fees per trade, and handles delistings.

```gm-try
{"method": "GET", "path": "/dn/sim/run-stream", "params": [{"name": "category_id", "in": "query", "type": "string", "required": true, "desc": "Category id from /dn/sim/categories"}, {"name": "top_n", "in": "query", "type": "number", "required": true, "desc": "Basket size: top N coins by market cap"}, {"name": "weighting", "in": "query", "type": "string", "required": true, "desc": "equal | mcap | momentum_N | invvol_N | dual_mom_N | …"}, {"name": "rebalance_days", "in": "query", "type": "number", "required": true, "desc": "Days between rebalances"}, {"name": "base_fee_pct", "in": "query", "type": "number", "required": false, "desc": "Fee per trade in percent (default 0.1)"}, {"name": "spread_multiplier", "in": "query", "type": "number", "required": false, "desc": "Spread cost multiplier (default 1.0)"}, {"name": "threshold_pct", "in": "query", "type": "number", "required": false, "desc": "Drift-band rebalancing instead of periodic"}, {"name": "start_date", "in": "query", "type": "string", "required": false, "desc": "YYYY-MM-DD"}, {"name": "force", "in": "query", "type": "boolean", "required": false, "desc": "true bypasses the run cache"}], "body": null, "response": {"type": "result", "run_id": 1042, "config": {"category_id": "layer-1", "top_n": 10, "weighting": "equal", "rebalance_days": 30, "base_fee_pct": 0.1, "spread_multiplier": 1.0}, "stats": {"total_return_pct": 41.2, "annualized_return": 18.7, "max_drawdown_pct": -33.1, "sharpe_ratio": 0.9, "total_fees_pct": 1.2, "total_trades": 84, "total_rebalances": 12, "total_delistings": 1, "start_date": "2025-06-10", "end_date": "2026-06-10"}, "nav_series": [{"nav_date": "2026-06-10", "nav": 1.412, "drawdown_pct": -2.1}], "cached": false, "computed_in_ms": 8412}}
```

The stream format, honestly:

- The response is `text/event-stream`. Every message is a plain `data:` line — **no `event:` names, no `id:` fields**. Parse `event.data` as JSON and switch on its `type` field.
- `{"type": "progress", "current_date": "...", "total_dates": N, "pct": 0–100}` — repeated while the simulation walks history.
- `{"type": "result", ...}` — the final payload (shape above), then the stream ends.
- `{"type": "error", "error": "..."}` — terminal failure (e.g. `not enough coins: 4 available, 10 required`).
- A cache hit skips progress entirely: one `result` event with `"cached": true` and the stream closes. Identical parameters hit the cache unless `force=true`.
- Budget for minutes, not seconds: a cold run can take 2–5 minutes; the proxy allows 300 s. `EventSource` works as-is — no headers needed.

Parameter notes:

- `weighting` accepts strategy families with a lookback suffix in days: `equal`, `mcap`, `momentum_90`, `invvol_60`, `dual_mom_180`, and more (the sweep endpoint below enumerates the full set). Invalid values return `400` before any streaming starts.
- Regime overlays are optional query params: `fng_mode` (+ `fng_fear_threshold`, `fng_greed_threshold`, `fng_cash_pct`) switches behaviour on the Fear & Greed index; `dom_mode` (+ `dom_lookback`) on BTC dominance; `vc_mode` (+ `vc_investors`, `vc_min_amount_m`, `vc_round_types`) filters the universe by venture funding.

## GET /dn/sim/sweep-stream

Runs a whole family of backtests varying one dimension, streaming each variant's result as it lands. Same SSE format as the run stream, with variant-tagged events.

```gm-try
{"method": "GET", "path": "/dn/sim/sweep-stream", "params": [{"name": "sweep", "in": "query", "type": "string", "required": true, "desc": "top_n | weighting | rebalance | threshold | category | fng_regime | dom_regime | defi_weight"}, {"name": "category_id", "in": "query", "type": "string", "required": false, "desc": "Category to sweep within (all dimensions except category)"}, {"name": "categories", "in": "query", "type": "string", "required": false, "desc": "Comma-separated ids — required when sweep=category"}, {"name": "top_n", "in": "query", "type": "number", "required": false, "desc": "Fixed basket size (default 10)"}, {"name": "weighting", "in": "query", "type": "string", "required": false, "desc": "Fixed weighting (default equal)"}, {"name": "rebalance_days", "in": "query", "type": "number", "required": false, "desc": "Fixed rebalance interval (default 30)"}], "body": null, "response": {"type": "variant_done", "variant": "top_n=20", "variant_index": 2, "total_variants": 7, "run_id": 1043, "stats": {"total_return_pct": 38.0, "annualized_return": 17.1, "max_drawdown_pct": -35.0, "sharpe_ratio": 0.8, "total_fees_pct": 1.4, "total_trades": 120, "total_rebalances": 12, "total_delistings": 2, "start_date": "2025-06-10", "end_date": "2026-06-10"}, "nav_series": [], "cached": false}}
```

What each sweep dimension runs:

| sweep | Variants |
|---|---|
| `top_n` | 5, 10, 20, 30, 50, 100, 200 |
| `weighting` | 11 strategy families (equal, mcap, capped/sqrt mcap, momentum, inverse-vol, dual momentum, risk parity, min variance, multi-factor, low vol) + 9 DeFi strategies for `dl-` categories |
| `rebalance` | periodic 14/30/60/90/180 days + drift bands 3/5/10/15% |
| `threshold` | legacy alias: no band + 3/5/10/15% drift bands |
| `category` | one variant per id in `categories` |
| `fng_regime` | off, contrarian, risk_toggle, cash_shift, graduated_cash, quality_rotation, trend_follow |
| `dom_regime` | off, alts_when_low, alts_when_falling, btc_when_high, combo, momentum |
| `defi_weight` | TVL, capped TVL, sqrt TVL, fees, revenue, volume, TVL momentum, fee efficiency, yield |

Event types on this stream: `progress` (with `variant`, `variant_index`, `total_variants` added), `variant_done` (shape above), `variant_error` (`{"variant", "variant_index", "total_variants", "error"}` — the sweep continues), and a final `sweep_done` (`{"total_variants", "simulations": [all variant_done payloads]}`).

## GET /dn/sim/holdings

Returns what a simulated index held at a given rebalance date — the composition behind a backtest's curve.

```gm-try
{"method": "GET", "path": "/dn/sim/holdings", "params": [{"name": "run_id", "in": "query", "type": "number", "required": true, "desc": "Run id from a result event"}, {"name": "date", "in": "query", "type": "string", "required": false, "desc": "YYYY-MM-DD rebalance date (default: the run's latest)"}], "body": null, "response": {"holdings": [{"rebalance_date": "2026-06-01", "coin_id": "bitcoin", "symbol": "BTC", "weight": 0.25, "quantity": 0.0000037, "price_usd": 67000.5}]}}
```

- `weight` is a fraction of the index (0–1), sorted descending. `quantity` is coins per $1 of index value at that rebalance.
- An unknown `run_id` or a date with no rebalance returns `{"holdings": []}`, status 200.

## GET /dn/sim/results

Returns all cached runs, newest first — useful for building comparison tables without re-running anything.

```gm-try
{"method": "GET", "path": "/dn/sim/results", "params": [{"name": "category_id", "in": "query", "type": "string", "required": false, "desc": "Filter to one category"}], "body": null, "response": {"results": [{"id": 1042, "category_id": "layer-1", "top_n": 10, "weighting": "equal", "rebalance_days": 30, "start_date": "2025-06-10", "end_date": "2026-06-10", "total_return_pct": 41.2, "annualized_return": 18.7, "max_drawdown_pct": -33.1, "sharpe_ratio": 0.9, "base_fee_pct": 0.1, "spread_multiplier": 1.0, "total_fees_pct": 1.2, "total_trades": 84, "total_rebalances": 12, "total_delistings": 1, "computed_at": "2026-06-10T11:00:00Z", "duration_ms": 8412}]}}
```

The run cache is invalidated as new market data arrives — a cached run whose `end_date` is behind the data frontier gets recomputed on the next request instead of served stale.

## GET /dn/sim/benchmarks

Returns BTC and ETH price series normalized to 1.0 at your start date, for plotting against a backtest.

```gm-try
{"method": "GET", "path": "/dn/sim/benchmarks", "params": [{"name": "start_date", "in": "query", "type": "string", "required": true, "desc": "YYYY-MM-DD"}, {"name": "end_date", "in": "query", "type": "string", "required": false, "desc": "YYYY-MM-DD (default: latest data)"}], "body": null, "response": {"benchmarks": [{"symbol": "BTC", "coin_id": "bitcoin", "nav_series": [{"nav_date": "2026-06-10", "nav": 1.31}]}]}}
```

- `nav` is the price divided by the price at `start_date` — directly comparable to a simulation's `nav_series`.
- Errors: `400` malformed `start_date`. A benchmark with no data in range is omitted from the response.

```gmnote
The backtester prices in daily snapshots and percentage fees. It does not simulate the live order pipeline — oracle batching, slippage tiers, partial fills. Treat results as strategy research, not an execution forecast. For the live pipeline, read How orders fill, linked below.
```

```gmseealso
[{"title": "Prices and DTFs", "href": "/docs/developers/index-api/markets"}, {"title": "How orders fill", "href": "/docs/index/order-lifecycle"}, {"title": "Lending", "href": "/docs/developers/index-api/lending"}]
```

Next: [Lending](/docs/developers/index-api/lending) (~4 min)
