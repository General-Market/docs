'use client'

import { useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { type Chain } from 'wagmi/chains'
import { indexL3, settlementChain } from '@/lib/wagmi'

/**
 * Global chain enforcer — blocks all UI and forces wallet to switch
 * to Index L3 whenever connected on the wrong chain.
 *
 * Vision pages allow Settlement as an additional chain because cross-chain
 * deposits (useDepositToVision) require the wallet to be on Settlement.
 */
export function ChainGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const pathname = usePathname()

  // Both Vision deposits and ITP creation (via Settlement BridgeProxy) require Settlement.
  // Allow Settlement on all pages to avoid ChainGuard racing against legitimate cross-chain txs.
  const allowedChainIds = [indexL3.id, settlementChain.id]
  const isWrongChain = isConnected && !allowedChainIds.includes(chainId)

  const forceSwitch = useCallback(async () => {
    // First, try low-level wallet RPC to add + switch chain
    // This works even if wagmi's switchChain has issues
    if (typeof window !== 'undefined' && window.ethereum) {
      const chainIdHex = `0x${indexL3.id.toString(16)}`
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: indexL3.name,
            nativeCurrency: indexL3.nativeCurrency,
            rpcUrls: [indexL3.rpcUrls.default.http[0]],
          }],
        })
      } catch {
        // Chain may already exist
      }
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        })
      } catch {
        // User rejected — will retry on next click
      }
    }
    // Also trigger wagmi's switch to keep state in sync
    switchChain({ chainId: indexL3.id })
  }, [switchChain])

  // On every connection, push the correct RPC URLs to the wallet.
  // wallet_addEthereumChain updates the RPC if the chain already exists (EIP-3085),
  // preventing stale localhost:8545 config from a previous env.
  useEffect(() => {
    if (!isConnected || typeof window === 'undefined' || !window.ethereum) return
    const pushChain = async (chain: Chain) => {
      try {
        await window.ethereum!.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${chain.id.toString(16)}`,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: [chain.rpcUrls.default.http[0]],
            ...(chain.blockExplorers?.default ? {
              blockExplorerUrls: [chain.blockExplorers.default.url],
            } : {}),
          }],
        })
      } catch { /* chain may reject if already configured identically */ }
    }
    pushChain(indexL3)
    pushChain(settlementChain)
  }, [isConnected])

  // Auto-attempt switch on wrong chain detection
  useEffect(() => {
    if (isWrongChain && !isSwitching) {
      forceSwitch()
    }
  }, [isWrongChain, isSwitching, forceSwitch])

  if (!isWrongChain) {
    return <>{children}</>
  }

  // Blocking overlay — nothing is clickable until chain is correct
  return (
    <>
      {children}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="border border-border-light bg-card rounded-xl shadow-modal p-8 max-w-md text-center">
          <div className="text-color-warning text-xl font-semibold mb-4">Wrong Network</div>
          <p className="text-text-secondary text-sm mb-2">
            Your wallet is on chain <span className="text-text-primary font-mono">{chainId}</span>.
          </p>
          <p className="text-text-secondary text-sm mb-6">
            Please switch to <span className="text-text-primary font-medium">Index L3</span> (chain {indexL3.id}).
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
