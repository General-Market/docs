/**
 * Block Explorer URL utilities for Index L3 (Orbit) and Settlement
 */

import { L3_EXPLORER_URL, SETTLEMENT_EXPLORER_URL } from '@/lib/config'

export type ExplorerChain = 'settlement' | 'l3'

function explorerBase(chain: ExplorerChain): string {
  const base = chain === 'settlement' ? SETTLEMENT_EXPLORER_URL : L3_EXPLORER_URL
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
