'use client'

import { useCallback } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { indexL3, settlementChain, getWalletRpcUrls, ensureWalletRpcRefreshed } from '@/lib/wagmi'

/**
 * Global chain enforcer — when the wallet is connected on the wrong chain,
 * shows a blocking overlay. The wallet popup is fired only when the user
 * clicks "Switch Network", never on mount.
 *
 * wagmi's injected connector silently restores prior connections on every
 * page load. Any wallet_* RPC call from a mount-time effect would surface as
 * an unsolicited MetaMask popup. Writes still get the correct chain via
 * useChainWrite, which is the only place ensureWalletRpcRefreshed should
 * fire automatically.
 */
export function ChainGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  // Both Vision deposits and ITP creation (via Settlement BridgeProxy) require Settlement.
  // Allow Settlement on all pages to avoid ChainGuard racing against legitimate cross-chain txs.
  const allowedChainIds = [indexL3.id, settlementChain.id]
  const isWrongChain = isConnected && !allowedChainIds.includes(chainId)

  // Probe with wallet_switchEthereumChain first; only call wallet_addEthereumChain
  // on 4902 (chain not configured). EIP-3085 rewrites the wallet's stored RPC URL
  // every time wallet_addEthereumChain is invoked — OKX desynchronises its per-chain
  // nonce cache when the URL rotates, producing spurious "Nonce too high" errors.
  // ensureWalletRpcRefreshed runs first to force the canonical URL exactly once
  // per browser (gated on WALLET_RPC_REWRITE_VERSION), the migration-cutover
  // escape hatch.
  const forceSwitch = useCallback(async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      await ensureWalletRpcRefreshed(indexL3)
      const chainIdHex = `0x${indexL3.id.toString(16)}`
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        })
      } catch (err: any) {
        if (err?.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: chainIdHex,
                chainName: indexL3.name,
                nativeCurrency: indexL3.nativeCurrency,
                rpcUrls: getWalletRpcUrls(indexL3),
                ...(indexL3.blockExplorers?.default ? {
                  blockExplorerUrls: [indexL3.blockExplorers.default.url],
                } : {}),
              }],
            })
          } catch { /* user rejected the add */ }
        }
        // Other errors: user rejected switch — they'll click again.
      }
    }
    // Reconcile wagmi's cached chainId (mobile MetaMask doesn't always emit chainChanged).
    switchChain({ chainId: indexL3.id })
  }, [switchChain])

  if (!isWrongChain) {
    return <>{children}</>
  }

  // Blocking overlay — nothing is clickable until chain is correct
  return (
    <>
      {children}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center glass-overlay">
        <div className="border border-border-light bg-card rounded-xl shadow-modal p-8 max-w-md text-center">
          <div className="text-color-warning text-xl font-semibold mb-4">Wrong Network</div>
          <p className="text-text-secondary text-sm mb-2">
            Your wallet is connected to chain {chainId}.
          </p>
          <p className="text-text-secondary text-sm mb-6">
            Please switch to Index L3 (chain {indexL3.id}).
          </p>
          <button
            onClick={forceSwitch}
            disabled={isSwitching}
            className="px-6 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
          >
            {isSwitching ? 'Switching...' : 'Switch Network'}
          </button>
        </div>
      </div>
    </>
  )
}
