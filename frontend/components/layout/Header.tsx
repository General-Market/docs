'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/routing'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { springs } from '@/components/ui/spring'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain, useReadContract } from 'wagmi'
import { truncateAddress } from '@/lib/utils/address'
import { indexL3 } from '@/lib/wagmi'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { USDC_ADDRESS, USDC_DECIMALS } from '@/lib/contracts/addresses'
import { LanguageSwitcher } from './LanguageSwitcher'
import { VisionBalanceBar } from '@/components/domain/vision/VisionBalanceBar'

// ── Navigation ────────────────────────────────────────────
const PRIMARY_NAV = [
  { id: 'index',    href: '/index',    labelKey: 'nav.investment' },
  { id: 'vision',   href: '/',         labelKey: 'nav.vision' },
  { id: 'explorer', href: '/explorer', labelKey: 'nav.explorer' },
  { id: 'points',   href: '/points',   labelKey: 'nav.points' },
] as const

type PageId = typeof PRIMARY_NAV[number]['id']

// Pages whose mood darkens the header
const DARK_PAGES = new Set<string>(['vision', 'explorer'])

function resolveActivePage(pathname: string): PageId | null {
  if (pathname === '/index' || pathname.startsWith('/index/')) return 'index'
  if (pathname === '/explorer' || pathname.startsWith('/explorer/')) return 'explorer'
  if (pathname === '/points') return 'points'
  if (pathname === '/' || pathname.startsWith('/source/')) return 'vision'
  return null
}

export function Header() {
  const t = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const reduced = useReducedMotion()

  const activePage = resolveActivePage(pathname)
  const isDark = activePage !== null && DARK_PAGES.has(activePage)
  const showVisionBalance = activePage === 'vision' || activePage === 'points'

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // ── Wagmi ───────────────────────────────────────────────
  const { address, isConnected } = useAccount()
  const authenticated = isConnected
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const injectedConnector = connectors.find(c => c.type === 'injected') || connectors[0]
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const isWrongNetwork = isConnected && chainId !== indexL3.id

  const { data: usdcRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }] as const,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address, refetchInterval: 15_000 },
  })
  const usdcBalance = usdcRaw !== undefined ? Number(usdcRaw) / 10 ** USDC_DECIMALS : null

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

  // ── PostHog ─────────────────────────────────────────────
  const { capture, identify, reset: resetPostHog } = usePostHogTracker()
  useEffect(() => {
    if (authenticated && address) {
      identify(address, { login_method: 'injected', chain_id: chainId })
      capture('wallet_connected', { wallet_address: address, chain_id: chainId })
    }
  }, [authenticated, address])

  // ── Handlers ────────────────────────────────────────────
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

  const handleLogin = async () => {
    capture('login_clicked', { source: 'header' })
    if (injectedConnector) {
      try { await addAndSwitchChain() } catch {}
      connect({ connector: injectedConnector, chainId: indexL3.id })
    }
  }

  const handleLogout = () => {
    capture('wallet_disconnected')
    resetPostHog()
    disconnect()
  }

  const scrollTo = (id: string) => {
    capture('section_scrolled_to', { section_name: id })
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenuOpen(false)
  }

  // ── Section nav (contextual scroll-to links for overflow) ──
  const sectionNav = activePage === 'index' ? [
    { id: 'markets', label: t('nav.markets') },
    { id: 'portfolio', label: t('nav.portfolio') },
    { id: 'create', label: t('nav.create') },
    { id: 'lend', label: t('nav.lend') },
    { id: 'backtest', label: t('nav.backtest') },
    { id: 'system', label: t('nav.system') },
  ] : activePage === 'vision' ? [
    { id: 'vision', label: t('nav.vision_nav') },
    { id: 'leaderboard', label: t('nav.leaderboard') },
    { id: 'markets-data', label: t('nav.markets_data') },
  ] : null

  return (
    <>
      {/* Topbar — thin black strip (scrolls away) */}
      <div className="bg-black text-white text-label font-medium text-center py-1.5">
        {t('brand.topbar')}
      </div>

      <div className="sticky top-0 z-50">
        {/* ── Chameleon header — mood shifts per section ── */}
        <header
          className={`border-b transition-colors duration-500 ${
            isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-white border-border-light'
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <div className="px-4 sm:px-6 lg:px-12">
            <div className="max-w-site mx-auto flex items-center justify-between h-14 sm:h-16">

              {/* Logo */}
              <Link href="/" className="shrink-0 flex items-center gap-2.5">
                <img
                  src="/logo.svg"
                  alt=""
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-xl"
                />
                <span className={`text-[19px] sm:text-[22px] font-black tracking-[-0.03em] transition-colors duration-500 ${
                  isDark ? 'text-white' : 'text-black'
                }`}>
                  {t('brand.logo_text')}
                </span>
              </Link>

              {/* Desktop: 4 equal tabs with spring underline */}
              <nav className="hidden lg:flex items-center">
                {PRIMARY_NAV.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => router.push(item.href)}
                    className={`relative px-5 py-5 text-[14px] font-semibold transition-colors duration-300 ${
                      activePage === item.id
                        ? isDark ? 'text-white' : 'text-black'
                        : isDark
                          ? 'text-zinc-400 hover:text-zinc-200'
                          : 'text-text-secondary hover:text-black'
                    }`}
                  >
                    {t(item.labelKey)}
                    {activePage === item.id && (
                      <motion.div
                        className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                          isDark ? 'bg-white' : 'bg-black'
                        }`}
                        layoutId="header-nav-indicator"
                        transition={reduced ? { duration: 0 } : springs.indicator}
                      />
                    )}
                  </button>
                ))}
                {/* About — secondary, desktop only */}
                <Link
                  href="/about"
                  className={`ml-2 px-3 py-5 text-caption transition-colors duration-300 ${
                    isDark
                      ? 'text-zinc-500 hover:text-zinc-300'
                      : 'text-text-secondary hover:text-black'
                  }`}
                >
                  {t('nav.about')}
                </Link>
              </nav>

              {/* Right side — Language + Balance + Wallet + Hamburger */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="hidden sm:block">
                  <LanguageSwitcher variant={isDark ? 'dark' : 'light'} />
                </div>
                {showVisionBalance && <VisionBalanceBar />}

                {/* Wallet — connected state */}
                {mounted && authenticated && address ? (
                  <div className="flex items-center gap-1.5">
                    {/* USDC balance or Deposit — non-vision pages */}
                    {!showVisionBalance && (
                      usdcBalance !== null && usdcBalance > 0 ? (
                        <span className={`hidden sm:inline text-[12px] font-semibold font-mono tabular-nums tracking-tight ${
                          isDark ? 'text-zinc-300' : 'text-zinc-700'
                        }`}>
                          {usdcBalance < 0.01 ? '<0.01' : usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className={`ml-0.5 font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>USDC</span>
                        </span>
                      ) : usdcBalance !== null ? (
                        <a
                          href={`https://onramp.money/main/buy/?appId=1&coinCode=usdc&network=${process.env.NEXT_PUBLIC_ONRAMP_NETWORK || 'sonic'}&walletAddress=${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                            isDark
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {t('wallet.deposit')}
                        </a>
                      ) : null
                    )}
                    {/* Address chip — shows green dot + truncated address, reveals disconnect on hover */}
                    <button
                      onClick={handleLogout}
                      className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-mono font-medium rounded-lg transition-all duration-200 fluid-press ${
                        isDark
                          ? 'bg-white/10 text-zinc-300 hover:bg-red-500/20 hover:text-red-300'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-red-50 hover:text-red-600'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:bg-red-400 transition-colors" />
                      <span className="group-hover:hidden">{truncateAddress(address)}</span>
                      <span className="hidden group-hover:inline text-[11px] font-sans font-semibold">{t('actions.disconnect')}</span>
                    </button>
                  </div>
                ) : mounted && isWrongNetwork ? (
                  <button
                    onClick={() => switchChain({ chainId: indexL3.id })}
                    disabled={isSwitching}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-50 fluid-press ${
                      isDark
                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {isSwitching ? t('wallet.switching') : t('wallet.switch_network')}
                  </button>
                ) : (
                  <button
                    onClick={handleLogin}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-semibold tracking-[-0.01em] rounded-lg transition-all duration-300 fluid-press ${
                      isDark
                        ? 'bg-white text-zinc-900 hover:bg-zinc-100 shadow-sm'
                        : 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {t('wallet.login')}
                  </button>
                )}

                {/* Hamburger — spring-animated lines → X, mobile only */}
                <div className="relative lg:hidden">
                  <button
                    className={`p-3 -m-1 transition-colors ${
                      isDark ? 'text-zinc-400 hover:text-white' : 'text-text-muted hover:text-text-primary'
                    }`}
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label={t('aria.toggle_menu')}
                  >
                    <div className="w-[18px] h-[14px] flex flex-col justify-between items-center">
                      <motion.span
                        className="block h-[2px] rounded-full bg-current origin-center"
                        animate={mobileMenuOpen
                          ? { rotate: 45, y: 6, width: 18 }
                          : { rotate: 0, y: 0, width: 18 }
                        }
                        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20, mass: 0.8 }}
                      />
                      <motion.span
                        className="block h-[2px] w-3 rounded-full bg-current"
                        animate={mobileMenuOpen
                          ? { opacity: 0, x: 8 }
                          : { opacity: 1, x: 0 }
                        }
                        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20, mass: 0.8 }}
                      />
                      <motion.span
                        className="block h-[2px] rounded-full bg-current origin-center"
                        animate={mobileMenuOpen
                          ? { rotate: -45, y: -6, width: 18 }
                          : { rotate: 0, y: 0, width: 18 }
                        }
                        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20, mass: 0.8 }}
                      />
                    </div>
                  </button>

                  {/* Overflow panel — spring entrance */}
                  <AnimatePresence>
                    {mobileMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={reduced ? { duration: 0 } : springs.entrance}
                        className={`absolute right-0 top-full mt-2 w-64 rounded-2xl py-2 z-50 origin-top-right ${
                          isDark
                            ? 'glass-panel-dark'
                            : 'glass-panel'
                        }`}
                      >
                        {/* Section scroll-to links (contextual) */}
                        {sectionNav && (
                          <div className={`px-2 py-1.5 mb-1 border-b ${isDark ? 'border-white/10' : 'border-border-light'}`}>
                            <div className={`px-1 mb-1 text-micro font-semibold uppercase tracking-[0.08em] ${isDark ? 'text-zinc-500' : 'text-text-muted'}`}>
                              Sections
                            </div>
                            {sectionNav.map((link) => (
                              <button
                                key={link.id}
                                onClick={() => scrollTo(link.id)}
                                className={`block w-full text-left px-2 py-2 text-caption rounded transition-colors ${
                                  isDark
                                    ? 'text-zinc-300 hover:text-white hover:bg-white/10'
                                    : 'text-text-secondary hover:text-black hover:bg-surface'
                                }`}
                              >
                                {link.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {[
                          { href: '/about', label: t('nav.about'), external: false },
                          { href: 'https://docs.generalmarket.io', label: t('footer.docs'), external: true },
                          { href: 'https://discord.gg/xsfgzwR6', label: t('footer.discord'), external: true },
                          { href: '/privacy', label: t('footer.privacy_policy'), external: false },
                          { href: '/terms', label: t('footer.terms_of_service'), external: false },
                        ].map((item) => item.external ? (
                          <a
                            key={item.href}
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setMobileMenuOpen(false)}
                            className={`block px-3 py-2.5 text-caption transition-colors ${
                              isDark
                                ? 'text-zinc-400 hover:text-white hover:bg-white/10'
                                : 'text-text-secondary hover:text-black hover:bg-surface'
                            }`}
                          >
                            {item.label}
                          </a>
                        ) : (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`block px-3 py-2.5 text-caption transition-colors ${
                              isDark
                                ? 'text-zinc-400 hover:text-white hover:bg-white/10'
                                : 'text-text-secondary hover:text-black hover:bg-surface'
                            }`}
                          >
                            {item.label}
                          </Link>
                        ))}

                        <div className={`px-3 pt-2 mt-1 border-t ${isDark ? 'border-white/10' : 'border-border-light'}`}>
                          <LanguageSwitcher />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* ── Mobile tab strip — 4 equal tabs below header ── */}
          <div
            className={`lg:hidden border-t transition-colors duration-500 ${
              isDark ? 'border-zinc-800' : 'border-border-light/50'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="px-2 flex">
              {PRIMARY_NAV.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { router.push(item.href); setMobileMenuOpen(false) }}
                  className={`relative flex-1 py-2.5 text-[12px] font-semibold text-center transition-colors duration-300 ${
                    activePage === item.id
                      ? isDark ? 'text-white' : 'text-black'
                      : isDark ? 'text-zinc-500' : 'text-text-muted'
                  }`}
                >
                  {t(item.labelKey)}
                  {activePage === item.id && (
                    <motion.div
                      className={`absolute bottom-0 left-3 right-3 h-0.5 rounded-full ${
                        isDark ? 'bg-white' : 'bg-black'
                      }`}
                      layoutId="mobile-nav-indicator"
                      transition={reduced ? { duration: 0 } : springs.indicator}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Section nav removed — lives in HomeClient as Morpho-style sidebar */}
      </div>
    </>
  )
}
