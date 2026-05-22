'use client'

import { useCallback } from 'react'
import { useConnect } from 'wagmi'
import { indexL3, getWalletRpcUrls } from '@/lib/wagmi'
import { usePostHogTracker } from '@/hooks/usePostHog'

interface UseWalletLoginOptions {
  /** Where the login was triggered from. Tagged on the PostHog event. */
  source?: string
}

interface EthereumProvider {
  request: (req: { method: string; params?: unknown[] }) => Promise<unknown>
}

function getEthereumProvider(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum
}

/**
 * Canonical wallet login flow. Owns the mobile MetaMask deep-link, the
 * desktop install fallback, the L3 chain registration, and the PostHog
 * capture. Every "Connect wallet" / "Login" button in the dapp should
 * call this — otherwise mobile users on browsers without an injected
 * provider get a silently-dead button.
 */
export function useWalletLogin({ source = 'unknown' }: UseWalletLoginOptions = {}) {
  const { connect, connectors } = useConnect()
  const { capture } = usePostHogTracker()

  return useCallback(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const isAndroid = /Android/i.test(ua)
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    const isMobile = isAndroid || isIOS
    const isInMetaMaskBrowser = /MetaMaskMobile/i.test(ua)
    const provider = getEthereumProvider()
    const hasInjectedProvider = !!provider

    capture('login_clicked', { source, mobile: isMobile, has_provider: hasInjectedProvider })

    // Mobile browser without an injected provider → hand off to MetaMask app.
    // Skip if we're already inside MM's in-app browser (provider may inject
    // late during hydration); never bounce a user out of MM into Chrome.
    if (isMobile && !hasInjectedProvider && !isInMetaMaskBrowser) {
      const dappPath = `${window.location.host}${window.location.pathname}${window.location.search}`
      const target = isAndroid
        ? `intent://${dappPath}#Intent;scheme=https;package=io.metamask;S.browser_fallback_url=https%3A%2F%2Fmetamask.app.link%2Fdapp%2F${encodeURIComponent(dappPath)};end`
        : `https://metamask.app.link/dapp/${dappPath}`
      window.location.assign(target)
      return
    }

    // Desktop browser without an injected provider → send them to install.
    // Calling connect() with no provider silently no-ops and looks dead.
    if (!isMobile && !hasInjectedProvider) {
      window.open('https://metamask.io/download/', '_blank', 'noopener,noreferrer')
      return
    }

    const injected = connectors.find(c => c.id === 'injected') || connectors.find(c => c.type === 'injected') || connectors[0]
    if (!injected) return

    // Best-effort chain registration before connect. The injected connector's
    // switchChain handles wallet_addEthereumChain via the 4902 fallback after
    // the wallet authorises, so this is a fast path for users who already
    // have the chain installed.
    if (provider) {
      const chainIdHex = `0x${indexL3.id.toString(16)}`
      void provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: indexL3.name,
          nativeCurrency: indexL3.nativeCurrency,
          rpcUrls: getWalletRpcUrls(indexL3),
        }],
      }).catch(() => { /* chain may already exist */ })
    }

    connect({ connector: injected, chainId: indexL3.id })
  }, [connect, connectors, capture, source])
}
