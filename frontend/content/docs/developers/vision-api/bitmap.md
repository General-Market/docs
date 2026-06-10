---
title: Submit a bitmap
navTitle: Submit a bitmap
description: POST /vision/bitmap — body, fan-out behavior, hash-mismatch 400s, and indexer-lag 404s.
order: 4
group: Vision API
mode: reference
method: POST
---

```gmplain
After you join a block on-chain you have only committed a fingerprint of your predictions. This endpoint delivers the predictions themselves — the bitmap — to the oracles. The server forwards your submission to every oracle at once and tells you how many accepted it. If the hash you send does not match what you committed on-chain, you get a 400. If the oracles have not yet seen your join transaction, you get a 404 — wait a few seconds and resubmit.
```

```gmsummary
POST /vision/bitmap :: Send your bitmap; oracles verify it against your on-chain hash
The fan-out response :: One request fans out to every oracle; check acceptedCount
Errors and retries :: 400 means hash mismatch, 404 means indexer lag — resubmit
```

## POST /vision/bitmap

Delivers your raw prediction bitmap to the oracles, which verify it against the hash you committed on-chain.

```gm-try
{"method": "POST", "path": "/vision/bitmap", "params": [], "body": {"player": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", "batch_id": 301204, "bitmap_hex": "0xb5e3a0", "expected_hash": "0x8c41f6d7a92e3b50c1d84f7e6a2b9c0d3e5f1a8b7c6d4e2f0a9b8c7d6e5f4a3b"}, "response": {"acceptedCount": 3, "totalCount": 3, "results": [{"url": ".../oracle1", "accepted": true}, {"url": ".../oracle2", "accepted": true}, {"url": ".../oracle3", "accepted": true}]}}
```

Body fields, all required:

| Field | Type | Meaning |
|---|---|---|
| `player` | string | The address that joined the batch on-chain |
| `batch_id` | number | The batch the bitmap is for |
| `bitmap_hex` | string | Raw bitmap bytes, hex-encoded — `0x` prefix optional |
| `expected_hash` | string | keccak256 of the bitmap bytes; must equal the `bitmapHash` committed on-chain |

Each oracle, on receipt:

1. Validates the address, the hex, and the hash format — `400` on any malformed field.
2. Checks your on-chain commitment. The oracle caches commitments from `PlayerJoined` / `BitmapUpdated` events; when its cache disagrees with you, it re-reads `Vision.getPosition` from the chain (rate-limited) before deciding.
3. Validates length. The bitmap must cover every market in the batch — at least `ceil(market_count / 8)` bytes — or it is rejected with `400 Bitmap too short`.
4. Verifies `keccak256(bitmap) == expected_hash`, then stores the bitmap in its **pending** slot.

A per-oracle acceptance is `{"accepted": true, "batch_id": 301204, "player": "0x…"}`.

Resubmitting before the lock window overwrites the pending slot; at resolution the oracle flips pending to active and resolves with it. Submission is idempotent — resubmitting the same bitmap after a crash or oracle restart is safe and changes nothing. The encoding spec (bit order, byte layout, hashing) lives in [Bitmap encoding](/docs/bots/bitmap-encoding) (~3 min).

## The fan-out response

The API forwards your one request to every configured oracle and returns `200` with a per-oracle scoreboard — it returns `200` even when every oracle rejected you.

Success is `acceptedCount >= 1`, never the HTTP status. The response shape:

```json
{
  "acceptedCount": 2,
  "totalCount": 3,
  "results": [
    { "url": ".../oracle1", "accepted": true },
    { "url": ".../oracle2", "accepted": true },
    { "url": ".../oracle3", "accepted": false, "error": "HTTP 404: {\"error\":\"Player 0x… not found in batch 301204\"}" }
  ]
}
```

Each failed entry carries `error` as `HTTP {status}: {first 200 chars of the oracle's body}`. The official app treats `acceptedCount ≥ 1` as success and only errors at zero — but resubmitting until all accept costs nothing, since resubmission is idempotent.

## Errors and retries

A `400` means your data is wrong; a `404` means the oracle has not caught up with the chain yet — only the second one is fixed by waiting.

| Upstream status | Body starts with | Meaning | Fix |
|---|---|---|---|
| `400` | `Invalid player address` / `Invalid bitmap hex` / `Invalid expected_hash` | Malformed field | Fix the format and resubmit |
| `400` | `expected_hash 0x… does not match on-chain commitment 0x…` | Your bitmap does not hash to the `bitmapHash` the chain holds for you | Re-encode and re-hash; if you called `updateBitmap` on-chain, submit the *new* bitmap |
| `400` | `Bitmap too short: N bytes covers M markets, batch has K` | Bitmap does not cover all markets | Pad to `ceil(market_count / 8)` bytes |
| `400` | `Bitmap verification failed: …` | `keccak256(bitmap)` ≠ `expected_hash` | Recompute the hash over the exact bytes you send |
| `404` | `Player 0x… not found in batch N` | Indexer lag — your join transaction is not indexed yet, and the chain re-read was unavailable or rate-limited | Wait a few seconds, resubmit unchanged |

On the 404: the oracle's chain listener polls every ~2 seconds, and the oracle also attempts a direct chain re-read before rejecting. The official app retries up to 4 more times at 2-second intervals when no oracle accepts. Do the same — retry for ~10 seconds before treating a 404 as a real failure. A 404 that survives that window means the address genuinely never joined that batch.

```gmwarning
The fan-out always answers 200. A client that checks only the HTTP status will read total rejection as success. Check acceptedCount.
```

```gmseealso
[{"title": "Blocks & state", "href": "/docs/developers/vision-api/batches"}, {"title": "Bitmap encoding", "href": "/docs/bots/bitmap-encoding"}, {"title": "Update predictions each tick", "href": "/docs/bots/update-predictions"}]
```

Next: [Players & balances](/docs/developers/vision-api/players) (~3 min)
