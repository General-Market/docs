---
title: Bitmap encoding
navTitle: Bitmap encoding
description: One bit per market — UP=1, DOWN=0, big-endian, keccak256 hash. The byte-level spec.
order: 4
group: Build
mode: reference
---

```gmplain
Your predictions travel as a string of bits — a bitmap. Each market in the block gets exactly one bit: 1 means UP, 0 means DOWN. The bits are packed into bytes from the most significant bit down, the bytes are hashed with keccak256, the hash goes on-chain, and the bytes themselves go to the oracle. This page is the exact byte-level spec, with a worked example you can reproduce.
```

```gmsummary
Encoding rules :: One bit per market, MSB-first, ceil(count/8) bytes, keccak256 hash
Worked example :: 10 markets → 2 bytes → 0xb2c0, hash included
Python implementation :: Encode, hash, and hex in ten lines
How the oracle reads it :: Bit i resolves markets[i]; short bitmaps are rejected
```

## Encoding rules

| Rule | Specification |
|---|---|
| Bits per market | 1 — `UP = 1`, `DOWN = 0` |
| Bit order | Big-endian within each byte: market 0 = most significant bit of byte 0 |
| Market order | The `markets` array from `GET /vision/config/by-hash/{configHash}` — bit *i* is your pick for `markets[i]` |
| Length | `ceil(marketCount / 8)` bytes |
| Padding | Unused trailing bits of the last byte are 0 |
| Hash | `keccak256(bitmapBytes)` — committed on-chain as `bitmapHash` in `joinBatchDirect` / `updateBitmap` |
| Wire format | `0x`-prefixed hex: the bytes as `bitmap_hex`, the hash as `expected_hash`, in `POST /vision/bitmap` |

Market *i* lives at byte `i / 8` (integer division), bit `7 − (i mod 8)`.

## Worked example

A block with 10 markets. Your picks, in market order:

```
UP DOWN UP UP DOWN DOWN UP DOWN UP UP
```

| | Byte 0 (markets 0–7) | Byte 1 (markets 8–9 + padding) |
|---|---|---|
| Bits | `1 0 1 1 0 0 1 0` | `1 1 0 0 0 0 0 0` |
| Binary | `0b10110010` | `0b11000000` |
| Hex | `0xb2` | `0xc0` |

- Bitmap: **`0xb2c0`** — 2 bytes, because `ceil(10 / 8) = 2`. The six trailing bits of byte 1 are padding zeros.
- Hash: `keccak256(0xb2c0)` = **`0x5c87342db22fe5b0058caa3c50895bee7a91823f053ac4b687eac723fed53644`**

You submit `bitmap_hex: "0xb2c0"` and `expected_hash: "0x5c87…3644"` to the oracle, and the same hash as `bitmapHash` on-chain.

## Python implementation

This is the reference implementation from `bot.py`:

```python
import math
from web3 import Web3

def encode_bitmap(bets: list[str], count: int) -> bytes:
    bitmap = bytearray(math.ceil(count / 8))
    for i in range(count):
        if bets[i] == "UP":
            bitmap[i // 8] |= 1 << (7 - (i % 8))
    return bytes(bitmap)

bets = ["UP", "DOWN", "UP", "UP", "DOWN", "DOWN", "UP", "DOWN", "UP", "UP"]
bitmap = encode_bitmap(bets, len(bets))

bitmap_hash = Web3.keccak(bitmap)     # bytes32 → joinBatchDirect / updateBitmap
bitmap_hex = "0x" + bitmap.hex()      # "0xb2c0" → POST /vision/bitmap
```

Reading a bit back (what the oracle does):

```python
def get_bit(bitmap: bytes, i: int) -> bool:
    return (bitmap[i // 8] >> (7 - (i % 8))) & 1 == 1
```

## How the oracle reads it

At resolution, the oracle decodes bit *i* as your side for `markets[i]`: 1 scores you UP, 0 scores you DOWN. Your deposit is split evenly across the block's markets, so each bit carries an equal slice of your stake — the scoring itself is in [How do I win?](/docs/vision/payouts) (~4 min).

Two validation rules, enforced at `POST /vision/bitmap`:

- **Hash mismatch → 400.** `expected_hash` must equal your on-chain commitment. If they differ, the oracle rejects with the actual on-chain value in the error message — recompute `keccak256` over the exact bytes you sent.
- **Too short → 400.** A bitmap shorter than `ceil(marketCount / 8)` bytes is rejected with `Bitmap too short`. Should an under-length bitmap ever reach resolution anyway, the stake allocated to uncovered markets is refunded, not lost.

The bitmap is sealed until resolution: only the hash is public before the tick ends. Why that matters is on [How predictions are sealed](/docs/vision/predictions-and-bitmaps) (~3 min); the symptom→fix table for every rejection is on [Errors and fixes](/docs/bots/errors) (~3 min).

```gmseealso
[{"title": "Update predictions each tick", "href": "/docs/bots/update-predictions"}, {"title": "Submit a bitmap (API)", "href": "/docs/developers/vision-api/bitmap"}]
```

Next: [Update predictions each tick](/docs/bots/update-predictions) (~4 min)
