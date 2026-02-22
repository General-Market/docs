/**
 * Bitmap encoding/decoding for P2Pool predictions.
 *
 * Each bit represents a player's bet on a market:
 *   1 = UP, 0 = DOWN
 *
 * Bit ordering is big-endian within each byte, matching the issuer's
 * `get_bitmap_bit` function in resolver.rs:
 *   - Bit 0 is the MSB of byte 0
 *   - Bit 7 is the LSB of byte 0
 *   - Bit 8 is the MSB of byte 1
 *   etc.
 */
import { keccak256, toHex } from 'viem'

export type BetDirection = 'UP' | 'DOWN' | null

/**
 * Encode an array of bets into a packed bitmap (big-endian bit order).
 *
 * @param bets - Array of predictions per market. null is treated as DOWN (0).
 * @param marketCount - Total number of markets in the batch.
 *   If bets.length < marketCount, remaining bits default to 0 (DOWN).
 * @returns Packed bitmap as Uint8Array
 */
export function encodeBitmap(bets: BetDirection[], marketCount: number): Uint8Array {
  const byteCount = Math.ceil(marketCount / 8)
  const bitmap = new Uint8Array(byteCount)

  for (let i = 0; i < marketCount; i++) {
    if (i < bets.length && bets[i] === 'UP') {
      const byteIdx = Math.floor(i / 8)
      const bitIdx = 7 - (i % 8) // big-endian: bit 0 = MSB
      bitmap[byteIdx] |= (1 << bitIdx)
    }
    // DOWN and null are 0 (already default)
  }

  return bitmap
}

/**
 * Hash a bitmap using keccak256, matching the on-chain commitment scheme.
 *
 * @param bitmap - Raw bitmap bytes
 * @returns keccak256 hash as 0x-prefixed hex string
 */
export function hashBitmap(bitmap: Uint8Array): `0x${string}` {
  return keccak256(bitmap)
}

/**
 * Decode a packed bitmap back into an array of bet directions.
 *
 * @param bitmap - Raw bitmap bytes
 * @param marketCount - Number of markets to decode
 * @returns Array of 'UP' or 'DOWN' for each market
 */
export function decodeBitmap(bitmap: Uint8Array, marketCount: number): Array<'UP' | 'DOWN'> {
  const result: Array<'UP' | 'DOWN'> = []

  for (let i = 0; i < marketCount; i++) {
    const byteIdx = Math.floor(i / 8)
    const bitIdx = 7 - (i % 8) // big-endian: bit 0 = MSB

    if (byteIdx < bitmap.length && ((bitmap[byteIdx] >> bitIdx) & 1) === 1) {
      result.push('UP')
    } else {
      result.push('DOWN')
    }
  }

  return result
}

/**
 * Convert bitmap bytes to a 0x-prefixed hex string for API submission.
 */
export function bitmapToHex(bitmap: Uint8Array): `0x${string}` {
  return toHex(bitmap)
}
