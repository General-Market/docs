---
title: Join a block
navTitle: Join a block
description: Discover open blocks, fetch the market list by configHash, approve USDC, and call the 4-param joinBatchDirect.
order: 3
group: Build a bot
mode: how-to
---

```gmplain
Joining a block takes five moves: find the open blocks, read each block's config fingerprint, swap that fingerprint for the list of markets, put your deposit and your prediction's hash on-chain, then send the prediction itself to the oracle. This page walks each move with the exact endpoint or contract call — and explains why you repeat all five every round.
```

```gmsummary
Where do I find open blocks? :: GET /vision/batches; scan recent ids on-chain as fallback
What is the configHash? :: The block's market-list fingerprint — echo it back exactly
How do I get the market list? :: GET /vision/config/by-hash/{hash}; array order is bit order
How do I join on-chain? :: Approve USDC, then the 4-param joinBatchDirect
How does the bitmap reach the oracle? :: POST /vision/bitmap — the hash alone settles nothing
What if I already joined? :: Check getPosition first; one position per address per block
Why do I have to re-join every round? :: Every tick mints new block ids; nothing carries over
```

## Where do I find open blocks?

Call the public API:

```
GET https://generalmarket.io/api/vision/batches
```

It returns `{ "batches": [...] }`, one entry per source — the latest non-paused block for each, already deduplicated. Each entry carries `id`, `creator`, `source_id`, `config_hash`, `tick_duration`, `player_count`, `tvl`, `paused`, `current_tick`, and `market_count`.

If the API is unreachable, scan the chain: read `nextBatchId()` on the Vision contract and walk backwards through the most recent ids with `getBatch(id)`, keeping batches that are neither `paused` nor `settled`. Only recent ids can still be open — a block lives one round, so anything older than a few ticks is history. The endpoint's full shape lives in [Blocks and state](/docs/developers/vision-api/batches) (~4 min).

## What is the configHash?

The `configHash` is the keccak256 fingerprint of the block's market configuration — the only on-chain record of which markets the block contains. `getBatch(batchId)` returns it inside the Batch struct:

```
(creator, sourceId, configHash, tickDuration, lockOffset,
 settlementGrace, createdAtTick, paused, settled)
```

You must pass `configHash` back to `joinBatchDirect` byte-for-byte. The contract compares it against its stored value and reverts with `BatchNotFound` on any mismatch — it is how the chain knows you and the oracle agree on what you are predicting.

## How do I get the market list?

Resolve the hash through the public API:

```
GET https://generalmarket.io/api/vision/config/by-hash/{configHash}
```

The response carries the source, the timing fields, and the market list:

```json
{
  "sourceId": "defi",
  "configHash": "0x…",
  "tickDurationSecs": 120,
  "lockOffsetSecs": 0,
  "settlementGraceSecs": 240,
  "markets": [
    { "assetId": "uniswap-v3", "resolutionType": "up_x", "thresholdBps": 150, "thresholdSource": "24h_history" }
  ]
}
```

**The order of `markets` is the bit order.** Bit *i* of your bitmap is your pick for `markets[i]` — the oracle resolves it exactly that way. The encoding itself is specified in [Bitmap encoding](/docs/bots/bitmap-encoding) (~4 min).

A 404 means the indexer has not seen the config yet — retry after a few seconds. A given hash always resolves to the same config, so cache responses freely.

## How do I join on-chain?

1. Read the USDC token address from the Vision contract (`USDC()`), then `approve(visionAddress, depositAmount)` on that token.
2. Encode your picks as a bitmap and compute `bitmapHash = keccak256(bitmap)`.
3. Call the live, 4-parameter join:

```python
vision.functions.joinBatchDirect(
    batch_id,        # uint256
    config_hash,     # bytes32 — exactly as read from getBatch
    deposit_amount,  # uint256 — wallet→contract USDC transfer
    bitmap_hash,     # bytes32 — keccak256 of your bitmap
).build_transaction(...)
```

There is no stake parameter. The deposit is the stake; at settlement it is split evenly across the block's markets.

- Minimum deposit: 0.1 USDC = 1e17. Below it the call reverts with `DepositBelowMinimum`.
- **L3 USDC has 18 decimals.** 10 USDC = 1e19.
- Joins (and bitmap updates) revert with `TickLocked` inside the lock window — the final `lockOffset` seconds of the tick. **Live blocks currently set `lockOffset` to 0**, so there is no lock window in practice; the check stays in the contract and configs can change, so read the value rather than assume it.
- A `paused` block rejects joins with `BatchPaused`. Skip it.

What happens on success: USDC moves from your wallet to the contract, and a `PlayerJoined` event records your deposit and bitmap hash. On failure, match the revert against the table in [Errors and fixes](/docs/bots/errors) (~3 min).

## How does the bitmap reach the oracle?

The chain only holds your hash — a sealed commitment. The bitmap itself goes to the oracle:

```
POST https://generalmarket.io/api/vision/bitmap
{ "player": "0x…", "batch_id": 301270, "bitmap_hex": "0xb2c0", "expected_hash": "0x…" }
```

The endpoint fans your submission out to every oracle node and answers `{ acceptedCount, totalCount, results }`. **A 200 response with `acceptedCount: 0` is still a rejection** — check the count, not just the status. Each oracle node verifies `expected_hash` against your on-chain commitment (mismatch → 400) and rejects bitmaps too short for the block's market count (400); a node that has not yet indexed your join answers 404 — retry after a few seconds. Through the fan-out, these per-node statuses arrive inside `results[].error`.

If you never deliver a bitmap, you are voided at settlement and your full deposit is refunded. Changing your picks before the lock is [Update predictions before the lock](/docs/bots/update-predictions) (~4 min).

## What if I already joined?

One position per address per block. A second `joinBatchDirect` on the same id reverts with `AlreadyJoined` — and since the revert surfaces as a failed transaction, not a friendly string, check *before* sending:

```python
pos = vision.functions.getPosition(batch_id, my_address).call()
if pos[3] != 0:   # totalDeposited — the joined sentinel
    skip()        # already in; use updateBitmap to change picks
```

`totalDeposited != 0` is the contract's own joined test. To change your prediction after joining, call `updateBitmap` — never a second join.

## Why do I have to re-join every round?

Because a block lives exactly one round. One tick after creation, the oracle settles it — payouts go straight to wallets — and mints a brand-new block for the source with a new id. Nothing carries over: not your deposit, not your bitmap, not your position. Your loop must re-discover the new id and run all five moves again with a fresh deposit and a fresh bitmap. `AlreadyJoined` only ever fires for the *same* id; the next round's block has never seen you. The round model is explained in [Blocks, ticks, and rounds](/docs/vision/blocks-and-ticks) (~4 min).

```gmseealso
[{"title": "Bitmap encoding", "href": "/docs/bots/bitmap-encoding"}, {"title": "Errors and fixes", "href": "/docs/bots/errors"}, {"title": "Contract reference", "href": "/docs/developers/contracts"}]
```

Next: [Bitmap encoding](/docs/bots/bitmap-encoding) (~4 min)
