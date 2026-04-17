'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { truncateAddress } from '@/lib/utils/address'
import { indexL3 } from '@/lib/wagmi'
import { usePostHogTracker } from '@/hooks/usePostHog'

export function WalletConnectButton() {
  const t = useTranslations('common')
  const [mounted, setMounted] = useState(false)
  const { address, isConnected, isConnecting, isReconnecting } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { capture, identify, reset: resetPostHog } = usePostHogTracker()

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

  // Track wallet connection + identify user in PostHog
  useEffect(() => {
    if (isConnected && address) {
      const connectorName = injectedConnector?.name || 'injected'
      identify(address, { wallet_type: connectorName, chain_id: chainId })
      capture('wallet_connected', {
        wallet_address: address,
        connector_type: connectorName,
        chain_id: chainId,
      })
    }
  }, [isConnected, address])

  // Track wrong network events
  useEffect(() => {
    if (isWrongNetwork) {
      capture('wallet_wrong_network', {
        current_chain_id: chainId,
        target_chain_id: indexL3.id,
      })
    }
  }, [isWrongNetwork])

  // Render placeholder during SSR and initial hydration to prevent mismatch
  if (!mounted) {
    return (
      <button
        disabled
        className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg opacity-50 cursor-not-allowed"
      >
        {t('wallet.login')}
      </button>
    )
  }

  // Handle connect click. Connect first; the injected connector's switchChain
  // handles `wallet_addEthereumChain` via the 4902 fallback after the wallet
  // is authorized. On mobile, chaining add/switch/connect across three app
  // context switches strands the promise chain and leaves the UI on
  // "Connecting…" forever.
  const handleConnect = () => {
    if (injectedConnector) {
      capture('wallet_connect_clicked', { source: 'header' })
      connect({ connector: injectedConnector, chainId: indexL3.id })
    }
  }

  const handleSwitchNetwork = () => {
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
        {isSwitching ? t('wallet.switching') : t('wallet.switch_network')}
      </button>
    )
  }

  // Connected state. Logout icon is always visible so touch users see the
  // intent without a hover reveal.
  if (isConnected && address) {
    return (
      <button
        onClick={() => { capture('wallet_disconnected'); resetPostHog(); disconnect() }}
        aria-label={t('actions.disconnect')}
        className="group inline-flex items-center gap-2 px-3 h-11 bg-muted border border-border-medium text-text-primary text-sm font-mono rounded-lg transition-all hover:bg-red-950/20 hover:border-red-400/30 hover:text-red-400"
      >
        <span>{truncateAddress(address)}</span>
        <svg className="w-4 h-4 opacity-60 group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    )
  }

  // No wallet detected, link to MetaMask install
  if (!injectedConnector) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
      >
        {t('wallet.install_metamask')}
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
        </svg>
      </a>
    )
  }

  // Disconnected state
  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className="inline-flex items-center px-4 h-11 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? t('wallet.connecting') : t('wallet.login')}
    </button>
  )
}
