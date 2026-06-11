---
title: Sources, snapshots, and search
navTitle: Discovery
description: The source catalog, live market values, ingestion health, search, featured charts, and asset icons.
order: 7
group: Vision API
mode: reference
---

```gmplain
Before you can predict anything you need to know what exists: which data sources are live, what markets they carry, what each market's value is right now, and how to find one by name. These six endpoints are that catalog. They are read-only and need no login.
```

```gmsummary
GET /vision/sources :: Catalog of playable sources plus the category list
GET /vision/snapshot :: Current market values — whole grid or one source
GET /vision/snapshot/meta :: Per-source ingestion health and asset counts
GET /vision/search :: Market search by symbol, name, asset id, or source
GET /vision/featured-charts :: Cached homepage chart data for four sources
GET /vision/icon/{source}/{id} :: 302 redirect to an asset's image
```

All paths are relative to `https://generalmarket.io/api`. No authentication — see [API overview](/docs/developers/overview) (~3 min).

## GET /vision/sources

Returns the catalog of playable sources and the category list.

```gm-try
{"method": "GET", "path": "/vision/sources", "params": [], "body": null, "response": {"sources": [{"sourceId": "coingecko", "internalIds": ["crypto"], "name": "CoinGecko Crypto", "description": "Cryptocurrency market data — prices, volumes, market caps.", "category": "finance", "logo": "/source-imgs/new-coingecko.webp", "brandBg": "#f5f5f5", "prefixes": ["crypto_"], "valueLabel": "Price", "valueUnit": "USD", "isPrice": true, "syncIntervalSecs": 600, "batchEligible": true}], "categories": [{"key": "finance", "label": "Finance", "order": 0}]}}
```

Source entry fields:

| Field | Meaning |
|---|---|
| `sourceId` | display id — the id every other Vision endpoint accepts |
| `internalIds` | data-node ids feeding this display source |
| `name`, `description`, `category` | human labels; `category` keys into `categories` |
| `logo`, `brandBg` | image path and brand colour (hex or CSS gradient) |
| `prefixes` | asset-id prefixes belonging to this source |
| `valueLabel`, `valueUnit`, `isPrice` | how to label the value (e.g. "Price" in "USD") |
| `syncIntervalSecs` | how often the data-node refreshes this source |
| `batchEligible` | always `true` here — only batch-eligible sources are listed |
| `audience`, `batchSubsourceKey`, `displayFollowsBatch` | optional editorial routing fields |

- Hidden, bot-audience, and redirect entries are filtered out — this is the human-facing catalog.
- `categories` entries are `{key, label, order}`.
- When the data-node is unreachable the route still answers from a static catalog, with status `502` and `categories: []`.

## GET /vision/snapshot

Returns current values for markets — the whole grid or a single source.

```gm-try
{"method": "GET", "path": "/vision/snapshot", "params": [{"name": "source", "in": "query", "type": "string", "required": false, "desc": "Display source id — returns up to 10,000 rows for that source"}], "body": null, "response": {"generatedAt": "2026-06-10T12:31:00.000Z", "maxAgeSecs": null, "totalAssets": 41230, "sources": [], "prices": [{"source": "coingecko", "assetId": "crypto_bitcoin", "symbol": "BTC", "name": "Bitcoin", "category": "finance", "value": "67123.41", "prevClose": null, "changePct": "1.42", "volume24h": "28412345678", "marketCap": "1324567890123", "fetchedAt": "2026-06-10T12:30:40Z", "imageUrl": null}]}}
```

- Without `source`: a grid preview built from the first 5,000 rows, capped at 200 markets per source so one large source cannot crowd out the rest. `totalAssets` still counts everything.
- With `source`: up to 10,000 rows for that source. Curated sources return exactly their allowlisted markets.
- Numeric fields (`value`, `changePct`, `volume24h`, `marketCap`) arrive as decimal strings to preserve precision; `changePct`, `volume24h`, `marketCap` may be `null`.
- **`prevClose` is always `null` and `sources` is always `[]`** — reserved fields, never populated.
- Cached ~30 seconds. Upstream failure → `502` with `{"error": "Upstream service unavailable"}`.

## GET /vision/snapshot/meta

Returns per-source ingestion health and asset counts.

```gm-try
{"method": "GET", "path": "/vision/snapshot/meta", "params": [], "body": null, "response": {"generatedAt": "2026-06-10T12:31:00.000Z", "totalAssets": 41230, "totalSources": 84, "totalCategories": 10, "sources": [{"sourceId": "twitch", "displayName": "twitch", "enabled": true, "syncIntervalSecs": 300, "lastSync": "2026-06-10T12:30:12Z", "nextSync": null, "estimatedNextUpdate": null, "status": "healthy"}], "assetCounts": {"twitch": 412}}}
```

- `status` per source: `healthy`, `stale` (newest record older than 7 days, or missing), or `not_started` (no active assets).
- `assetCounts` maps `sourceId` → total assets.
- **Several fields are fixed values:** `displayName` mirrors `sourceId`, `enabled` is always `true`, `syncIntervalSecs` is always `300`, `nextSync` and `estimatedNextUpdate` are always `null`, and `totalCategories` is always `10`.

## GET /vision/search

Searches markets by symbol, name, asset id, or source.

```gm-try
{"method": "GET", "path": "/vision/search", "params": [{"name": "q", "in": "query", "type": "string", "required": true, "desc": "Search text — 400 without it"}, {"name": "limit", "in": "query", "type": "number", "required": false, "desc": "Max results (default 12, max 50)"}], "body": null, "response": {"results": [{"assetId": "crypto_bitcoin", "symbol": "BTC", "name": "Bitcoin", "source": "coingecko", "category": "finance", "value": "67123.41", "changePct": "1.42", "volume24h": "28412345678", "marketCap": "1324567890123", "imageUrl": null}], "total": 38}}
```

- Send `Accept: application/json` to get `{results, total}` as shown. Without that header the endpoint streams the legacy SSE format (`text/event-stream`): one `data: {"type":"result","market":{…}}` line per hit, then `data: {"type":"done","total":N}`.
- The index lives in server memory and rebuilds every ~5 minutes; an exact symbol match scores highest.
- Only markets from visible sources that have a vault appear — a result never points at a page that 404s.

## GET /vision/featured-charts

Returns the server-cached chart data behind the homepage cards.

```gm-try
{"method": "GET", "path": "/vision/featured-charts", "params": [], "body": null, "response": {"sources": {"twitch": {"topMarkets": [{"assetId": "twitch_just-chatting", "symbol": "Just Chatting", "name": "Just Chatting", "value": "412034", "changePct": "2.1"}], "historyData": {"twitch_just-chatting": [{"value": 401200, "ts": 1781784000000}, {"value": 412034, "ts": 1781787600000}]}, "generatedAt": 1781787600000}}}}
```

- Entries are at most one hour old; older ones are evicted on read.
- Only four sources can appear: `twitch`, `db_trains`, `steam`, `earthquake`.
- A `POST` exists on the same path, but it is the app's own cache warm-up call — not a public write surface.

## GET /vision/icon/{source}/{id}

Redirects (`302`) to the asset's image at its upstream provider — it returns no JSON body.

```gm-try
{"method": "GET", "path": "/vision/icon/{source}/{id}", "params": [{"name": "source", "in": "path", "type": "string", "required": true, "desc": "Icon provider key — see the table"}, {"name": "id", "in": "path", "type": "string", "required": true, "desc": "Provider-specific asset id; may contain slashes"}], "body": null, "response": null}
```

| `source` | Provider | `id` |
|---|---|---|
| `crypto` | CoinGecko | coin id (`bitcoin`) |
| `reddit` | Reddit | subreddit name |
| `bgg` | BoardGameGeek | thing id |
| `twitch` | Twitch box art | game name |
| `twitch-user` | Twitch | login name |
| `lastfm` | Last.fm | artist name |
| `tmdb` | TMDB | path like `movie/603` |
| `espn` | ESPN | `{league}/{gameId}/{side}` — leagues: nba, nfl, mlb, nhl, wnba, mls, epl, laliga, bundesliga, seriea, ligue1, ucl |
| `polymarket` | Polymarket | market slug |
| `backpacktf` | backpack.tf | item id |
| `bestbuy` | Best Buy | SKU |
| `queue_times` | queue-times.com | park id |

- Any other `source`, or an asset with no image → `404`. Provider error → `502`.
- Redirects are cacheable for one day.

```gmseealso
[{"title": "The market catalog", "href": "/docs/vision/markets"}, {"title": "Blocks and state", "href": "/docs/developers/vision-api/batches"}]
```

Next: [Leaderboard and stats](/docs/developers/vision-api/stats) (~4 min)
