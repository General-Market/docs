'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter'
import { truncateAddress } from '@/lib/utils/address'
import { useWallet } from '@/hooks/useWallet'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { HeaderBalanceBar } from './HeaderBalanceBar'
import { usePoints } from '@/hooks/usePoints'
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

  const { address, connected, cluster, disconnect } = useWallet()
  const { setShowModal } = useUnifiedWalletContext()
  const authenticated = connected

  const { points } = usePoints(address ?? undefined)

  useEffect(() => { setMounted(true) }, [])

  const { capture, identify, reset: resetPostHog } = usePostHogTracker()
  useEffect(() => {
    if (authenticated && address) {
      identify(address, { login_method: 'solana', cluster })
      capture('wallet_connected', { wallet_address: address, cluster })
    }
  }, [authenticated, address, cluster, identify, capture])

  const handleLogin = () => {
    capture('login_clicked', { source: 'header' })
    setShowModal(true)
  }

  const handleLogout = async () => {
    capture('wallet_disconnected')
    resetPostHog()
    await disconnect()
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
          <Link
            href="/points"
            className={`hidden sm:inline text-label font-bold font-mono transition-colors ${
              isDark ? 'text-text-muted hover:text-white' : 'text-text-muted hover:text-black'
            }`}
          >
            {points.total >= 1000 ? `${(points.total / 1000).toFixed(1)}K` : Math.floor(points.total).toLocaleString()} pts
          </Link>

          <HeaderBalanceBar isDark={isDark} />

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
