# Drink Data Sources Design

Two new data sources themed around beverages: Yahoo Finance drink commodities/stocks and Untappd beer social data.

## Source 1: Yahoo Finance Drink Commodities (`yahoo_drinks`)

### Assets (static, 12 total)

| Asset ID | Ticker | Name | Category |
|----------|--------|------|----------|
| `yahoodrinks_kc_f` | KC=F | Coffee Arabica Futures | commodities |
| `yahoodrinks_sb_f` | SB=F | Sugar #11 Futures | commodities |
| `yahoodrinks_cc_f` | CC=F | Cocoa Futures | commodities |
| `yahoodrinks_oj_f` | OJ=F | Orange Juice Futures | commodities |
| `yahoodrinks_ko` | KO | Coca-Cola | stocks |
| `yahoodrinks_pep` | PEP | PepsiCo | stocks |
| `yahoodrinks_stz` | STZ | Constellation Brands | stocks |
| `yahoodrinks_sam` | SAM | Boston Beer Company | stocks |
| `yahoodrinks_bf_b` | BF-B | Brown-Forman (Spirits) | stocks |
| `yahoodrinks_deo` | DEO | Diageo | stocks |
| `yahoodrinks_tap` | TAP | Molson Coors | stocks |
| `yahoodrinks_sbux` | SBUX | Starbucks | stocks |

### Architecture

- **Pattern**: Sequential ticker fetch (Pattern D-lite, no cursor needed — only 12 tickers)
- **Discovery**: Static config JSON
- **Sync interval**: 600s (10 min)
- **No API key** — unofficial Yahoo Finance v8 endpoint
- **HTTP**: Direct `SourceHttpClient` calls to `https://query2.finance.yahoo.com/v8/finance/chart/{TICKER}?interval=1d&range=1d`
- **Rate budget**: 12 req/sync x 6 syncs/hr = 72 req/hr (under ~360/hr limit)
- **Value**: USD price (regularMarketPrice from chart response)
- **Extra fields**: prev_close, change_pct, volume_24h from Yahoo response
- **Lifecycle**: Never disappear (static list)

### Response parsing

Yahoo v8 chart returns:
```json
{
  "chart": {
    "result": [{
      "meta": {
        "regularMarketPrice": 195.42,
        "previousClose": 194.10,
        "regularMarketVolume": 1234567
      }
    }]
  }
}
```

Extract `regularMarketPrice` as value, `previousClose` as prev_close, compute change_pct.

## Source 2: Untappd (`untappd`)

### Rate limit budget

100 calls/hour. 10-min sync = 6 syncs/hr = ~16 calls per sync.

| Endpoint | Calls/sync | Data |
|----------|-----------|------|
| `/v4/beer/trending` | 1 | ~25 trending beers |
| `/v4/search/beer?q=&sort=checkin` | 2 pages | Top 50 beers by check-ins |
| `/v4/beer/info/{BID}` | 10 (top beers) | Full stats per beer |
| Retry headroom | 3 | |
| **Total** | **~16** | |

### Feeds per beer (4 types)

| Feed suffix | Value | Nature |
|-------------|-------|--------|
| `_checkins` | total check-in count | Monotonic, continuously growing |
| `_rating` | average rating (0.00-5.00) | Slowly shifting average |
| `_rating_count` | total number of ratings | Monotonic, continuously growing |
| `_monthly` | monthly check-in count | Resets monthly, dynamic |

### Architecture

- **Pattern**: F (full list re-fetch for discovery) + A (fan out from `/beer/info` responses)
- **Discovery**: Dynamic — trending + search endpoints refresh the beer list each sync
- **Sync interval**: 600s (10 min)
- **API-key-gated**: `UNTAPPD_CLIENT_ID` + `UNTAPPD_CLIENT_SECRET`
- **Auth**: Query params `?client_id=X&client_secret=Y`
- **Rate limit config**: 80 req/hr (20% headroom under 100)
- **Lifecycle**: Rank cutoff — beers that fall off trending/top stop updating
- **Asset IDs**: `untappd_{bid}_checkins`, `untappd_{bid}_rating`, etc.
- **Names**: `{beer_name} ({brewery}) [checkins]`

### fetch_assets() flow

1. GET `/v4/beer/trending?client_id=X&client_secret=Y` -> parse trending beers (1 call)
2. GET `/v4/search/beer?q=&sort=checkin&limit=50&offset=0` -> top 50 by check-ins (2 calls)
3. Deduplicate by BID
4. For each beer, emit 4 AssetUpdate entries (one per feed type)

### fetch_prices() flow

1. Collect unique BIDs from requested asset_ids
2. For each BID (up to 10-15): GET `/v4/beer/info/{BID}`
3. From each response, extract checkin_count, rating_score, rating_count, monthly_count
4. Fan out to matching asset_ids

## Frontend wiring

### yahoo_drinks
- Category: existing `commodities` + `stocks` (assets have mixed categories)
- PREFIX_MAP: `['yahoodrinks_', 'yahoo_drinks', 'Drink Markets']`
- CATEGORY_GROUPS: add `yahoo_drinks` to `commodities` group
- SOURCE_META: `{ valueLabel: 'Price', unit: 'USD' }`
- formatMarketName: strip `yahoodrinks_` prefix, map to human names

### untappd
- Category: `entertainment`
- PREFIX_MAP: `['untappd_', 'untappd', 'Untappd Beer']`
- CATEGORY_GROUPS: add `untappd` to `entertainment` group
- COUNT_SOURCES: add `untappd` (values are counts/ratings, not USD)
- SOURCE_META: `{ valueLabel: 'Activity', assetUnit: (name) => name includes 'rating' && !name includes 'count' ? '' : 'count' }`
- formatMarketName: strip `untappd_{bid}_` prefix, show beer name from metadata
