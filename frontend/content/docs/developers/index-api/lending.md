---
title: Lending
navTitle: Lending
description: The Morpho lending endpoints — quotes, liquidity preparation, market state, positions, and history.
order: 13
group: Index API
mode: reference
---

```gmplain
The lending market lets you deposit DTF shares as collateral and borrow testnet USDC against them. These endpoints get you a borrow quote with signed price data, ask the system to move liquidity into your market before you borrow, and read back market state, your position, and your event history. The actual lending happens on-chain in Morpho contracts — the API prepares and observes, it never moves your money.
```

```gmsummary
POST /lending/quote :: Borrow terms plus ready-to-send bundler calldata
POST /lending/prepare :: Move vault liquidity into a market before borrowing
GET /dn/morpho-markets :: State of every lending market, refreshed every 30 s
GET /dn/morpho-position :: One wallet's collateral, debt, health factor, and limits
GET /dn/morpho-history :: Recent supply/withdraw/borrow/repay events for a wallet
```

Base URL `https://generalmarket.io/api`. The two `POST /lending/*` endpoints are served by the **curator** — the service that operates the lending vault. The three `GET /dn/*` endpoints read market data from the data-node. Contract addresses (Morpho, the IRM, the NAV oracle, the vault) live in one place: [Network reference](/docs/get-started/network) (~2 min). The user-facing story is at [Earn yield or borrow against DTFs](/docs/index/lending) (~4 min).

The numbers that frame every response here:

- **L3 USDC has 18 decimals.** Loan amounts are 1e18-scale integer strings.
- Collateral is a DTF share token, also 18 decimals. Oracle prices use Morpho's 36-decimal scale.
- LLTV is 77% — borrow up to 77% of collateral value; above that, anyone may liquidate you.
- **Testnet only.**

## POST /lending/quote

Returns borrow terms for a collateral/borrow pair, plus pre-built bundler calldata that executes the whole position (oracle update, supply collateral, borrow) in one transaction.

```gm-try
{"method": "POST", "path": "/lending/quote", "params": [], "body": {"itpAddress": "0xa9ac1076…", "collateralAmount": "100000000000000000000", "borrowAmount": "50000000000000000000"}, "response": {"quoteId": "q_01HZX…", "expiresAt": 1765366200, "terms": {"borrowRate": "1585489600", "healthFactor": "1.54", "liquidationPrice": "0.649", "maxBorrow": "77000000000000000000"}, "market": {"marketId": "0x21cabe92…", "lltv": "770000000000000000", "oracleAddress": "0x9Ee254aA…", "currentOraclePrice": "1052340000000000000000000000000000000"}, "oracleUpdate": {"price": "1052340000000000000000000000000000000", "timestamp": 1765365900, "cycleNumber": 4211, "blsSignature": "0x…", "signersBitmask": "0x7ff", "alreadyFresh": true}, "bundler": {"to": "0x…", "data": "0x…", "description": "Supply 100 ITP collateral and borrow 50 USDC", "steps": ["Update oracle price", "Supply collateral", "Borrow"]}, "crisisLevel": "Normal"}}
```

Request body: `itpAddress` (the DTF share token used as collateral), `collateralAmount` and `borrowAmount` (18-decimal integer strings).

- `terms.borrowRate` is the per-second rate the curator computes and pushes on-chain before quoting; multiply by 31 536 000 for APR. `healthFactor`, `liquidationPrice`, `maxBorrow` describe the position you would hold after executing.
- `oracleUpdate` carries the BLS-signed NAV the bundler submits on-chain; `alreadyFresh: true` means the chain price is under 5 minutes old and the update step may no-op.
- `bundler.to` + `bundler.data` is a ready transaction — sign and send it as-is to open the position atomically.
- `expiresAt` is a unix timestamp; quotes expire and must be re-fetched.
- `crisisLevel` is the market's health-monitor state: `Normal`, `Elevated`, `Stress`, or `Emergency`.

Errors, each with `{"error", "code"}`: `404 MARKET_NOT_FOUND` (no market for that ITP), `400 INSUFFICIENT_COLLATERAL` / `INVALID_REQUEST`, `503 MARKET_FROZEN` (emergency crisis level), `503 ORACLE_UNAVAILABLE` (no BLS data collected yet), `429 RATE_LIMITED` with `retryAfter` seconds.

**Routing caveat, stated out loud:** the frontend app defines no Next.js route for this path — the curator's own HTTP server serves `/api/lending/quote` directly, and the public origin reaches it through proxy routing outside this repository. If a deployment lacks that proxy rule, this endpoint 404s while everything else works.

## POST /lending/prepare

Asks the curator to reallocate idle vault liquidity into a market so a pending borrow can fill. Returns when the reallocation transaction is confirmed — or immediately if the market already has enough.

```gm-try
{"method": "POST", "path": "/lending/prepare", "params": [], "body": {"marketId": "0x21cabe92…", "borrowAmount": "50000000000000000000"}, "response": {"alreadyFunded": false, "txHash": "0x…", "blockNumber": null}}
```

Request body: `marketId` (bytes32 hex, `0x` prefix optional), `borrowAmount` (18-decimal integer string, must be > 0).

- `alreadyFunded: true` means no reallocation was needed and `txHash` is `null`.
- `blockNumber` is reserved and currently always `null` — do not wait on it. Confirmation is implied by the response itself: the call returns only after the reallocation transaction confirms.
- This call blocks while the reallocate transaction confirms — up to ~90 seconds. The proxy waits 95 seconds before giving up. Call it right before sending your borrow transaction, not speculatively.
- The app's flow is: quote → prepare → send the bundler transaction.

Errors, each with `{"error", "code"}`: `400 BAD_REQUEST` (malformed JSON) / `INVALID_MARKET_ID` / `INVALID_BORROW_AMOUNT`, `503 ALLOCATOR_UNAVAILABLE` (allocator task not running), `429 RATE_LIMITED`, `500 PREPARE_FAILED` (the reallocation transaction itself failed), `504 PREPARE_TIMEOUT` (curator took longer than 95 s), `502 CURATOR_UNREACHABLE`.

```gmnote
Both curator endpoints share one rate-limit bucket: 10 requests per 60 seconds per caller. The curator can also require an x-api-key header; when keys are configured, the prepare proxy attaches the server-side key for you — anonymous public calls then count against one shared anonymous bucket.
```

## GET /dn/morpho-markets

Returns the state of every lending market, served from a cache the data-node refreshes from chain every 30 seconds. No parameters.

```gm-try
{"method": "GET", "path": "/dn/morpho-markets", "params": [], "body": null, "response": {"markets": [{"market_id": "0x21cabe92…", "collateral_token": "0xa9ac1076…", "loan_token": "0xaddB799B…", "irm": "0x821f79f9…", "total_supply_assets": "100000000000000000000000", "total_supply_shares": "100000000000000000000000", "total_borrow_assets": "42000000000000000000000", "total_borrow_shares": "41800000000000000000000", "borrow_rate_per_second": "1585489600", "lltv": "770000000000000000", "oracle": "0x9Ee254aA…", "last_update": 1765365870}]}}
```

- `total_*` fields are 18-decimal integer strings. Utilization = `total_borrow_assets / total_supply_assets`.
- `borrow_rate_per_second` × 31 536 000 ≈ APR as an 18-decimal fraction (1e16 = 1%). The rate is curator-set, not a utilization curve — bounds are ~0.5% to 200% APR, and a market whose rate goes unset or stale for more than 48 hours charges a punitive 100% APR by design.
- `lltv` is an 18-decimal fraction: `770000000000000000` = 77%.

## GET /dn/morpho-position

Returns one wallet's position in a market: collateral, debt, health factor, and how much it can still borrow or withdraw.

```gm-try
{"method": "GET", "path": "/dn/morpho-position", "params": [{"name": "user", "in": "query", "type": "string", "required": true, "desc": "Wallet address"}, {"name": "market_id", "in": "query", "type": "string", "required": false, "desc": "bytes32 market id (default: the primary deployment market)"}], "body": null, "response": {"collateral": "100000000000000000000", "borrow_shares": "49760000000000000000", "debt_amount": "50000000000000000000", "oracle_price": "1052340000000000000000000000000000000", "health_factor": "1.62", "max_borrow": "31030000000000000000", "max_withdraw": "38330000000000000000", "market": {"total_supply_assets": "100000000000000000000000", "total_supply_shares": "100000000000000000000000", "total_borrow_assets": "42000000000000000000000", "total_borrow_shares": "41800000000000000000000"}}}
```

- `collateral` is DTF shares (18 dec); `debt_amount` is borrow shares converted to USDC owed, rounded up. `oracle_price` is 36-decimal Morpho scale.
- `health_factor` = max borrowable value ÷ debt, as a 2-decimal string — below `1.00` the position is liquidatable by anyone, permissionlessly. A debt-free position returns the string `"Infinity"`.
- `max_borrow` is the remaining headroom under the 77% LLTV; `max_withdraw` is how much collateral can leave while keeping the debt fully covered.
- The position itself is read live from chain per request; market totals come from the 30-second cache when available.

Errors: `400`-class RPC error body for a malformed address or unknown `market_id`.

## GET /dn/morpho-history

Returns a wallet's recent lending events — deposits and withdrawals of collateral, borrows and repays of USDC.

```gm-try
{"method": "GET", "path": "/dn/morpho-history", "params": [{"name": "address", "in": "query", "type": "string", "required": true, "desc": "Wallet address"}], "body": null, "response": [{"event_type": "borrow", "amount": "50000000000000000000", "token": "USDC", "tx_hash": "0x…", "block_number": 1234560}]}
```

- The response is a bare array, not an object. `event_type` is `deposit` | `withdraw` (collateral, `token: "ITP"`) or `borrow` | `repay` (loan, `token: "USDC"`). Amounts are 18-decimal integer strings.
- **Only the last 10,000 L3 blocks are scanned.** Older events silently fall off this endpoint — it is a recent-activity feed, not an archive.

```gmseealso
[{"title": "Earn yield or borrow against DTFs", "href": "/docs/index/lending"}, {"title": "Network reference", "href": "/docs/get-started/network"}, {"title": "Contract reference", "href": "/docs/developers/contracts"}]
```

Next: [Contract reference](/docs/developers/contracts) (~10 min)
