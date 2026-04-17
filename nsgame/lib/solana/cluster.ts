import { clusterApiUrl, Connection, type Cluster } from '@solana/web3.js'

export type SolanaCluster = 'mainnet-beta' | 'devnet' | 'testnet' | 'localnet'

// Cluster selection — env-driven so devnet stays default in dev,
// mainnet-beta flips on for production without a code change.
export const activeCluster: SolanaCluster =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as SolanaCluster | undefined) ?? 'devnet'

// RPC URL — prefer explicit override, fall back to the public cluster URL.
// localnet expects the user to run `solana-test-validator` on 8899.
function resolveRpcUrl(cluster: SolanaCluster): string {
  const override = process.env.NEXT_PUBLIC_SOLANA_RPC_URL
  if (override) return override
  if (cluster === 'localnet') return 'http://127.0.0.1:8899'
  return clusterApiUrl(cluster as Cluster)
}

export const activeRpcUrl = resolveRpcUrl(activeCluster)

// Browser-side Connection. API routes that need server-side RPC should
// construct their own with the non-public URL to avoid rate limits.
export const connection = new Connection(activeRpcUrl, {
  commitment: 'confirmed',
  wsEndpoint: process.env.NEXT_PUBLIC_SOLANA_WS_URL,
})

// Block explorers by cluster — Solscan for readability, explorer.solana for raw.
export function getExplorerTxUrl(signature: string): string {
  const base = 'https://solscan.io/tx'
  if (activeCluster === 'mainnet-beta') return `${base}/${signature}`
  return `${base}/${signature}?cluster=${activeCluster}`
}

export function getExplorerAddressUrl(address: string): string {
  const base = 'https://solscan.io/account'
  if (activeCluster === 'mainnet-beta') return `${base}/${address}`
  return `${base}/${address}?cluster=${activeCluster}`
}

export const isMainnet = activeCluster === 'mainnet-beta'
export const isDevnet = activeCluster === 'devnet'
