'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useConnect, useDisconnect, useModal } from '@phantom/react-sdk'
import { truncateAddress } from '@/lib/utils/address'
import { useWallet } from '@/hooks/useWallet'
import { usePostHogTracker } from '@/hooks/usePostHog'

export function WalletConnectButton() {
  const t = useTranslations('common')
  const [mounted, setMounted] = useState(false)
  const { address, connected, connecting, cluster } = useWallet()
  const { open } = useModal()
  const { disconnect } = useDisconnect()
  const { isConnecting } = useConnect()
  const { capture, identify, reset: resetPostHog } = usePostHogTracker()

  useEffect(() => {
    setMounted(true)
  }, [])

  const isLoading = connecting || isConnecting

  // Track connect + identify user in PostHog once per session transition.
  useEffect(() => {
    if (connected && address) {
      identify(address, { wallet_type: 'phantom', cluster })
      capture('wallet_connected', {
        wallet_address: address,
        connector_type: 'phantom',
        cluster,
      })
    }
  }, [connected, address, cluster, identify, capture])

  // SSR placeholder — Phantom's client flag isn't reliable on first paint,
  // so we gate on our own mount.
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

  const handleConnect = () => {
    capture('wallet_connect_clicked', { source: 'header' })
    open()
  }

  const handleDisconnect = () => {
    capture('wallet_disconnected')
    resetPostHog()
    disconnect()
  }

  if (connected && address) {
    return (
      <button
        onClick={handleDisconnect}
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
