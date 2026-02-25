'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { truncateAddress } from '@/lib/utils/address'
import { indexL3 } from '@/lib/wagmi'
import { usePostHogTracker } from '@/hooks/usePostHog'

export function Header() {
  const t = useTranslations('common')
  const pathname = usePathname()
  const isVision = pathname === '/' || pathname.startsWith('/source/')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const INVESTMENT_NAV = [
    { id: 'markets', label: t('nav.markets') },
    { id: 'portfolio', label: t('nav.portfolio') },
    { id: 'create', label: t('nav.create') },
    { id: 'lend', label: t('nav.lend') },
    { id: 'backtest', label: t('nav.backtest') },
    { id: 'system', label: t('nav.system') },
  ]

  const VISION_NAV = [
    { id: 'vision', label: t('nav.vision_nav') },
    { id: 'leaderboard', label: t('nav.leaderboard') },
    { id: 'markets-data', label: t('nav.markets_data') },
  ]

  const { capture, identify, reset: resetPostHog } = usePostHogTracker()
  const [activeSection, setActiveSection] = useState(isVision ? 'vision' : 'markets')

  // Wallet
  const [mounted, setMounted] = useState(false)
  const { address, isConnected, isConnecting, isReconnecting } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const injectedConnector = connectors.find(c => c.id === 'injected')
  const isWrongNetwork = isConnected && chainId !== indexL3.id
  const isLoading = isConnecting || isReconnecting || isPending

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (isConnected && isWrongNetwork && !isSwitching) {
      switchChain({ chainId: indexL3.id })
    }
  }, [isConnected, isWrongNetwork, isSwitching, switchChain])

  useEffect(() => {
    if (isConnected && address) {
      identify(address, { wallet_type: injectedConnector?.name || 'injected', chain_id: chainId })
      capture('wallet_connected', { wallet_address: address, chain_id: chainId })
    }
  }, [isConnected, address])

  const handleConnect = async () => {
    if (!injectedConnector) return
    capture('wallet_connect_clicked', { source: 'header' })
    const chainIdHex = `0x${indexL3.id.toString(16)}`
    if (typeof window !== 'undefined' && window.ethereum) {
      try { await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: chainIdHex, chainName: indexL3.name, nativeCurrency: indexL3.nativeCurrency, rpcUrls: [indexL3.rpcUrls.default.http[0]] }] }) } catch {}
      try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] }) } catch {}
    }
    connect({ connector: injectedConnector, chainId: indexL3.id })
  }

  const handleDisconnect = () => { capture('wallet_disconnected'); resetPostHog(); disconnect() }

  const navLinks = isVision ? VISION_NAV : INVESTMENT_NAV

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-40% 0px -50% 0px' }
    )

    for (const link of navLinks) {
      const el = document.getElementById(link.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [navLinks])

  const scrollTo = (id: string) => {
    capture('section_scrolled_to', { section_name: id })
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenuOpen(false)
  }

  return (
    <>
      {/* Topbar — thin black strip (scrolls away) */}
      <div className="bg-black text-white text-[11px] font-medium tracking-[0.02em] text-center py-1.5">
        {t('brand.topbar')}
      </div>

      <div className="sticky top-0 z-50">
      {/* Primary Header — Logo + Investment/Vision + Support + Wallet */}
      <header className="bg-white border-b border-border-light">
        <div className="px-6 lg:px-12">
          <div className="max-w-site mx-auto flex items-center justify-between h-16">
            {/* Logo */}
            <div className="shrink-0 flex items-center gap-2.5">
              <img
                src="/favicon-32x32.png"
                alt=""
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-[22px] font-black tracking-[-0.03em] text-black">
                {t('brand.logo_text')}
              </span>
            </div>

            {/* Page Tabs */}
            <nav className="hidden sm:flex items-center gap-0">
              <Link
                href="/index"
                className={`px-6 py-5 text-[15px] font-semibold transition-all border-b-[3px] ${
                  !isVision
                    ? 'text-black border-black'
                    : 'text-text-secondary border-transparent hover:text-black'
                }`}
              >
                {t('nav.investment')}
              </Link>
              <Link
                href="/"
                className={`px-6 py-5 text-[15px] font-semibold transition-all border-b-[3px] ${
                  isVision
                    ? 'text-black border-black'
                    : 'text-text-secondary border-transparent hover:text-black'
                }`}
              >
                {t('nav.vision')}
              </Link>
            </nav>

            {/* Right side — Wallet + Hamburger */}
            <div className="flex items-center gap-3 shrink-0">
              {mounted && isConnected && address ? (
                <button
                  onClick={handleDisconnect}
                  className="group px-3 py-2 bg-muted border border-border-medium text-text-primary text-sm font-mono rounded-lg transition-all hover:bg-red-950/20 hover:border-red-400/30 hover:text-red-400"
                >
                  <span className="group-hover:hidden">{truncateAddress(address)}</span>
                  <span className="hidden group-hover:inline">{t('actions.disconnect')}</span>
                </button>
              ) : mounted && isWrongNetwork ? (
                <button
                  onClick={() => switchChain({ chainId: indexL3.id })}
                  disabled={isSwitching}
                  className="px-4 py-2 bg-surface-warning border border-color-warning/30 text-color-warning text-sm font-medium rounded-lg hover:bg-color-warning hover:text-white transition-colors disabled:opacity-50"
                >
                  {isSwitching ? t('wallet.switching') : t('wallet.switch_network')}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleConnect}
                    disabled={isLoading || !injectedConnector}
                    className="hidden sm:inline-flex items-center px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? t('wallet.connecting') : t('wallet.login')}
                  </button>
                  <button
                    onClick={handleConnect}
                    disabled={isLoading || !injectedConnector}
                    className="hidden sm:inline-flex items-center px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? t('wallet.connecting') : 'Sign Up'}
                  </button>
                </>
              )}
              {/* Hamburger */}
              <div className="relative">
                <button
                  className="p-2 text-text-muted hover:text-text-primary"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label={t('aria.toggle_menu')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    {mobileMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>

                {/* Small dropdown */}
                {mobileMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg border border-border-light shadow-lg py-2 z-50">
                    {/* Page tabs */}
                    <div className="px-3 pb-2 mb-1 border-b border-border-light flex gap-2">
                      <Link
                        href="/index"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-2.5 py-1 text-[12px] font-semibold rounded ${!isVision ? 'bg-black text-white' : 'text-text-secondary'}`}
                      >
                        {t('nav.investment')}
                      </Link>
                      <Link
                        href="/"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-2.5 py-1 text-[12px] font-semibold rounded ${isVision ? 'bg-black text-white' : 'text-text-secondary'}`}
                      >
                        {t('nav.vision')}
                      </Link>
                    </div>

                    <a href="/docs" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-1.5 text-[13px] text-text-secondary hover:text-black hover:bg-surface transition-colors">{t('footer.docs')}</a>
                    <a href="https://discord.gg/xsfgzwR6" target="_blank" rel="noopener noreferrer" className="block px-3 py-1.5 text-[13px] text-text-secondary hover:text-black hover:bg-surface transition-colors">{t('footer.discord')}</a>
                    <Link href="/privacy" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-1.5 text-[13px] text-text-secondary hover:text-black hover:bg-surface transition-colors">{t('footer.privacy_policy')}</Link>
                    <Link href="/terms" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-1.5 text-[13px] text-text-secondary hover:text-black hover:bg-surface transition-colors">{t('footer.terms_of_service')}</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sub Header — Section Navigation (only for Investment pages) */}
      {!isVision && (
      <nav className="bg-white border-b border-border-light">
        <div className="px-6 lg:px-12">
          <div className="max-w-site mx-auto hidden md:flex items-center gap-1 h-11">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className={`px-4 py-2 text-[13px] font-medium rounded transition-all ${
                  activeSection === link.id
                    ? 'text-black bg-surface font-semibold'
                    : 'text-text-secondary hover:text-black hover:bg-surface'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
      )}

    </div>
    </>
  )
}
