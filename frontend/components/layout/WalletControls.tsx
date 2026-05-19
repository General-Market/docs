'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { truncateAddress } from '@/lib/utils/address'
import { indexL3 } from '@/lib/wagmi'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { HeaderBalanceBar } from './HeaderBalanceBar'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { springs } from '@/components/ui/spring'

interface WalletControlsProps {
  isDark: boolean
}

const ENTER = { opacity: 0, y: -12, filter: 'blur(4px)' }
const VISIBLE = { opacity: 1, y: 0, filter: 'blur(0px)' }
const EXIT = { opacity: 0, y: -12, filter: 'blur(4px)' }

export function WalletControls({ isDark }: WalletControlsProps) {
  const t = useTranslations('common')
  const reduced = useReducedMotion()
  const [mounted, setMounted] = useState(false)

  const { address, isConnected } = useAccount()
  const authenticated = isConnected
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const injectedConnector = connectors.find(c => c.type === 'injected') || connectors[0]
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const isWrongNetwork = isConnected && chainId !== indexL3.id

  useEffect(() => { setMounted(true) }, [])

  // Auto-switch to L3 on first connect only
  const hasAutoSwitched = useRef(false)
  useEffect(() => {
    if (isConnected && !hasAutoSwitched.current) {
      hasAutoSwitched.current = true
      if (isWrongNetwork && !isSwitching) {
        switchChain({ chainId: indexL3.id })
      }
    }
    if (!isConnected) hasAutoSwitched.current = false
  }, [isConnected, isWrongNetwork, isSwitching, switchChain])

  const { capture, identify, reset: resetPostHog } = usePostHogTracker()
  useEffect(() => {
    if (authenticated && address) {
      identify(address, { login_method: 'injected', chain_id: chainId })
      capture('wallet_connected', { wallet_address: address, chain_id: chainId })
    }
  }, [authenticated, address])

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isMobile = isAndroid || isIOS
  const isInMetaMaskBrowser = /MetaMaskMobile/i.test(ua)
  const hasInjectedProvider = typeof window !== 'undefined' && !!window.ethereum

  // Connect first. The injected connector's switchChain handles
  // wallet_addEthereumChain via the 4902 fallback after the wallet is
  // authorized. Chaining add/switch/connect across three app context
  // switches on mobile strands the promise chain.
  const handleLogin = () => {
    capture('login_clicked', { source: 'header', mobile: isMobile, has_provider: hasInjectedProvider })

    // Mobile browser without injected provider → hand off to the MetaMask app.
    // Skip if we're already inside MM's in-app browser (provider may be late
    // to inject during hydration); never bounce a user out of MM into Chrome.
    if (isMobile && !hasInjectedProvider && !isInMetaMaskBrowser) {
      const dappPath = `${window.location.host}${window.location.pathname}${window.location.search}`
      // Android: intent URL forces the MM package and avoids Chrome opening
      // metamask.app.link as a regular tab when the universal link fails to
      // intercept. iOS: universal link is the only handoff that exists.
      const target = isAndroid
        ? `intent://${dappPath}#Intent;scheme=https;package=io.metamask;S.browser_fallback_url=https%3A%2F%2Fmetamask.app.link%2Fdapp%2F${encodeURIComponent(dappPath)};end`
        : `https://metamask.app.link/dapp/${dappPath}`
      window.location.assign(target)
      return
    }

    // Desktop browser without injected provider → send them to the install
    // page. Calling connect() with no provider silently no-ops and looks like
    // the button is dead.
    if (!isMobile && !hasInjectedProvider) {
      window.open('https://metamask.io/download/', '_blank', 'noopener,noreferrer')
      return
    }

    if (injectedConnector) {
      connect({ connector: injectedConnector, chainId: indexL3.id })
    }
  }

  const handleLogout = () => {
    capture('wallet_disconnected')
    resetPostHog()
    disconnect()
  }

  const spring = reduced ? { duration: 0 } : springs.entrance

  return (
    <AnimatePresence mode="wait">
      {mounted && authenticated && address ? (
        <motion.div
          key="connected"
          className="flex items-center gap-1.5 sm:gap-2"
          initial={reduced ? false : ENTER}
          animate={VISIBLE}
          exit={EXIT}
          transition={spring}
        >
          {/* Context-aware balance — Vision on /, /source; ITP on /index; both on /profile */}
          <HeaderBalanceBar isDark={isDark} />

          {/* Wallet address button. Logout icon is always visible so touch
             users see the intent without a hover state. */}
          <button
            onClick={handleLogout}
            aria-label={t('actions.disconnect')}
            className={`group inline-flex items-center gap-1.5 px-2.5 h-9 text-[12px] font-mono font-medium rounded-lg transition-all duration-200 fluid-press ${
              isDark
                ? 'bg-white/10 text-text-inverse-muted hover:bg-red-500/20 hover:text-red-300'
                : 'bg-zinc-100 text-text-secondary hover:bg-red-50 hover:text-red-600'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:bg-red-400 transition-colors" />
            <span>{truncateAddress(address)}</span>
            <svg className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </motion.div>
      ) : mounted && isWrongNetwork ? (
        <motion.button
          key="wrong-network"
          onClick={() => switchChain({ chainId: indexL3.id })}
          disabled={isSwitching}
          initial={reduced ? false : ENTER}
          animate={VISIBLE}
          exit={EXIT}
          transition={spring}
          className={`inline-flex items-center gap-1.5 px-3 h-11 text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50 fluid-press ${
            isDark
              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          {isSwitching ? t('wallet.switching') : t('wallet.switch_network')}
        </motion.button>
      ) : (
        <motion.div
          key="disconnected"
          className="flex items-center gap-1.5"
          initial={reduced ? false : ENTER}
          animate={VISIBLE}
          exit={EXIT}
          transition={spring}
        >
          <button
            onClick={handleLogin}
            data-onboarding-target="wallet-connect"
            className={`inline-flex items-center px-4 h-11 text-[13px] font-semibold tracking-[0.01em] rounded-lg transition-all duration-200 fluid-press border ${
              isDark
                ? 'border-white/20 text-white hover:bg-white/10'
                : 'border-zinc-300 text-text-secondary hover:border-zinc-900 hover:text-zinc-900'
            }`}
          >
            {t('wallet.login')}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
