/**
 * Block Explorer URL utilities for Index L3 (Orbit) and Arbitrum Sepolia
 */

import { L3_EXPLORER_URL, ARB_EXPLORER_URL } from '@/lib/config'

export type ExplorerChain = 'arb' | 'l3'

function explorerBase(chain: ExplorerChain): string {
  const base = chain === 'arb' ? ARB_EXPLORER_URL : L3_EXPLORER_URL
  return base
}

export function getTxUrl(txHash: string, chain: ExplorerChain = 'l3'): string {
  const base = explorerBase(chain)
  return base ? `${base}/tx/${txHash}` : '#'
}

export function getAddressUrl(address: string, chain: ExplorerChain = 'l3'): string {
  const base = explorerBase(chain)
  return base ? `${base}/address/${address}` : '#'
}

export function getContractUrl(address: string, chain: ExplorerChain = 'l3'): string {
  const base = explorerBase(chain)
  return base ? `${base}/address/${address}#code` : '#'
}
