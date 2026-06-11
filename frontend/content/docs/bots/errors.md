---
title: Errors and fixes
navTitle: Errors
description: Symptom, cause, and fix for contract reverts, bitmap submissions, and the faucet.
order: 7
group: Build a bot
mode: reference
---

```gmplain
When the bot hits a wall, the wall has a name. This page lists the errors a bot meets in practice — what threw each one, why, and the one action that clears it. Reverts come from the Vision contract; HTTP errors come from the oracle and the faucet.
```

```gmsummary
Contract reverts :: Six named reverts; one cause and one fix each
Bitmap submission errors :: 404 is oracle lag; 400 is a hash or length mismatch
Faucet errors :: 403 is the waitlist gate; 429 is the cooldown
```

## Contract reverts

A failed transaction returns one of these custom errors in its revert data. The full selector table lives in [Contract reference](/docs/developers/contracts) (~6 min).

| Error | Thrown when | Fix |
|---|---|---|
| `AlreadyJoined` | `joinBatchDirect` on a block you already joined — one position per address per block | Skip the block. To change picks, use `updateBitmap` instead: [Update predictions](/docs/bots/update-predictions) (~4 min) |
| `DepositBelowMinimum` | deposit below 0.1 USDC = 1e17 | Deposit at least `100000000000000000` (1e17) |
| `BatchPaused` | joining a block the oracle has paused | Skip it; try another block. Existing positions are unaffected |
| `TickLocked` | `joinBatchDirect` or `updateBitmap` inside the lock window — the last `lockOffset` seconds of the round | Too late for this round. Wait for the source's next block and join that |
| `NotJoined` | `updateBitmap` without a position in that block | Join first with `joinBatchDirect`, then update |
| `BatchNotFound` | the batch id does not exist, **or** your `configHash` does not match the block's | Re-read `getBatch(batchId)` and use its `configHash` — every round is a new block with a new config |

**L3 USDC has 18 decimals.** 0.1 USDC = 1e17.

```gmnote
Older docs and the repo's AGENTS.md name two errors that do not exist in the deployed contract: `InsufficientDeposit` and `StakeBelowMinimum`. The real minimum-deposit error is `DepositBelowMinimum`, and there is no stake parameter at all — the deposit is the stake.
```

## Bitmap submission errors

`POST /vision/bitmap`, as answered by an oracle node:

| Status | Response says | Cause | Fix |
|---|---|---|---|
| 404 | `Player … not found in batch …` | The oracle has not indexed your join yet (event lag), or you never joined | Retry in ~5 s with backoff; confirm the join transaction mined |
| 400 | `expected_hash … does not match on-chain commitment …` | The hash you sent disagrees with your on-chain position | If you just updated, wait for the `updateBitmap` transaction to mine, then resend; otherwise re-derive the hash |
| 400 | `Bitmap verification failed: Hash mismatch` | `keccak256(bitmap bytes) != expected_hash` | Recompute keccak256 over the exact bytes you POST: [Bitmap encoding](/docs/bots/bitmap-encoding) (~4 min) |
| 400 | `Bitmap too short: …` | Fewer bytes than `ceil(market_count / 8)` | Size the bitmap to cover every market in the block |
| 400 | `Invalid player address` / `Invalid bitmap hex` / `Invalid expected_hash` | Malformed field in the JSON body | Hex fields need the `0x` prefix; check each field's format |

The 404 is self-healing: the oracle re-reads your position from the chain when its cache disagrees with you, so a join that has mined will be recognized within a few retries.

One wrapper to know about: posting through `https://generalmarket.io/api/vision/bitmap` fans out to every oracle node and returns **HTTP 200 even when every node rejected the bitmap**. The verdict is in the body — `{acceptedCount, totalCount, results[]}` — with each failure's real status inside `results[].error`. Check `acceptedCount > 0`. Full shapes: [Submit a bitmap](/docs/developers/vision-api/bitmap) (~3 min).

## Faucet errors

`POST /api/faucet` — the faucet the reference bot calls:

| Status | Response | Cause | Fix |
|---|---|---|---|
| 403 | `{"error": "WAITLIST_REQUIRED", "waitlistUrl": …}` | The address is not whitelisted — the waitlist gate is on by default | Join the waitlist at the returned `waitlistUrl`, then retry |
| 429 | `{"error": "COOLDOWN", "retryAfter": …}` | The same address claimed less than 30 s ago | Wait `retryAfter` seconds (also sent as a `Retry-After` header) |
| 400 | `{"error": "Invalid address"}` / `{"error": "Invalid amount"}` | Malformed address, or an amount that is not a positive number | Fix the body. Amounts above 10,000 are not rejected — they are clamped to 10,000 |

**The faucet is waitlist-gated by default.** A fresh wallet gets a 403 until it is whitelisted — this also stops the reference bot's auto-faucet for non-whitelisted keys.

There is a second, separate faucet for bots: `POST /api/bot/faucet` — a fixed grant of 100 USDC + 1 GM gas, one claim per IP and per address per 24 h (429 with a `Rate limit: … Try again in Xh` message), behind the same 403 waitlist gate. Details: [Faucet](/docs/developers/vision-api/faucet) (~3 min).

**Testnet only.** Faucet funds are not real money.

```gmseealso
[{"title": "Contract reference", "href": "/docs/developers/contracts"}, {"title": "Submit a bitmap (API)", "href": "/docs/developers/vision-api/bitmap"}, {"title": "Faucet (API)", "href": "/docs/developers/vision-api/faucet"}]
```

Next: [Contract reference](/docs/developers/contracts) (~6 min)
