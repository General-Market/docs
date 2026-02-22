/**
 * Vision Bitmap Encoder (TypeScript)
 *
 * Encodes a list of UP/DOWN bets into a packed bitmap and computes the
 * keccak256 hash used for on-chain commitment.
 *
 * Bit ordering: big-endian within each byte (bit 0 = MSB of byte 0).
 *   1 = UP, 0 = DOWN
 *
 * Usage: npx tsx encode.ts
 * Dependencies: npm install viem
 */

import { keccak256, toHex } from "viem";

export function encodeBitmap(bets: boolean[]): {
  bitmap: Uint8Array;
  hash: `0x${string}`;
} {
  const byteCount = Math.ceil(bets.length / 8);
  const bitmap = new Uint8Array(byteCount);
  for (let i = 0; i < bets.length; i++) {
    if (bets[i]) {
      bitmap[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
    }
  }
  return { bitmap, hash: keccak256(bitmap) };
}

// -- Demo ---------------------------------------------------------------------

const bets = Array.from({ length: 10 }, (_, i) => i % 2 === 0);
const { bitmap, hash } = encodeBitmap(bets);

console.log(`Bets:   ${bets.map((b) => (b ? "UP" : "DOWN"))}`);
console.log(`Bitmap: ${toHex(bitmap)}`);
console.log(`Hash:   ${hash}`);
console.log(`Bytes:  ${bitmap.length} (${bets.length} markets)`);
