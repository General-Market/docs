'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { truncateAddress } from '@/lib/utils/address'
import { indexL3 } from '@/lib/wagmi'

export function WalletConnectButton() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected, isConnecting, isReconnecting } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  // Prevent hydration mismatch by only rendering wallet state after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Find injected connector (MetaMask, etc.)
  const injectedConnector = connectors.find(c => c.id === 'injected')

  // Check if on wrong network (should be Index L3)
  const isWrongNetwork = isConnected && chainId !== indexL3.id

  // Loading state during connection or reconnection
  const isLoading = isConnecting || isReconnecting || isPending

  // Auto-switch to correct chain whenever connected but on wrong network
  // NOTE: Must be called before any early return to satisfy Rules of Hooks
  useEffect(() => {
    if (isConnected && isWrongNetwork && !isSwitching) {
      switchChain({ chainId: indexL3.id })
    }
  }, [isConnected, isWrongNetwork, isSwitching, switchChain])

  // Render placeholder during SSR and initial hydration to prevent mismatch
  if (!mounted) {
    return (
      <button
        disabled
        className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg opacity-50 cursor-not-allowed"
      >
        Login on Base
      </button>
    )
  }

  const chainIdHex = `0x${indexL3.id.toString(16)}`

  // Add chain to MetaMask and force switch to it
  const addAndSwitchChain = async () => {
    if (typeof window === 'undefined' || !window.ethereum) return
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
      // Chain may already exist — continue
    }
    // Force switch (addEthereumChain doesn't always auto-switch)
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
    } catch {
      // User rejected or chain not found — wagmi will show wrong-network state
    }
  }

  // Handle connect click - add chain, switch, then connect
  const handleConnect = async () => {
    if (injectedConnector) {
      await addAndSwitchChain()
      connect({ connector: injectedConnector, chainId: indexL3.id })
    }
  }

  // Handle network switch
  const handleSwitchNetwork = async () => {
    await addAndSwitchChain()
    switchChain({ chainId: indexL3.id })
  }

  // Wrong network state - prompt to switch
  if (isWrongNetwork) {
    return (
      <button
        onClick={handleSwitchNetwork}
        disabled={isSwitching}
        className="px-4 py-2 bg-surface-warning border border-color-warning/30 text-color-warning text-sm font-medium rounded-lg hover:bg-color-warning hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSwitching ? 'Switching...' : 'Switch to Index Arbitrum'}
      </button>
    )
  }

  // Connected state - single button, hover swaps address to "Disconnect" with red tint
  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="group px-3 py-2 bg-muted border border-border-medium text-text-primary text-sm font-mono rounded-lg transition-all hover:bg-red-950/20 hover:border-red-400/30 hover:text-red-400"
      >
        <span className="group-hover:hidden">{truncateAddress(address)}</span>
        <span className="hidden group-hover:inline">Disconnect</span>
      </button>
    )
  }

  // No wallet detected — link to MetaMask install
  if (!injectedConnector) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
      >
        Install MetaMask
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
        </svg>
      </a>
    )
  }

  // Disconnected state - "Login on Base"
  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'Connecting...' : 'Login on Base'}
    </button>
  )
}
