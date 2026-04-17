'use client'

// ChainGuard was the EVM-era network enforcer — it blocked the UI when the
// wallet sat on the wrong chain and called wallet_addEthereumChain to push
// the L3 config into MetaMask. Solana has no such ceremony: the wallet is
// pinned to a cluster at connect time, and we override RPC client-side.
//
// Kept as a no-op pass-through so the provider tree doesn't shift during the
// migration. Cluster validation, if ever needed, happens in useWallet /
// cluster.ts. Delete this file once the name no longer appears in imports.
export function ChainGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
