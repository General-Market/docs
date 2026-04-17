/**
 * Validates an Ethereum address format
 * @param address - The address to validate
 * @returns true if valid Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  if (!address) return false
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Truncates an Ethereum address for display
 * @param address - The full Ethereum address (0x...)
 * @returns Truncated address like "0x1234...5678"
 */
export function truncateAddress(address: string): string {
  if (!address) return ''
  // Return as-is if not a valid address format (defensive)
  if (!isValidAddress(address)) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
