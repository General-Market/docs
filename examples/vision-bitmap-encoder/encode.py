"""
Vision Bitmap Encoder (Python)

Encodes a list of UP/DOWN bets into a packed bitmap and computes the
keccak256 hash used for on-chain commitment.

Bit ordering: big-endian within each byte (bit 0 = MSB of byte 0).
  1 = UP, 0 = DOWN
"""

import math
from web3 import Web3


def encode_bitmap(bets: list[bool]) -> tuple[bytes, str]:
    """
    Encode bets into a packed bitmap and return (bitmap_bytes, keccak256_hex).

    Args:
        bets: List of booleans. True = UP, False = DOWN.

    Returns:
        Tuple of (raw bitmap bytes, 0x-prefixed keccak256 hash).
    """
    byte_count = math.ceil(len(bets) / 8)
    bitmap = bytearray(byte_count)
    for i, bet in enumerate(bets):
        if bet:
            bitmap[i // 8] |= 1 << (7 - (i % 8))
    raw = bytes(bitmap)
    return raw, "0x" + Web3.keccak(raw).hex()


if __name__ == "__main__":
    # Example: 10 markets, alternating UP/DOWN
    bets = [i % 2 == 0 for i in range(10)]
    bitmap_bytes, bitmap_hash = encode_bitmap(bets)

    print(f"Bets:   {['UP' if b else 'DOWN' for b in bets]}")
    print(f"Bitmap: 0x{bitmap_bytes.hex()}")
    print(f"Hash:   {bitmap_hash}")
    print(f"Bytes:  {len(bitmap_bytes)} ({len(bets)} markets)")
