---
title: Vaults
navTitle: Vaults
description: The ERC-7540 vault contract — async deposits, FIFO redeem queue, clone factory — and the five vault read endpoints.
order: 9
group: Vision API
mode: reference
---

```gmplain
A vault is a fund that plays Vision rounds with depositors' money. You put USDC in and receive shares; a manager places the predictions; profit and loss move the share price. Getting money out goes through a queue: you ask to leave, and the vault pays you as soon as it has idle cash — automatically, in the order people asked. This page covers the vault contract's mechanics and the five endpoints that report on any vault.
```

```gmsummary
The vault contract :: Clone-deployed ERC-7540 fund — async deposits, FIFO redeems, manager-only trading
GET /vision/vault/{address}/stats :: Chain-derived trade stats over the last ~12 hours
GET /vision/vault/{address}/history :: NAV and TVL snapshots, bucketed per range
GET /vision/vault/{address}/rounds :: Round history with the four-state status taxonomy
GET /vision/vault/{address}/assets :: Per-asset aggregates of the vault's Index trades
GET /vision/vault/{address}/assets/{assetId}/fills :: Paginated individual fills for one asset
```

## The vault contract

Every vault is an EIP-1167 minimal-proxy clone of one `VisionVault` implementation, stamped out by `VisionVaultFactory.createVault(name, symbol, performanceFeeRate, manager)`.

The factory caps the performance fee at 5,000 bps (50%) and keeps the registry: `getAllVaults()`, `getVaultsByManager(manager)`, `isRegisteredVault(vault)`. On initialization the clone grants Vision an unlimited USDC allowance so the manager can join batches. Factory, implementation, and per-source vault addresses live on the [Network reference](/docs/get-started/network) (~2 min).

**Shares and NAV.** Vault shares are a vault-local ERC-20 with 18 decimals. `totalAssets = the vault's whole USDC balance + totalActiveCapital`, where active capital is the sum of deposits currently inside unsettled Vision batches. Idle USDC is narrower: the balance minus what redeemers can already claim. NAV per share follows from `totalAssets / totalSupply`; the high-water mark starts at 1e18.

**Deposits are asynchronous (ERC-7540).** `requestDeposit(assets, controller, owner)` pulls USDC into the vault and records a pending request. `claimDeposit(receiver, controller)` mints shares at the NAV at claim time — the pending amount is excluded from `totalAssets` when pricing, so a deposit cannot dilute itself. The synchronous ERC-4626 entry points (`deposit`, `mint`, `withdraw`, `redeem`) revert with `SyncDisabled`; the `preview*` views and `maxWithdraw`/`maxRedeem` return 0.

**Redeems are asynchronous with a FIFO queue.** `requestRedeem(shares, controller, owner)` locks the shares in the vault. If idle USDC already covers their value, the shares burn immediately and the USDC becomes claimable. Otherwise the request joins a first-in-first-out queue. The queue is swept after every settlement reconciliation and every refund — strictly in order, stopping at the first request idle USDC cannot cover. `claimRedeem(receiver, controller)` transfers whatever has become claimable. There is no off-chain proof step anywhere in the withdrawal path: fulfillment is on-contract, driven by idle USDC.

**Only the manager trades.** `joinBatch` and `updateBitmap` are manager-only. A single batch can take at most 5% of `totalAssets` (`MAX_BATCH_BPS = 500`) and never more than the idle USDC.

**Settlement accounting is permissionless.** After Vision settles a batch, anyone can call `reconcile(batchId, settlementPayout)`: it releases the batch from active capital, and when NAV per share exceeds the high-water mark, mints performance-fee shares to the manager (the mark resets after the fee). If a batch never settles, anyone can call `refundStuckBatch(batchId)` once the grace window has passed — it pulls the full deposit back through Vision's refund path with zero PnL. Both calls sweep the redeem queue.

**Testnet only.** Vault deposits are testnet funds.
**L3 USDC has 18 decimals.**

The player-facing story — what depositing feels like, where performance shows in the app — lives at [Can someone play for me?](/docs/vision/vaults) (~4 min).

## GET /vision/vault/{address}/stats

Returns trade statistics computed from the vault's on-chain `PlayerJoined` and `PlayerSettled` events over the last 43,200 L3 blocks (~12 hours at the chain's ~1-second blocks).

```gm-try
{"method": "GET", "path": "/vision/vault/{address}/stats", "params": [{"name": "address", "in": "path", "type": "string", "required": true, "desc": "Vault address"}], "body": null, "response": {"vault": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", "lookbackBlocks": 43200, "trades": 96, "settledTrades": 94, "wins": 51, "losses": 43, "winRate": 0.5425, "avgWin": 0.42, "avgLoss": -0.38, "totalPnl": 5.08, "headBlock": 4812345, "sharpe": 1.21, "sortino": 1.87, "volatility": 0.34, "maxDrawdown": -0.06, "annualizedReturn": 0.41, "tradesPerYear": 68940.0, "observationSecs": 43000, "minTradesForRisk": 20}}
```

Each settled batch is one trade with return `r = (payout − deposit) / deposit`. Sharpe, Sortino, volatility, max drawdown, and annualized return are computed on those per-trade returns — and are all `null` until the vault has at least 20 settled trades in the window (`minTradesForRisk`). `winRate`, `avgWin`, and `avgLoss` are `null` when there is nothing to divide by. Amounts (`avgWin`, `avgLoss`, `totalPnl`) are USDC floats.

Errors: `400 {"error": "Invalid address"}`, `500 {"error": "Failed", "message": "…"}` on RPC failure. Cached 60 seconds.

## GET /vision/vault/{address}/history

Returns the vault's NAV-per-share and TVL snapshots, bucketed to fit a chart.

```gm-try
{"method": "GET", "path": "/vision/vault/{address}/history", "params": [{"name": "address", "in": "path", "type": "string", "required": true, "desc": "Vault address"}, {"name": "range", "in": "query", "type": "string", "required": false, "desc": "1d | 1w | 1m | all — default all"}], "body": null, "response": {"snapshots": [{"nav": 1.0312, "tvl": 4821.55, "ts": 1781175600000}, {"nav": 1.0344, "tvl": 4836.92, "ts": 1781179200000}]}}
```

A snapshot is written roughly every 4.5 minutes. The range picks the window and the bucket — `1d` buckets at 5 minutes, `1w` at 35 minutes, `1m` at 3 hours, `all` at 6 hours — each bucket keeping its latest snapshot, capped at the newest 500 buckets, returned in chronological order. `ts` is unix milliseconds. An unknown `range` value falls back to `all`.

A vault with no snapshots returns `{"snapshots": []}`; so does a database failure. Oracle unreachable returns `502` with the same empty shape.

## GET /vision/vault/{address}/rounds

Returns the vault's Vision round history, derived from chain events over the same 43,200-block lookback, with a four-state status per round.

```gm-try
{"method": "GET", "path": "/vision/vault/{address}/rounds", "params": [{"name": "address", "in": "path", "type": "string", "required": true, "desc": "Vault address"}], "body": null, "response": {"vault": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", "lookbackBlocks": 43200, "headBlock": 4812345, "nowSec": 1781183000, "total": 3, "totals": {"joined": 3, "settled": 1, "refunded": 1, "refundable": 0, "pending": 1}, "rounds": [{"batchId": "301204", "joinBlock": 4812001, "joinTime": 1781182650, "resolveBlock": null, "resolveTime": null, "status": "pending", "deposit": 1.0, "payout": null, "pnl": null, "expirationTime": 1781183100}]}}
```

| Status | Meaning |
|---|---|
| `pending` | Joined, not yet settled, expiration not reached |
| `settled` | Settlement landed — `payout` and `pnl` are real |
| `refundable` | Unsettled and past `batchExpirationTime` — the deposit can be reclaimed |
| `refunded` | Refund landed — `payout` equals the deposit, `pnl` is 0 |

Rounds are sorted newest-first (by resolve block when present, else join block) and capped at 200; `total` and `totals` count everything in the window before the cap. Amounts are USDC floats. `expirationTime` is set only on unresolved rounds, and `null` when the contract read failed.

Errors: `400 {"error": "Invalid address"}`, `500 {"error": "Failed", "message": "…"}`.

## GET /vision/vault/{address}/assets

Returns per-asset aggregates of the vault's *Index* (ITP) trades — vaults trade DTFs as ordinary wallets, and this endpoint groups those fills by asset.

```gm-try
{"method": "GET", "path": "/vision/vault/{address}/assets", "params": [{"name": "address", "in": "path", "type": "string", "required": true, "desc": "Vault address"}], "body": null, "response": {"assets": [{"assetId": "itp-defi-10", "fillsCount": 12, "totalVolume": 1450.0, "avgEntry": 1.042, "realizedPnl": 18.3, "unrealizedPnl": null, "lastFillAt": "2026-06-10T13:58:02Z", "trend": "up"}], "total": 1}}
```

`avgEntry` is the volume-weighted average buy price; `realizedPnl` is computed against average cost on each sell; `trend` is the sign of realized PnL (`up` / `down` / `flat`). Results sort by `|realizedPnl|` descending.

**`unrealizedPnl` is always `null` — it is stubbed pending a per-asset NAV feed.**

When the upstream portfolio service fails, the endpoint still returns `200` with `{"assets": [], "_stub": true, "reason": "…"}` — check `_stub` before treating an empty list as "no trades".

## GET /vision/vault/{address}/assets/{assetId}/fills

Returns the individual fills behind one asset's aggregate, paginated.

```gm-try
{"method": "GET", "path": "/vision/vault/{address}/assets/{assetId}/fills", "params": [{"name": "address", "in": "path", "type": "string", "required": true, "desc": "Vault address"}, {"name": "assetId", "in": "path", "type": "string", "required": true, "desc": "Asset id from the assets endpoint"}, {"name": "page", "in": "query", "type": "number", "required": false, "desc": "0-based page, default 0"}, {"name": "limit", "in": "query", "type": "number", "required": false, "desc": "Page size — default 100, max 500"}], "body": null, "response": {"fills": [{"orderId": 88412, "side": "BUY", "amount": 120.0, "fillPrice": 1.038, "shares": 115.6, "timestamp": "2026-06-10T13:58:02Z"}], "total": 12, "page": 0, "limit": 100}}
```

Fills are filtered to `status = filled` and sorted oldest-first for chart overlay. `amount` is the USD value of the fill, `fillPrice` the NAV per share at fill time, `shares` the shares traded — the last two are `null` when the upstream row lacked them. The same `_stub: true` fallback applies on upstream failure.

```gmseealso
[{"title": "Can someone play for me?", "href": "/docs/vision/vaults"}, {"title": "Network reference", "href": "/docs/get-started/network"}, {"title": "Contract reference", "href": "/docs/developers/contracts"}]
```

Next: [Faucet](/docs/developers/vision-api/faucet) (~2 min)
