---
title: Prices & DTFs
navTitle: Prices & DTFs
description: DTF price, NAV history, orderbook depth, AUM rankings, DTF analytics, and asset price history endpoints.
order: 11
group: Index API
mode: reference
---

```gmplain
These endpoints tell you what a DTF — an on-chain fund tracking a basket of assets — is worth. You can ask for the live price of one fund, its price history as a candlestick chart, the buy/sell depth behind it, a ranking of every fund by size, and trading-activity charts. Each panel below runs the real request from your browser.
```

```gmsummary
GET /itp-price :: Live NAV for one DTF, with on-chain fallback
GET /itp-enrichment :: Holdings enriched with logos, market caps, founders, TVL
GET /dn/nav-series :: NAV history as OHLC candles, four intervals
GET /dn/itp-orderbook :: Synthetic depth book derived from underlying-asset orderbooks
GET /dn/itp-bid-ask :: One-line bid/ask/mid NAV with spread
GET /dn/aum-ranking :: Every DTF ranked by assets under management
GET /explorer/dtf :: Fills, order lifecycle, TVL, and orders-per-hour series
GET /market/history :: Price history for one asset of one source
GET /market/batch-history :: 7-day history for up to 16 assets in one call
GET /market/history-bulk :: Bulk asset history with custom time range
```

Conventions for every endpoint on this page: base URL `https://generalmarket.io/api`, JSON in and out, no authentication. `itp_id` is the 0x-prefixed 32-byte id assigned at creation — a DTF is called an **ITP (Index Token Product)** at the contract level. Endpoints under `/dn/` are streamed proxies into the data-node, the service that aggregates prices from 90+ sources.

**L3 USDC has 18 decimals.** NAV values arrive in two forms: `nav` is a wei-scale integer string (1e18 = $1.00), `nav_display` is a decimal string.

## GET /itp-price

Returns the live NAV of one DTF. The route asks the data-node first (live exchange prices, freshest NAV); if the data-node is down or returns no NAV, it falls back to reading the stored NAV from the Index contract on-chain.

```gm-try
{"method": "GET", "path": "/itp-price", "params": [{"name": "itp_id", "in": "query", "type": "string", "required": true, "desc": "0x-prefixed 32-byte ITP id"}], "body": null, "response": {"itp_id": "0x0000000000000000000000000000000000000000000000000000000000000001", "nav": "1052340000000000000", "nav_display": "1.052340", "assets_priced": 10, "assets_total": 10, "timestamp": "2026-06-10T12:00:00Z"}}
```

- `nav` — NAV per share as a 1e18-scale integer string. `nav_display` — the same value as a decimal string.
- `assets_priced` / `assets_total` — how many of the basket's assets had a live price when the NAV was computed. Equal numbers mean a fully priced NAV.
- The data-node computes NAV as `sum(inventory[i] × price[i]) / 1e18` over the latest basket snapshot, with a multi-layer price lookup: live exchange tickers first, freshest stored price as backup.

The two response shapes, stated plainly:

| Path taken | Extra fields | Missing fields |
|---|---|---|
| Data-node (normal) | `itp_id`, `timestamp` | `source` |
| On-chain fallback | `source: "onchain"` | `itp_id`, `timestamp` |

Errors: `400` if `itp_id` is missing; `502` with a zeroed body (`{"nav": "0", "nav_display": "0", ...}`) if both paths fail.

## GET /itp-enrichment

Returns the holdings of one DTF enriched with off-chain metadata — logos, CoinGecko market data, founder aggregates, DeFi TVL, and funding rounds.

```gm-try
{"method": "GET", "path": "/itp-enrichment", "params": [{"name": "itp_id", "in": "query", "type": "string", "required": true, "desc": "0x + exactly 64 hex chars (strictly validated)"}], "body": null, "response": {"itpId": "0x0000000000000000000000000000000000000000000000000000000000000001", "holdings": [{"symbol": "BTC", "address": "0xabc…", "name": "BTC", "weight": 0.25, "price": 67000.5, "image": "https://…", "coingecko_id": "bitcoin", "market_cap": 1300000000000, "change_24h": 1.2}], "founders": {"total_founders": 12, "total_companies_matched": 8, "age_distribution": [], "gender_split": [], "top_nationalities": [], "top_universities": []}, "defi": {"total_tvl": 0, "avg_tvl_change_7d": 0, "protocols_with_data": 0, "total_holdings": 10, "top_by_tvl": []}, "funding": {"total_raised_m": 0, "avg_valuation_m": 0, "total_rounds": 0, "top_investors": [], "recent_raises": []}}}
```

- `itp_id` must match `^0x[0-9a-fA-F]{64}$` exactly — anything else is rejected with `400` before any lookup happens.
- `founders`, `defi`, and `funding` are aggregate blocks; each is omitted when no holding matched the underlying dataset.
- Holdings resolve in priority order: live basket snapshot → on-chain ITP state mapped through the deployed-asset list → a static equal-weight fallback. When the fallback is used, `weight` is `1 / asset count` and `price` may be `0` until CoinGecko fills it.
- Responses with holdings are cached for 5 minutes (`s-maxage=300`).

Errors: `400` invalid id, `500` enrichment pipeline failure.

## GET /dn/nav-series

Returns the NAV history of one DTF as OHLC candles — the series behind the price chart.

```gm-try
{"method": "GET", "path": "/dn/nav-series", "params": [{"name": "itp_id", "in": "query", "type": "string", "required": true, "desc": "0x-prefixed 32-byte ITP id"}, {"name": "from", "in": "query", "type": "string", "required": true, "desc": "RFC 3339 timestamp, e.g. 2026-06-09T00:00:00Z"}, {"name": "to", "in": "query", "type": "string", "required": true, "desc": "RFC 3339 timestamp"}, {"name": "interval", "in": "query", "type": "string", "required": false, "desc": "5m | 15m | 1h | 1d (default 5m)"}], "body": null, "response": {"itp_id": "0x0000000000000000000000000000000000000000000000000000000000000001", "interval": "1h", "points": [{"time": 1765360800, "open": "1.012345", "high": "1.015872", "low": "1.011034", "close": "1.014210"}]}}
```

- Valid intervals: `5m`, `15m`, `1h`, `1d`. Anything else returns `400`. (The error text mentions `1m`; the validator rejects it — `5m` is the finest bucket.)
- `time` is a unix timestamp (seconds), bucket-aligned. `open/high/low/close` are NAV-per-share decimal strings with 6 decimal places.
- `from` is clamped to the DTF's creation time — you never get candles from before the fund existed.
- The series is computed from per-asset exchange klines when they cover ≥ 50% of the requested range, otherwise from stored price ticks. Gaps shorter than 5 minutes are forward-filled as flat candles; longer gaps stop the series rather than emit stale data.

Errors: `400` bad timestamps or interval, `404` unknown `itp_id`.

The app's own chart uses this endpoint with fixed lookbacks per interval (24h for `5m`, 3d for `15m`, 7d for `1h`, 90d for `1d`).

## GET /dn/itp-orderbook

Returns a synthetic depth book for one DTF — what buying or selling size would cost — derived live from the orderbooks of the underlying assets, weighted by the basket's inventory.

```gm-try
{"method": "GET", "path": "/dn/itp-orderbook", "params": [{"name": "itp_id", "in": "query", "type": "string", "required": true, "desc": "0x-prefixed 32-byte ITP id"}, {"name": "levels", "in": "query", "type": "number", "required": false, "desc": "Aggregated levels per side (default 15, max 50)"}, {"name": "aggregation_bps", "in": "query", "type": "number", "required": false, "desc": "Level bucket width in basis points (default 10, max 1000)"}], "body": null, "response": {"mid_price": 1.0523, "spread_bps": 4.2, "bids": [{"price": 1.0519, "quantity": 15200.0, "usd_value": 15989.0}], "asks": [{"price": 1.0527, "quantity": 14100.0, "usd_value": 14843.0}], "total_bid_depth_usd": 250000.0, "total_ask_depth_usd": 241000.0, "assets_included": 10, "assets_failed": [], "per_asset": [{"symbol": "BTCUSDT", "mid_price": 67000.1, "spread_bps": 0.4, "bid_depth_usd": 120000.0, "ask_depth_usd": 118000.0, "weight_bps": 2500}]}}
```

- This is not a native order book — DTF orders fill against oracle-executed venues, not a resting book. The endpoint answers "what does the underlying liquidity look like, expressed in DTF shares". Order execution itself is covered in [What happens to my order?](/docs/index/order-lifecycle) (~4 min).
- `assets_failed` lists symbols whose depth fetch failed; their weight is missing from the book.
- Results are cached for ~5 seconds per `(itp_id, levels, aggregation_bps)` combination. The app polls it at 500 ms against that cache.

Errors: `404` unknown `itp_id`, `400` if no basket asset maps to a tradable symbol.

## GET /dn/itp-bid-ask

Returns the one-line version of the book: NAV at the bid, NAV at the ask, the mid, and the spread.

```gm-try
{"method": "GET", "path": "/dn/itp-bid-ask", "params": [{"name": "itp_id", "in": "query", "type": "string", "required": true, "desc": "0x-prefixed 32-byte ITP id"}], "body": null, "response": {"itp_id": "0x0000000000000000000000000000000000000000000000000000000000000001", "nav_bid": "1.052100", "nav_ask": "1.052600", "nav_mid": "1.052350", "spread_bps": 4, "assets_priced": 10, "assets_total": 10, "age_ms": 420}}
```

- Computed from live best-bid/best-ask tickers of the underlying assets, inventory-weighted. `age_ms` is the age of the freshest ticker — treat large values as stale.
- Assets without a live ticker are skipped; compare `assets_priced` to `assets_total`.

Errors: `404` unknown `itp_id`.

## GET /dn/aum-ranking

Returns every DTF ranked by assets under management, with a per-asset breakdown inside each fund. No parameters.

```gm-try
{"method": "GET", "path": "/dn/aum-ranking", "params": [], "body": null, "response": {"snapshots": [{"timestamp": 1765365600, "label": "Top 10 L1s", "event_type": "live", "itp_id": "0x…", "total_aum": "12345.67", "computed_nav": "1.05", "perf_ratio": "1.05", "ranked": [{"address": "0x…", "symbol": "BTC", "aum": "6000.00", "weight_pct": "48.6", "qty_per_share": "0.001", "rank": 1}], "name": "Top 10 L1s", "symbol": "TOP10", "nav_per_share": 1.05, "aum_usd": 12345.67, "total_supply": "11757780952380952380952"}], "all_symbols": {"0xabc…": "BTC"}}}
```

- One `snapshots` entry per live DTF; `ranked` lists its assets by AUM contribution. `all_symbols` maps every asset address seen to its display symbol.
- The ranking is precomputed and served from cache; on a cold start it is computed on demand. An empty system returns `{"snapshots": [], "all_symbols": {}}` with status 200.
- Nameless funds are filtered out — the permissionless `createITP` entrypoint has been spammed in the past, and real DTFs always carry a name and symbol.

## GET /explorer/dtf

Returns time-bucketed DTF trading analytics: fill volumes, order lifecycle counts, TVL history, or orders per hour.

```gm-try
{"method": "GET", "path": "/explorer/dtf", "params": [{"name": "endpoint", "in": "query", "type": "string", "required": true, "desc": "fills | order-lifecycle | tvl | orders-per-hour"}, {"name": "range", "in": "query", "type": "string", "required": false, "desc": "1h | 6h | 24h | 7d | 30d (default 24h)"}], "body": null, "response": {"bucket_secs": 3600, "series": [{"bucket": "2026-06-10T11:00:00Z", "buy_count": 12, "sell_count": 4, "buy_amount": "120000000000000000000", "sell_amount": "41000000000000000000", "borrow_count": 1, "repay_count": 0, "supply_count": 2, "withdraw_count": 0, "borrow_amount": "5000000000000000000", "repay_amount": "0", "supply_amount": "12000000000000000000", "withdraw_amount": "0"}]}}
```

Each `endpoint` value returns a different `series` row shape:

| endpoint | Row fields |
|---|---|
| `fills` | `bucket`, buy/sell counts and amounts, plus lending supply/withdraw/borrow/repay counts and amounts |
| `order-lifecycle` | `bucket`, `placed`, `filled`, `cancelled` |
| `tvl` | `snapshot_ts`, `total_aum_usd`, `itp_count`, `supply_count` (no `bucket_secs` wrapper) |
| `orders-per-hour` | `bucket`, `count` — placements and fills combined, hourly |

- Amount fields are 1e18-scale integer strings. **L3 USDC has 18 decimals.**
- **This route requires a server-side token.** The frontend forwards requests with its configured `EXPLORER_TOKEN`; a deployment without one answers `503 {"error": "Explorer not configured"}` for every request. You cannot supply the token yourself from outside.

Errors: `400` invalid `endpoint` or `range`, `502` upstream failure or response over 5 MB, `503` token not configured.

## GET /market/history

Returns the price history of one asset from one data source — the raw series behind any asset chart, DTF constituent or Vision market alike.

```gm-try
{"method": "GET", "path": "/market/history", "params": [{"name": "source", "in": "query", "type": "string", "required": true, "desc": "Source id, e.g. crypto, defi, earthquake"}, {"name": "asset", "in": "query", "type": "string", "required": true, "desc": "Asset id within the source"}, {"name": "from", "in": "query", "type": "string", "required": false, "desc": "RFC 3339 timestamp (default: 7 days ago)"}, {"name": "to", "in": "query", "type": "string", "required": false, "desc": "RFC 3339 timestamp (default: now)"}], "body": null, "response": {"source": "crypto", "asset_id": "bitcoin", "from": "2026-06-03T12:00:00Z", "to": "2026-06-10T12:00:00Z", "count": 2016, "prices": [{"id": 1, "assetId": "bitcoin", "source": "crypto", "symbol": "BTC", "value": "67000.5", "prevClose": "66800.1", "changePct": "0.3", "volume24h": null, "marketCap": null, "fetchedAt": "2026-06-10T11:55:00Z", "createdAt": "2026-06-10T11:55:00Z"}]}}
```

- `prices` rows are camelCase price records; `prevClose`, `changePct`, `volume24h`, `marketCap` are nullable.
- Responses are cached for 60 seconds at the proxy.

Errors: upstream status is passed through; `502` if the data-node is unreachable.

## GET /market/batch-history

Returns 7-day history for up to 16 assets in one call. The time window is fixed by the route — for a custom range use `GET /market/history-bulk` below.

```gm-try
{"method": "GET", "path": "/market/batch-history", "params": [{"name": "assets", "in": "query", "type": "string", "required": true, "desc": "Comma-separated asset ids (capped at 16)"}], "body": null, "response": {"from": "2026-06-03T12:00:00Z", "to": "2026-06-10T12:00:00Z", "assets_requested": 2, "assets_found": 2, "total_records": 4032, "data": {"bitcoin": [{"id": 1, "assetId": "bitcoin", "source": "crypto", "symbol": "BTC", "value": "67000.5", "prevClose": null, "changePct": null, "volume24h": null, "marketCap": null, "fetchedAt": "2026-06-10T11:55:00Z", "createdAt": "2026-06-10T11:55:00Z"}]}}}
```

- `data` is keyed by asset id; rows share the price-record shape above.
- The proxy silently truncates the asset list to 16; cached 120 seconds.

## GET /market/history-bulk

Returns history for many assets with a caller-chosen time range — the unconstrained sibling of batch-history.

```gm-try
{"method": "GET", "path": "/market/history-bulk", "params": [{"name": "assets", "in": "query", "type": "string", "required": true, "desc": "Comma-separated asset ids (data-node caps at 100)"}, {"name": "from", "in": "query", "type": "string", "required": false, "desc": "RFC 3339 timestamp (default: 30 days ago)"}, {"name": "to", "in": "query", "type": "string", "required": false, "desc": "RFC 3339 timestamp (default: now)"}], "body": null, "response": {"from": "2026-05-11T12:00:00Z", "to": "2026-06-10T12:00:00Z", "assets_requested": 3, "assets_found": 3, "total_records": 12960, "data": {"bitcoin": []}}}
```

- Same response shape as batch-history. The data-node rejects more than 100 assets with `400`.
- A `source` query param is accepted for symmetry but ignored — assets are queried by id directly.

```gmseealso
[{"title": "How DTFs are priced", "href": "/docs/index/pricing-and-nav"}, {"title": "Portfolio & simulation", "href": "/docs/developers/index-api/portfolio"}, {"title": "Contract reference", "href": "/docs/developers/contracts"}]
```

Next: [Portfolio & simulation](/docs/developers/index-api/portfolio) (~5 min)
