'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/routing'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { springs } from '@/components/ui/spring'
import { useWeb3Available } from '@/lib/contexts/Web3Context'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { LanguageSwitcher } from './LanguageSwitcher'
import dynamic from 'next/dynamic'

const WalletControls = dynamic(() => import('./WalletControls').then(m => ({ default: m.WalletControls })), {
  ssr: false,
  loading: () => (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded border border-zinc-300 text-zinc-400">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
      ...
    </span>
  ),
})

// ── Navigation ────────────────────────────────────────────
const PRIMARY_NAV = [
  { id: 'index',    href: '/index',    labelKey: 'nav.investment' },
  { id: 'vision',   href: '/',         labelKey: 'nav.vision' },
] as const

type PageId = typeof PRIMARY_NAV[number]['id']

// Pages whose mood darkens the header
const DARK_PAGES = new Set<string>(['vision'])

function resolveActivePage(pathname: string): PageId | null {
  if (pathname === '/index' || pathname.startsWith('/index/')) return 'index'
  if (pathname === '/' || pathname.startsWith('/source/') || pathname.startsWith('/profile/')) return 'vision'
  return null
}

export function Header() {
  const t = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const reduced = useReducedMotion()

  const activePage = resolveActivePage(pathname)
  const isDark = activePage !== null && DARK_PAGES.has(activePage)
  const showVisionBalance = activePage === 'vision'

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const hasWeb3 = useWeb3Available()

  // ── PostHog ─────────────────────────────────────────────
  const { capture } = usePostHogTracker()

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
                  className="w-9 h-9"
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
              </nav>

              {/* Right side — Links + Balance + Wallet + Hamburger */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="hidden sm:block">
                  <LanguageSwitcher variant={isDark ? 'dark' : 'light'} />
                </div>

                {/* Wallet controls — only rendered when Web3 providers are available */}
                {hasWeb3 ? (
                  <WalletControls isDark={isDark} showVisionBalance={showVisionBalance} />
                ) : (
                  <Link
                    href="/"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold tracking-[0.01em] rounded transition-all duration-200 border ${
                      isDark
                        ? 'border-white/20 text-white hover:bg-white/10'
                        : 'border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {t('wallet.login')}
                  </Link>
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
                            ? 'glass-popover-dark'
                            : 'glass-popover'
                        }`}
                      >
                        {/* Section scroll-to links (contextual) */}
                        {sectionNav && (
                          <div className={`px-2 py-1.5 mb-1 border-b ${isDark ? 'border-white/10' : 'border-border-light'}`}>
                            <div className={`px-1 mb-1 text-micro font-semibold uppercase tracking-[0.08em] ${isDark ? 'text-zinc-500' : 'text-text-muted'}`}>
                              {t('nav.sections')}
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
                          { href: 'https://discord.gg/xsfgzwR6', label: t('footer.discord'), external: true },
                          { href: 'https://docs.generalmarket.io', label: t('footer.docs'), external: true },
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
