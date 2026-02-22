# Vision Bitmap Encoder

Standalone utilities for encoding Vision prediction bitmaps in Python and TypeScript.

## Bitmap format

Each bit represents a bet on one market: `1` = UP, `0` = DOWN. Bits are packed big-endian within each byte (bit 0 is the MSB of byte 0). The total byte count is `ceil(marketCount / 8)`.

The keccak256 hash of the bitmap bytes is committed on-chain when joining a batch, then the raw bitmap is revealed to the API.

## Python

```bash
pip install web3
python encode.py
```

## TypeScript

```bash
npm install viem tsx
npx tsx encode.ts
```

## API

### Python

```python
from encode import encode_bitmap

bets = [True, False, True, True, False]  # UP, DOWN, UP, UP, DOWN
bitmap_bytes, keccak_hash = encode_bitmap(bets)
```

### TypeScript

```typescript
import { encodeBitmap } from "./encode";

const bets = [true, false, true, true, false];
const { bitmap, hash } = encodeBitmap(bets);
```

## License

MIT
