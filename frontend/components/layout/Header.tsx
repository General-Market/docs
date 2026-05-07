'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/routing'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { springs } from '@/components/ui/spring'
import { useWeb3Available } from '@/lib/contexts/Web3Context'
import { useAccount } from 'wagmi'
import { LanguageSwitcher } from './LanguageSwitcher'
import dynamic from 'next/dynamic'
import Image from 'next/image'

const WalletControls = dynamic(() => import('./WalletControls').then(m => ({ default: m.WalletControls })), {
  ssr: false,
  loading: () => (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded border border-zinc-300 text-zinc-400">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
      ...
    </span>
  ),
})

const TopbarStats = dynamic(() => import('./TopbarStats').then(m => ({ default: m.TopbarStats })), {
  ssr: false,
  loading: () => <span className="tabular-nums">&nbsp;</span>,
})

// ── Navigation ────────────────────────────────────────────
const PRIMARY_NAV = [
  { id: 'vision',    href: '/',         labelKey: 'nav.vision' },
  { id: 'portfolio', href: '/profile',  labelKey: 'nav.portfolio' },
  { id: 'index',     href: '/index',    labelKey: 'nav.itps' },
  { id: 'explorer',  href: '/explorer', labelKey: 'nav.explorer' },
] as const

type PageId = typeof PRIMARY_NAV[number]['id']

// Pages whose mood darkens the header
const DARK_PAGES = new Set<string>(['vision'])

/** Renders nothing, exists solely to call useAccount() inside the provider boundary and lift wallet state up. */
function WalletStateBridge({ onState }: { onState: (address: string | undefined, connected: boolean) => void }) {
  const { address, isConnected } = useAccount()
  useEffect(() => { onState(address, isConnected) }, [address, isConnected, onState])
  return null
}

function resolveActivePage(pathname: string): PageId | null {
  if (pathname === '/explorer' || pathname.startsWith('/explorer/')) return 'explorer'
  if (pathname === '/index' || pathname.startsWith('/index/')) return 'index'
  if (pathname.startsWith('/profile/')) return 'portfolio'
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const hasWeb3 = useWeb3Available()
  const [walletState, setWalletState] = useState<{ address: string | undefined; isConnected: boolean }>({ address: undefined, isConnected: false })
  const onWalletState = useCallback((address: string | undefined, connected: boolean) => {
    setWalletState({ address, isConnected: connected })
  }, [])
  const { address, isConnected } = walletState

  const navHref = (item: typeof PRIMARY_NAV[number]) =>
    item.id === 'portfolio' ? (address ? `/profile/${address}` : null) : item.href

  return (
    <>
      {hasWeb3 && <WalletStateBridge onState={onWalletState} />}
      {/* Topbar, thin black strip (scrolls away) */}
      <div className="bg-black text-white text-label font-medium text-center py-1.5">
        <TopbarStats /> <span className="text-zinc-600 mx-1.5">·</span> <span className="text-zinc-500 uppercase tracking-wider text-[10px]">Testnet v0.93</span>
      </div>

      <div className="sticky top-0 z-50">
        {/* ── Chameleon header, mood shifts per section ── */}
        <header
          className={`border-b transition-colors duration-500 ${
            isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-white border-border-light'
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto flex items-center justify-between h-14 sm:h-16">

              {/* Logo */}
              <Link href="/" className="shrink-0 flex items-center gap-2.5">
                <img
                  src="/logo.svg"
                  alt=""
                  width={36}
                  height={36}
                  className="w-9 h-9"
                />
                <span className={`text-[19px] sm:text-[22px] font-black tracking-[-0.03em] transition-colors duration-500 ${
                  isDark ? 'text-white' : 'text-black'
                }`}>
                  {t('brand.logo_text')}
                </span>
              </Link>

              {/* Desktop: 4 equal tabs with spring underline */}
              <nav className="hidden md:flex items-center" aria-label="Main navigation">
                <AnimatePresence>
                  {PRIMARY_NAV.filter(item => item.id !== 'portfolio' || isConnected).map((item) => (
                    <motion.button
                      key={item.id}
                      layout={!reduced}
                      initial={item.id === 'portfolio' ? { opacity: 0, y: -12, filter: 'blur(4px)' } : false}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                      transition={reduced ? { duration: 0 } : springs.entrance}
                      onClick={() => { const h = navHref(item); if (h) router.push(h) }}
                      aria-current={activePage === item.id ? 'page' : undefined}
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
                    </motion.button>
                  ))}
                </AnimatePresence>
              </nav>

              {/* Right side, Links + Balance + Wallet + Hamburger */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="hidden sm:block">
                  <LanguageSwitcher variant={isDark ? 'dark' : 'light'} />
                </div>

                {/* Wallet controls, handles both connected and disconnected states */}
                {hasWeb3 && (
                  <WalletControls isDark={isDark} />
                )}

                {/* Hamburger, spring-animated lines → X, mobile only */}
                <div className="relative md:hidden">
                  <button
                    className={`p-3 -m-1 transition-colors ${
                      isDark ? 'text-zinc-400 hover:text-white' : 'text-text-muted hover:text-text-primary'
                    }`}
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label={t('aria.toggle_menu')}
                    aria-expanded={mobileMenuOpen}
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

                  {/* Overflow panel, spring entrance */}
                  <AnimatePresence>
                    {mobileMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={reduced ? { duration: 0 } : springs.entrance}
                        role="navigation"
                        aria-label="Mobile navigation"
                        className={`absolute right-0 top-full mt-2 w-64 rounded-2xl py-2 z-50 origin-top-right ${
                          isDark
                            ? 'glass-popover-dark'
                            : 'glass-popover'
                        }`}
                      >
                        {/* Primary navigation (mirrors desktop tabs) */}
                        <div className={`px-2 py-1.5 mb-1 border-b ${isDark ? 'border-white/10' : 'border-border-light'}`}>
                          {PRIMARY_NAV.filter(item => item.id !== 'portfolio' || isConnected).map((item) => {
                            const href = navHref(item)
                            if (!href) return null
                            const active = activePage === item.id
                            return (
                              <Link
                                key={item.id}
                                href={href}
                                onClick={() => setMobileMenuOpen(false)}
                                aria-current={active ? 'page' : undefined}
                                className={`block px-2 py-2 text-caption font-semibold rounded transition-colors ${
                                  active
                                    ? isDark
                                      ? 'text-white bg-white/10'
                                      : 'text-black bg-surface'
                                    : isDark
                                      ? 'text-zinc-300 hover:text-white hover:bg-white/10'
                                      : 'text-text-secondary hover:text-black hover:bg-surface'
                                }`}
                              >
                                {t(item.labelKey)}
                              </Link>
                            )
                          })}
                        </div>

                        {[
                          { href: 'https://discord.gg/xsfgzwR6', label: t('footer.discord'), external: true },
                          { href: '/docs', label: t('footer.docs'), external: false },
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

        </header>

        {/* Section nav removed, lives in HomeClient as Morpho-style sidebar */}
      </div>
    </>
  )
}
