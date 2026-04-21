/**
 * Block explorer URL utilities.
 *
 * The EVM chains (Index L3, Sonic settlement) are gone. What remains is a
 * Solana-shaped shim: one chain, Solscan by default. The `ExplorerChain`
 * type is kept so existing consumers (HowItWorks, BilateralBetCard,
 * SignatureProgress, useTransactionNotification) keep compiling while the
 * Solana integration agent swaps in a richer cluster-aware implementation.
 */

// 'l3' / 'settlement' / 'evm' remain as string aliases so the lingering
// callers keep compiling while their code paths get rewritten.
export type ExplorerChain = 'solana' | 'l3' | 'settlement' | 'evm'

const SOLANA_EXPLORER_BASE =
  process.env.NEXT_PUBLIC_SOLANA_EXPLORER_URL || 'https://solscan.io'

function explorerBase(_chain: ExplorerChain = 'solana'): string {
  return SOLANA_EXPLORER_BASE
}

export function getTxUrl(txSignature: string, _chain: ExplorerChain = 'solana'): string {
  const base = explorerBase()
  return base ? `${base}/tx/${txSignature}` : '#'
}

export function getAddressUrl(address: string, _chain: ExplorerChain = 'solana'): string {
  const base = explorerBase()
  return base ? `${base}/account/${address}` : '#'
}

export function getContractUrl(address: string, _chain: ExplorerChain = 'solana'): string {
  const base = explorerBase()
  return base ? `${base}/account/${address}` : '#'
}

export function getExplorerBaseUrl(_chain: ExplorerChain = 'solana'): string {
  return explorerBase()
}
