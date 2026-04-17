import { keccak256, toBytes } from 'viem'

/**
 * Generates a bet hash from portfolio JSON string
 * Uses keccak256(bytes(portfolioJSON)) matching the contract expectation
 *
 * @param portfolioJson - The portfolio JSON string to hash
 * @returns The keccak256 hash as a hex string
 */
export function generateBetHash(portfolioJson: string): `0x${string}` {
  return keccak256(toBytes(portfolioJson))
}
