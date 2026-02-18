/**
 * Bitmap encoding/decoding for portfolio positions.
 *
 * Positions are packed into a big-endian bitmap where each bit represents
 * YES/LONG (1) or NO/SHORT (0) for the corresponding market in the trade
 * list. This compact representation is used for on-chain storage and
 * deterministic hashing.
 */

import { keccak256, encodePacked } from 'viem'
import type { PortfolioPosition } from '../types'

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/**
 * Encode positions into a bitmap.
 *
 * Each bit represents the side for the corresponding position in the trade
 * list: YES/LONG = 1, NO/SHORT = 0. Bits are packed big-endian (position 0
 * is the MSB of the first byte). The last byte is zero-padded on the right
 * if the position count is not a multiple of 8.
 *
 * @param positions - Ordered array of portfolio positions
 * @returns 0x-prefixed hex string of the packed bitmap
 *
 * @example
 * ```ts
 * // 3 positions: YES, NO, YES -> binary 101_00000 -> 0xa0
 * encodePositionBitmap([
 *   { marketId: 'a', position: 'YES', confidence: 0.8 },
 *   { marketId: 'b', position: 'NO', confidence: 0.3 },
 *   { marketId: 'c', position: 'YES', confidence: 0.9 },
 * ])
 * // => '0xa0'
 * ```
 */
export function encodePositionBitmap(positions: PortfolioPosition[]): string {
  if (positions.length === 0) return '0x'

  const byteCount = Math.ceil(positions.length / 8)
  const bytes = new Uint8Array(byteCount)

  for (let i = 0; i < positions.length; i++) {
    const isYes =
      positions[i].position === 'YES' || positions[i].position === 'LONG'

    if (isYes) {
      // Big-endian: position 0 = MSB of byte 0
      const byteIndex = Math.floor(i / 8)
      const bitIndex = 7 - (i % 8)
      bytes[byteIndex] |= 1 << bitIndex
    }
  }

  // Convert to 0x-prefixed hex
  let hex = '0x'
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }

  return hex
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/**
 * Decode a bitmap hex string back to portfolio positions.
 *
 * The inverse of {@link encodePositionBitmap}. Reads each bit from the
 * bitmap (big-endian) and maps it to YES (1) or NO (0) for the
 * corresponding market ID.
 *
 * @param bitmap    - 0x-prefixed hex string of the packed bitmap
 * @param marketIds - Ordered array of market IDs matching the bitmap
 * @returns Array of portfolio positions in the same order as marketIds
 */
export function decodePositionBitmap(
  bitmap: string,
  marketIds: string[],
): PortfolioPosition[] {
  const hex = bitmap.startsWith('0x') ? bitmap.slice(2) : bitmap
  const bytes = new Uint8Array(hex.length / 2)

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }

  const positions: PortfolioPosition[] = []

  for (let i = 0; i < marketIds.length; i++) {
    const byteIndex = Math.floor(i / 8)
    const bitIndex = 7 - (i % 8)
    const isYes = byteIndex < bytes.length && (bytes[byteIndex] & (1 << bitIndex)) !== 0

    positions.push({
      marketId: marketIds[i],
      position: isYes ? 'YES' : 'NO',
      confidence: 0, // Confidence is not recoverable from the bitmap
    })
  }

  return positions
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic hash of a snapshot ID and bitmap for on-chain
 * verification.
 *
 * Uses `keccak256(abi.encodePacked(snapshotId, bitmap))` to match the
 * Solidity hashing scheme used by the AgiArena contract.
 *
 * @param snapshotId - Unique identifier for the trade list snapshot
 * @param bitmap     - 0x-prefixed hex bitmap from {@link encodePositionBitmap}
 * @returns 0x-prefixed keccak256 hash
 */
export function computeTradesHash(
  snapshotId: string,
  bitmap: string,
): string {
  const packed = encodePacked(
    ['string', 'bytes'],
    [snapshotId, bitmap as `0x${string}`],
  )
  return keccak256(packed)
}
