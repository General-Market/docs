# Vision Bitmap Encoding

> Machine-readable specification for encoding UP/DOWN predictions into packed bitmap bytes.

## Specification

- Encoding: big-endian bit packing
- Bit value: 1 = UP, 0 = DOWN
- Byte count: ceil(market_count / 8)
- Bit ordering: bit 0 = MSB of byte 0, bit 7 = LSB of byte 0, bit 8 = MSB of byte 1
- Unused trailing bits: padded with 0, ignored during resolution
- Commitment hash: keccak256(bitmap_bytes)

## Bit Layout

```
Byte 0:  [bit0][bit1][bit2][bit3][bit4][bit5][bit6][bit7]
Byte 1:  [bit8][bit9][bit10][bit11][bit12][bit13][bit14][bit15]
...

bit N maps to market_ids[N]
1 = player predicts UP for that market
0 = player predicts DOWN for that market
```

## Encoding Algorithm (Pseudocode)

```
INPUT: predictions[] (array of booleans, length = market_count)
OUTPUT: bitmap (byte array)

byte_count = ceil(market_count / 8)
bitmap = new byte_array(byte_count, fill=0)

for i = 0 to market_count - 1:
    if predictions[i] == UP:
        byte_idx = floor(i / 8)
        bit_idx  = 7 - (i % 8)
        bitmap[byte_idx] |= (1 << bit_idx)

return bitmap
```

## Python

```python
import math
from web3 import Web3

def encode_bitmap(predictions: list[bool]) -> bytes:
    byte_count = math.ceil(len(predictions) / 8)
    bitmap = bytearray(byte_count)
    for i, is_up in enumerate(predictions):
        if is_up:
            byte_idx = i // 8
            bit_idx = 7 - (i % 8)
            bitmap[byte_idx] |= (1 << bit_idx)
    return bytes(bitmap)

def decode_bitmap(bitmap: bytes, market_count: int) -> list[bool]:
    result = []
    for i in range(market_count):
        byte_idx = i // 8
        bit_idx = 7 - (i % 8)
        if byte_idx < len(bitmap):
            result.append((bitmap[byte_idx] >> bit_idx) & 1 == 1)
        else:
            result.append(False)
    return result

def hash_bitmap(bitmap: bytes) -> bytes:
    return Web3.keccak(bitmap)

# Example: 5 markets [UP, DOWN, UP, UP, DOWN]
bitmap = encode_bitmap([True, False, True, True, False])
# bitmap = b'\xb0'  (0b10110000)
# hash = keccak256(b'\xb0')
```

## TypeScript

```typescript
import { keccak256, toHex } from "viem";

type BetDirection = "UP" | "DOWN" | null;

function encodeBitmap(bets: BetDirection[], marketCount: number): Uint8Array {
  const byteCount = Math.ceil(marketCount / 8);
  const bitmap = new Uint8Array(byteCount);
  for (let i = 0; i < marketCount; i++) {
    if (i < bets.length && bets[i] === "UP") {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = 7 - (i % 8);
      bitmap[byteIdx] |= 1 << bitIdx;
    }
  }
  return bitmap;
}

function decodeBitmap(
  bitmap: Uint8Array,
  marketCount: number
): Array<"UP" | "DOWN"> {
  const result: Array<"UP" | "DOWN"> = [];
  for (let i = 0; i < marketCount; i++) {
    const byteIdx = Math.floor(i / 8);
    const bitIdx = 7 - (i % 8);
    if (byteIdx < bitmap.length && ((bitmap[byteIdx] >> bitIdx) & 1) === 1) {
      result.push("UP");
    } else {
      result.push("DOWN");
    }
  }
  return result;
}

function hashBitmap(bitmap: Uint8Array): `0x${string}` {
  return keccak256(bitmap);
}

function bitmapToHex(bitmap: Uint8Array): `0x${string}` {
  return toHex(bitmap);
}

// Example: 5 markets [UP, DOWN, UP, UP, DOWN]
const bitmap = encodeBitmap(["UP", "DOWN", "UP", "UP", "DOWN"], 5);
// bitmap = Uint8Array([0xB0])  = 0b10110000
const hash = hashBitmap(bitmap);
const hex = bitmapToHex(bitmap); // "0xb0"
```

## Commitment Flow

1. Encode predictions into bitmap bytes using the algorithm above.
2. Compute `bitmapHash = keccak256(bitmap_bytes)`.
3. Commit hash on-chain: `joinBatch(batchId, deposit, stakePerTick, bitmapHash)` or `updateBitmap(batchId, newBitmapHash)`.
4. Reveal bitmap off-chain: `POST /vision/bitmap` with `{ player, batch_id, bitmap_hex, expected_hash }`.

## Verification

The issuer verifies:
1. Player exists in the batch (on-chain check).
2. `expected_hash` matches the player's on-chain `bitmapHash` commitment.
3. `keccak256(bitmap_bytes) == expected_hash` (bitmap is authentic).

If any check fails, the bitmap is rejected and the player is voided for that tick (no win, no loss, stake forfeited).

## Worked Examples

### 3 markets: all UP
```
predictions = [UP, UP, UP]
bits:         1  1  1  0  0  0  0  0
byte 0:       0b11100000 = 0xE0
bitmap_hex:   "0xe0"
```

### 8 markets: alternating
```
predictions = [UP, DOWN, UP, DOWN, UP, DOWN, UP, DOWN]
bits:         1  0  1  0  1  0  1  0
byte 0:       0b10101010 = 0xAA
bitmap_hex:   "0xaa"
```

### 10 markets: first 5 UP, last 5 DOWN
```
predictions = [UP, UP, UP, UP, UP, DOWN, DOWN, DOWN, DOWN, DOWN]
bits:         1  1  1  1  1  0  0  0 | 0  0  0  0  0  0  0  0
byte 0:       0b11111000 = 0xF8
byte 1:       0b00000000 = 0x00
bitmap_hex:   "0xf800"
```

### 100 markets: all UP
```
byte_count = ceil(100 / 8) = 13
bytes 0-11:  0xFF (all bits set)
byte 12:     0b11110000 = 0xF0 (4 markets in last byte, 4 unused bits)
bitmap_hex:  "0xffffffffffffffffffffffffffff0" (padded to 13 bytes)
```
