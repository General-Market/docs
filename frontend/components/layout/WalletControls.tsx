'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain, useReadContract } from 'wagmi'
import { truncateAddress } from '@/lib/utils/address'
import { indexL3 } from '@/lib/wagmi'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { USDC_ADDRESS, USDC_DECIMALS } from '@/lib/contracts/addresses'
import { VisionBalanceBar } from '@/components/domain/vision/VisionBalanceBar'
import { usePoints } from '@/hooks/usePoints'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { springs } from '@/components/ui/spring'

interface WalletControlsProps {
  isDark: boolean
  showVisionBalance: boolean
}

const ENTER = { opacity: 0, y: -12, filter: 'blur(4px)' }
const VISIBLE = { opacity: 1, y: 0, filter: 'blur(0px)' }
const EXIT = { opacity: 0, y: -12, filter: 'blur(4px)' }

export function WalletControls({ isDark, showVisionBalance }: WalletControlsProps) {
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

  const { points } = usePoints(address)
  const isFaucetEnabled = process.env.NEXT_PUBLIC_FAUCET_ENABLED === 'true'
  const faucetKey = address ? `faucet_used_${address.toLowerCase()}` : ''
  const alreadyUsed = typeof window !== 'undefined' && !!faucetKey && !!localStorage.getItem(faucetKey)
  const [faucetState, setFaucetState] = useState<'idle' | 'loading' | 'done' | 'error'>(alreadyUsed ? 'done' : 'idle')

  const { data: usdcRaw, refetch: refetchUsdc } = useReadContract({
    address: USDC_ADDRESS,
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }] as const,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address, refetchInterval: 15_000 },
  })
  const usdcBalance = usdcRaw !== undefined ? Number(usdcRaw) / 10 ** USDC_DECIMALS : null

  const handleFaucet = useCallback(async () => {
    if (!address || faucetState === 'loading' || alreadyUsed) return
    setFaucetState('loading')
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: '1000', gas: true }),
      })
      if (!res.ok) throw new Error()
      localStorage.setItem(faucetKey, '1')
      setFaucetState('done')
    } catch {
      setFaucetState('error')
      setTimeout(() => setFaucetState('idle'), 3000)
    }
  }, [address, faucetState, alreadyUsed, faucetKey])

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

  const chainIdHex = `0x${indexL3.id.toString(16)}`

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
    } catch {}
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
    } catch {}
  }

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const hasInjectedProvider = typeof window !== 'undefined' && !!window.ethereum

  const handleLogin = async () => {
    capture('login_clicked', { source: 'header', mobile: isMobile, has_provider: hasInjectedProvider })

    // Mobile browser without injected provider → deep-link to MetaMask app
    if (isMobile && !hasInjectedProvider) {
      const dappUrl = `${window.location.host}${window.location.pathname}`
      window.location.href = `https://metamask.app.link/dapp/${dappUrl}`
      return
    }

    if (injectedConnector) {
      if (hasInjectedProvider) {
        try { await addAndSwitchChain() } catch {}
      }
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
          {/* Points — only when connected */}
          <Link
            href="/points"
            className={`hidden sm:inline text-label font-bold font-mono transition-colors ${
              isDark ? 'text-text-muted hover:text-white' : 'text-text-muted hover:text-black'
            }`}
          >
            {points.total >= 1000 ? `${(points.total / 1000).toFixed(1)}K` : Math.floor(points.total).toLocaleString()} pts
          </Link>

          {showVisionBalance && <VisionBalanceBar />}

          {/* Balance — desktop only */}
          {!showVisionBalance && usdcBalance !== null && (
            <span
              className={`group/bal hidden sm:inline-flex items-center text-[12px] font-semibold font-mono tabular-nums tracking-tight ${
                isFaucetEnabled && usdcBalance === 0 ? 'cursor-pointer' : ''
              } ${isDark ? 'text-text-inverse-muted' : 'text-text-secondary'}`}
              onClick={isFaucetEnabled && usdcBalance === 0 ? handleFaucet : undefined}
            >
              {isFaucetEnabled && usdcBalance === 0 ? (
                <span className={`text-[11px] font-semibold ${
                  faucetState === 'loading' ? 'text-text-muted'
                    : faucetState === 'done' ? 'text-color-up'
                    : faucetState === 'error' ? 'text-color-down'
                    : 'text-color-up'
                }`}>
                  {faucetState === 'loading' ? 'Minting...'
                    : faucetState === 'done' ? '1K sent'
                    : faucetState === 'error' ? 'Failed'
                    : 'Get USDC'}
                </span>
              ) : usdcBalance > 0 ? (
                <>
                  {usdcBalance < 0.01 ? '<0.01'
                    : usdcBalance >= 1_000_000 ? `${(usdcBalance / 1_000_000).toFixed(2)}M`
                    : usdcBalance >= 1_000 ? `${(usdcBalance / 1_000).toFixed(1)}K`
                    : usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="ml-0.5 font-medium text-text-muted">USDC</span>
                </>
              ) : (
                <a
                  href={`https://onramp.money/main/buy/?appId=1&coinCode=usdc&network=${process.env.NEXT_PUBLIC_ONRAMP_NETWORK || 'sonic'}&walletAddress=${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                    isDark
                      ? 'bg-color-up/20 text-color-up hover:bg-color-up/30'
                      : 'bg-surface-up text-color-up hover:bg-surface-up/80'
                  }`}
                >
                  {t('wallet.deposit')}
                </a>
              )}
            </span>
          )}

          {/* Wallet address button */}
          <button
            onClick={handleLogout}
            className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-mono font-medium rounded-lg transition-all duration-200 fluid-press ${
              isDark
                ? 'bg-white/10 text-text-inverse-muted hover:bg-red-500/20 hover:text-red-300'
                : 'bg-zinc-100 text-text-secondary hover:bg-red-50 hover:text-red-600'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:bg-red-400 transition-colors" />
            <span className="group-hover:hidden">{truncateAddress(address)}</span>
            <span className="hidden group-hover:inline text-[11px] font-sans font-semibold">{t('actions.disconnect')}</span>
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
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-50 fluid-press ${
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
            className={`inline-flex items-center px-4 py-1.5 text-[12px] font-semibold tracking-[0.01em] rounded transition-all duration-200 fluid-press border ${
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
