---
title: API overview
navTitle: Overview
description: Base URL, authentication, rate limits, and the endpoint families of the General Market API.
order: 1
group: Foundations
mode: reference
---

```gmplain
Everything the app can do, your code can do too. All requests go to one web address, you do not need an account or an API key, and the pages in this section list every request you can make — each one with a live panel so you can try it from your browser before writing a line of code.
```

```gmsummary
Base URL :: Every endpoint lives under https://generalmarket.io/api
Authentication and rate limits :: None on the API itself; the faucet is the exception
Endpoint families :: Eight Vision groups, three Index groups, plus the contracts
How to read these pages :: Method pill, parameters, response shape, live try-it panel
Try your first request :: One GET with no parameters proves the connection works
```

## Base URL

```
https://generalmarket.io/api
```

Every path in this section is relative to that base. `GET /vision/batches` means `GET https://generalmarket.io/api/vision/batches`. All endpoints speak JSON — JSON request bodies in, JSON responses out.

The API is the same surface the General Market app itself runs on. There is no separate "public" tier with different data.

## Authentication and rate limits

No authentication. No API keys, no signatures, no session tokens — every endpoint documented in this section is open.

No rate limits are enforced by the API itself on the `/vision/*` and Index endpoints. The exceptions, stated plainly:

| Surface | Limit |
|---|---|
| `POST /api/faucet` | 30-second cooldown per address, and a waitlist gate that is on by default (returns 403 for non-whitelisted addresses) |
| `POST /api/bot/faucet` | One claim per IP per 24 hours |
| `/bot-api/` (cached bot data surface) | 60 requests per minute per IP at the proxy |

Full faucet behaviour, including request and response shapes: [Faucet](/docs/developers/vision-api/faucet) (~3 min).

```gmnote
Open does not mean unlimited. Limits can exist at the proxy layer in front of the API, and the surface can change — this is a testnet system under active development. Build retries into anything that polls.
```

## Endpoint families

| Family | What it covers | Reference |
|---|---|---|
| Blocks & state | Active blocks, batch state, market configs | [Blocks and state](/docs/developers/vision-api/batches) (~5 min) |
| Bitmap submission | Sending sealed predictions to the oracle | [Submit a bitmap](/docs/developers/vision-api/bitmap) (~4 min) |
| Players & balances | Balances, player profiles, round history per player | [Players and balances](/docs/developers/vision-api/players) (~4 min) |
| Rounds & history | Past rounds, revealed bitmaps, results, settlements | [Rounds, results, and history](/docs/developers/vision-api/history) (~5 min) |
| Sources & snapshots | The source catalog, market snapshots, search, icons | [Sources, snapshots, and search](/docs/developers/vision-api/discovery) (~5 min) |
| Leaderboard & stats | Leaderboard, global stats, activity, explorer | [Leaderboard and stats](/docs/developers/vision-api/stats) (~4 min) |
| Vaults | Managed-vault stats, history, rounds, assets | [Vault contract and endpoints](/docs/developers/vision-api/vaults) (~5 min) |
| Faucet | Testnet USDC and gas | [Faucet](/docs/developers/vision-api/faucet) (~3 min) |
| Prices & DTFs | DTF prices, NAV, rankings | [Prices and DTFs](/docs/developers/index-api/markets) (~5 min) |
| Portfolio & simulation | Positions, trade history, backtesting | [Portfolio and simulation](/docs/developers/index-api/portfolio) (~5 min) |
| Lending | The Morpho lending market | [Lending](/docs/developers/index-api/lending) (~4 min) |
| Contracts | The on-chain surface behind all of it | [Contract reference](/docs/developers/contracts) (~10 min) |

Chain id, RPC URL, and every deployed contract address live in one place: [Network reference](/docs/get-started/network) (~2 min).

## How to read these pages

Each reference page documents one endpoint family. The conventions:

- **One `##` heading per endpoint**, named by its path. Pages that document a single endpoint show the HTTP method as a pill next to the page title.
- **Request and response shapes are lifted from the route code**, not from intent. If a field is documented, the API returns it.
- **A try-it panel sits under each endpoint.** It runs the real request against the live API from your browser — edit the parameters, press send, read the actual response. No setup.
- **Amounts are raw chain units.** **L3 USDC has 18 decimals.** 0.1 USDC = `100000000000000000` (1e17). Every page that shows an amount restates this.

## Try your first request

The cheapest call in the API: global Vision stats. No parameters, no body.

```gm-try
{"method": "GET", "path": "/vision/stats/global", "params": [], "body": null, "response": {"totalMarkets": 0, "totalSettled": 0}}
```

- `totalMarkets` — live predictable markets across all sources right now.
- `totalSettled` — lifetime count of settled markets. One settled block of N markets counts as N.

Zero is a real answer. `null` means the upstream fetch failed and you should retry.

If this call returns JSON, your connection works and every other endpoint in this section is reachable the same way.

```gmseealso
[{"title": "System architecture", "href": "/docs/developers/architecture"}, {"title": "Blocks and state", "href": "/docs/developers/vision-api/batches"}, {"title": "Contract reference", "href": "/docs/developers/contracts"}]
```

Next: [System architecture](/docs/developers/architecture) (~7 min)
