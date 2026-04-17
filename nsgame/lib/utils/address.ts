// EVM address: 0x + 40 hex chars
export function isValidEvmAddress(address: string): boolean {
  if (!address) return false
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// Solana pubkey: base58, 32-44 chars
export function isValidSolanaAddress(address: string): boolean {
  if (!address) return false
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

export function isValidAddress(address: string): boolean {
  return isValidEvmAddress(address) || isValidSolanaAddress(address)
}

// Truncates either an EVM (0x1234…5678) or Solana (ABcd…XYz9) address.
// Unrecognized formats are returned unchanged so test fixtures still render.
export function truncateAddress(address: string): string {
  if (!address) return ''
  if (isValidEvmAddress(address)) return `${address.slice(0, 6)}...${address.slice(-4)}`
  if (isValidSolanaAddress(address)) return `${address.slice(0, 4)}...${address.slice(-4)}`
  return address
}
