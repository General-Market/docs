'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { truncateAddress } from '@/lib/utils/address'
import { indexL3 } from '@/lib/wagmi'

export function WalletConnectButton() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected, isConnecting, isReconnecting } = useAccount()
  const { connect, connectors, isPending, error: connectError } = useConnect()
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
        className="px-6 py-3 bg-black border border-white text-white font-mono opacity-50 cursor-not-allowed"
      >
        Connect Wallet
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
        className="px-6 py-3 bg-black border border-accent text-accent hover:bg-accent hover:text-white transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSwitching ? 'Switching...' : 'Switch to Index Arbitrum'}
      </button>
    )
  }

  // Connected state - show address and disconnect
  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="px-4 py-2 bg-black border border-accent text-white font-mono">
          {truncateAddress(address)}
        </span>
        <button
          onClick={() => disconnect()}
          className="px-4 py-2 bg-black border border-white text-white hover:bg-accent hover:border-accent transition-colors font-mono"
        >
          Disconnect
        </button>
      </div>
    )
  }

  // Check if no wallet available
  const noWalletAvailable = !injectedConnector

  // Disconnected state - show connect button
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleConnect}
        disabled={isLoading || noWalletAvailable}
        className="px-6 py-3 bg-black border border-white text-white hover:bg-accent hover:border-accent transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {noWalletAvailable && (
        <p className="text-white/60 text-sm font-mono">
          Install MetaMask to connect
        </p>
      )}
      {connectError && (
        <p className="text-accent text-sm font-mono">
          {connectError.name === 'UserRejectedRequestError' ||
           connectError.message.toLowerCase().includes('reject') ||
           connectError.message.toLowerCase().includes('denied')
            ? 'Connection rejected'
            : 'Connection failed'}
        </p>
      )}
    </div>
  )
}
