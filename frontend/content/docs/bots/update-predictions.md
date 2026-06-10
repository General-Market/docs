---
title: Update predictions before the lock
navTitle: Update predictions
description: Change your sealed picks within the current round — updateBitmap on-chain, then resubmit the bitmap to the oracle.
order: 5
group: Build
mode: how-to
---

```gmplain
After you join a block you can still change your mind. Until a short freeze just before the round ends, you can replace your picks: tell the contract the new fingerprint of your choices, then send the new choices to the oracle. Once the freeze starts, your picks are final for that round. The next round is a fresh block — nothing carries over.
```

```gmsummary
What does updating actually change? :: Your picks within the current round — nothing carries over
How do I update? :: New bitmap, updateBitmap on-chain, then POST the bytes
What happens inside the oracle? :: Resubmits overwrite the pending slot until the flip at resolution
What if the submission fails? :: 404 is lag, 400 is hash mismatch — both fixable
```

## What does updating actually change?

Updating changes your sealed picks **within the current round** — nothing carries to the next one. A block (contract-level: a *batch*) lives exactly one round: it is created, players join, it locks, it resolves, it settles. The next round is a brand-new block with a new id, and playing it means a fresh `joinBatchDirect` with a fresh deposit. No prediction carries forward, so there is nothing to "update between rounds".

What you can do is change your mind before the round locks. Your on-chain position stores only the keccak256 hash of your bitmap. Until the lock window — the last `lockOffset` seconds of the round — you may replace that hash and resubmit the matching bitmap as often as you like.

Two layers must agree:

- **On-chain** — `updateBitmap` replaces the committed hash in your position.
- **Off-chain** — `POST /vision/bitmap` gives the oracle the bytes that match the new hash.

The oracle accepts a bitmap only if its hash equals your on-chain commitment, so the order is fixed: chain first, then POST.

**The reference bot never updates.** `bot.py` joins each block once and submits one bitmap; the flow on this page is yours to add.

## How do I update?

1. **Check the window is still open.** Read `tickDuration` and `lockOffset` from the block:

   ```python
   b = vision.functions.getBatch(batch_id).call()
   tick_duration, lock_offset = b[3], b[4]
   now = w3.eth.get_block("latest")["timestamp"]
   tick_end = (now // tick_duration + 1) * tick_duration
   locked = lock_offset > 0 and now >= tick_end - lock_offset
   ```

   If `lockOffset` is 0, the block has no lock window — updates are accepted until the tick ends. Each block carries its own value; read it, don't assume it.

2. **Build the new bitmap and hash it.** Same encoding as the join — one bit per market, UP = 1, big-endian: [Bitmap encoding](/docs/bots/bitmap-encoding) (~3 min). Then `new_hash = Web3.keccak(new_bitmap)`.

3. **Replace the hash on-chain.**

   ```python
   tx = vision.functions.updateBitmap(
       batch_id, config_hash, new_hash
   ).build_transaction({...})
   ```

   The signature is `updateBitmap(uint256 batchId, bytes32 configHash, bytes32 newBitmapHash)`. Pass the block's `configHash` — read it back from `getBatch(batch_id)` (field index 2) if unsure. Wait for the receipt before step 4.

   If it reverts: `NotJoined` (no position in this block — join first), `TickLocked` (the window closed — too late this round), `BatchNotFound` (wrong batch id **or** wrong `configHash`). Fixes: [Errors and fixes](/docs/bots/errors) (~3 min).

4. **Send the new bytes to the oracle.**

   ```python
   requests.post(f"{API_URL}/vision/bitmap", json={
       "player": address,
       "batch_id": batch_id,
       "bitmap_hex": "0x" + new_bitmap.hex(),
       "expected_hash": "0x" + new_hash.hex(),
   })
   ```

5. **What happens.** The oracle verifies `keccak256(bitmap) == expected_hash`, checks that hash against your on-chain commitment (re-reading `getPosition` from the chain if its cache disagrees), and stores the bytes in your *pending* slot. At the tick boundary the round resolves using the bitmap that was pending last.

## What happens inside the oracle?

The oracle keeps two slots per block: **pending** and **active**.

- Every accepted `POST /vision/bitmap` lands in pending, overwriting whatever was pending before. Only your last submission counts.
- At the tick boundary the engine **flips** pending into active, then resolves the round against the active bitmaps.
- For a block this flip happens once, at resolution — it is the moment your picks become final input to settlement.

The lock is enforced where it matters: after the lock window you can no longer change the on-chain hash, so the oracle rejects any *different* bitmap with a 400. Resubmitting the *same* bitmap still succeeds — submission is idempotent.

```gmtip
Resubmission is the recovery tool. The oracle buffers bitmap writes (flushed every 100 ms or every 200 rows) and reloads them from its database on restart — but a row caught in that buffer during a crash can be lost. If the oracle restarted, or you are unsure your bitmap landed, POST it again. Same bytes, same hash, no harm.
```

## What if the submission fails?

| Response | Meaning | Fix |
|---|---|---|
| `404` `Player … not found in batch …` | The oracle has not indexed your join yet (event lag) | Retry in ~5 s with backoff |
| `400` `expected_hash … does not match on-chain commitment …` | The oracle's view of your hash disagrees with what you sent | Confirm the `updateBitmap` transaction mined, then resend |
| `400` `Bitmap verification failed: Hash mismatch` | `keccak256(bitmap) != expected_hash` | Re-derive the hash from the exact bytes you POST |

One wrapper to know about: posting through `https://generalmarket.io/api/vision/bitmap` fans your submission out to every oracle node and returns **HTTP 200 even when every node rejected it**. The verdict is in the body — `{acceptedCount, totalCount, results[]}` — with each failure's real status inside `results[].error`. Check `acceptedCount > 0`. Full shapes: [Submit a bitmap](/docs/developers/vision-api/bitmap) (~3 min).

```gmseealso
[{"title": "Bitmap encoding", "href": "/docs/bots/bitmap-encoding"}, {"title": "Errors and fixes", "href": "/docs/bots/errors"}, {"title": "Submit a bitmap (API)", "href": "/docs/developers/vision-api/bitmap"}]
```

Next: [Strategies](/docs/bots/strategies) (~4 min)
