'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain, useReadContract } from 'wagmi'
import { truncateAddress } from '@/lib/utils/address'
import { indexL3 } from '@/lib/wagmi'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { USDC_ADDRESS, USDC_DECIMALS } from '@/lib/contracts/addresses'
import { LanguageSwitcher } from './LanguageSwitcher'
import { VisionBalanceBar } from '@/components/domain/vision/VisionBalanceBar'

export function Header() {
  const t = useTranslations('common')
  const pathname = usePathname()
  const isVision = pathname === '/' || pathname.startsWith('/source/') || pathname === '/points'
  const isLearn = pathname.startsWith('/learn')
  const isIndex = pathname === '/index' || pathname.startsWith('/index/')
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

  const [mounted, setMounted] = useState(false)

  // Wagmi state
  const { address, isConnected } = useAccount()
  const authenticated = isConnected
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const injectedConnector = connectors.find(c => c.type === 'injected') || connectors[0]
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const isWrongNetwork = isConnected && chainId !== indexL3.id

  // USDC balance
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

  // Auto-switch to L3 only on initial wallet connect — not on every chain change.
  // CreateITP temporarily switches to Settlement for BridgeProxy tx; aggressive auto-switch kills that flow.
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

  const handleLogin = async () => {
    capture('login_clicked', { source: 'header' })
    if (injectedConnector) {
      // Try to pre-register the chain, but don't block connect if it fails
      try { await addAndSwitchChain() } catch {}
      connect({ connector: injectedConnector, chainId: indexL3.id })
    }
  }

  const handleLogout = () => {
    capture('wallet_disconnected')
    resetPostHog()
    disconnect()
  }

  const navLinks = isVision ? VISION_NAV : INVESTMENT_NAV

  const scrollTo = (id: string) => {
    capture('section_scrolled_to', { section_name: id })
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenuOpen(false)
  }

  return (
    <>
      {/* Topbar — thin black strip (scrolls away) */}
      <div className="bg-black text-white text-label font-medium text-center py-1.5">
        {t('brand.topbar')}
      </div>

      <div className="sticky top-0 z-50">
      {/* Primary Header — Logo + Investment/Vision + Support + Wallet */}
      <header className="bg-white border-b border-border-light">
        <div className="px-4 sm:px-6 lg:px-12">
          <div className="max-w-site mx-auto flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link href="/" className="shrink-0 flex items-center gap-2.5">
              <img
                src="/favicon-32x32.png"
                alt=""
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="hidden sm:inline text-title font-black tracking-tight text-black">
                {t('brand.logo_text')}
              </span>
            </Link>

            {/* Page Tabs */}
            <nav className="hidden sm:flex items-center gap-0">
              <Link
                href="/index"
                className={`px-6 py-5 text-body font-semibold transition-all duration-200 border-b-[3px] ${
                  !isVision
                    ? 'text-black border-brand font-bold'
                    : 'text-text-secondary border-transparent hover:text-black hover:border-border-medium'
                }`}
              >
                {t('nav.investment')}
              </Link>
              <Link
                href="/"
                className={`px-6 py-5 text-body font-semibold transition-all duration-200 border-b-[3px] ${
                  isVision
                    ? 'text-black border-brand font-bold'
                    : 'text-text-secondary border-transparent hover:text-black hover:border-border-medium'
                }`}
              >
                {t('nav.vision')}
              </Link>
              <div className="ml-4 hidden lg:flex items-center gap-3">
                <Link href="/explorer" className="text-caption text-text-secondary hover:text-black transition-all duration-200 hover:font-semibold">{t('nav.explorer')}</Link>
                <Link href="/points" className="text-caption text-text-secondary hover:text-black transition-all duration-200 hover:font-semibold">{t('nav.points')}</Link>
                <Link href="/about" className="text-caption text-text-secondary hover:text-black transition-all duration-200 hover:font-semibold">{t('nav.about')}</Link>
              </div>
            </nav>

            {/* Right side — Language + Balance + Wallet + Hamburger */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
              {isVision && <VisionBalanceBar />}
              {mounted && authenticated && address ? (
                <div className="flex items-center gap-2">
                  {/* USDC balance or Deposit button — hidden on Vision (VisionBalanceBar handles it) */}
                  {!isVision && (
                    usdcBalance !== null && usdcBalance > 0 ? (
                      <span className="hidden sm:inline text-caption font-bold font-mono tabular-nums text-black">
                        {usdcBalance < 0.01 ? '<0.01' : usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-text-muted font-medium ml-1">USDC</span>
                      </span>
                    ) : usdcBalance !== null ? (
                      <a
                        href={`https://onramp.money/main/buy/?appId=1&coinCode=usdc&network=${process.env.NEXT_PUBLIC_ONRAMP_NETWORK || 'sonic'}&walletAddress=${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 bg-color-up text-white text-caption font-bold rounded hover:opacity-90 transition-opacity"
                      >
                        {t('wallet.deposit')}
                      </a>
                    ) : null
                  )}
                  {/* Wallet address */}
                  <button
                    onClick={handleLogout}
                    className="group px-2 sm:px-3 py-2 bg-muted border border-border-medium text-text-primary text-sm font-mono rounded-md transition-all duration-200 hover:bg-surface-down hover:border-color-down/30 hover:text-color-down hover:shadow-sm"
                  >
                    <span className="group-hover:hidden">{truncateAddress(address)}</span>
                    <span className="hidden group-hover:inline">{t('actions.disconnect')}</span>
                  </button>
                </div>
              ) : mounted && isWrongNetwork ? (
                <button
                  onClick={() => switchChain({ chainId: indexL3.id })}
                  disabled={isSwitching}
                  className="px-3 sm:px-4 py-2 bg-surface-warning border border-color-warning/30 text-color-warning text-sm font-medium rounded-md hover:bg-color-warning hover:text-white transition-colors disabled:opacity-50"
                >
                  {isSwitching ? t('wallet.switching') : t('wallet.switch_network')}
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  className="inline-flex items-center px-3 sm:px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand-dark transition-colors"
                >
                  {t('wallet.login')}
                </button>
              )}
              {/* Hamburger — larger touch target for mobile */}
              <div className="relative lg:hidden">
                <button
                  className="p-3 -m-1 text-text-muted hover:text-text-primary"
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

                {/* Mobile dropdown */}
                {mobileMenuOpen && (
                  <div className="animate-slide-down absolute right-0 top-full mt-2 w-64 bg-white rounded-md border border-border-light shadow-modal py-2 z-50">
                    {/* Page tabs */}
                    <div className="px-3 pb-2 mb-1 border-b border-border-light flex gap-2">
                      <Link
                        href="/index"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-3 py-1.5 text-caption font-semibold rounded ${!isVision ? 'bg-black text-white' : 'text-text-secondary'}`}
                      >
                        {t('nav.investment')}
                      </Link>
                      <Link
                        href="/"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-3 py-1.5 text-caption font-semibold rounded ${isVision ? 'bg-black text-white' : 'text-text-secondary'}`}
                      >
                        {t('nav.vision')}
                      </Link>
                    </div>

                    {/* Section nav — scroll-to links (contextual) */}
                    {(isIndex || isVision) && (
                      <div className="px-2 py-1.5 mb-1 border-b border-border-light">
                        <div className="px-1 mb-1 text-micro font-semibold uppercase tracking-[0.08em] text-text-muted">
                          Sections
                        </div>
                        {navLinks.map((link) => (
                          <button
                            key={link.id}
                            onClick={() => scrollTo(link.id)}
                            className={`block w-full text-left px-2 py-2 text-caption rounded transition-colors ${
                              activeSection === link.id
                                ? 'text-black font-semibold bg-surface'
                                : 'text-text-secondary hover:text-black hover:bg-surface'
                            }`}
                          >
                            {link.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <Link href="/explorer" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-caption text-text-secondary hover:text-black hover:bg-surface transition-colors">{t('nav.explorer')}</Link>
                    <Link href="/points" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-caption text-text-secondary hover:text-black hover:bg-surface transition-colors">{t('nav.points')}</Link>
                    <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-caption text-text-secondary hover:text-black hover:bg-surface transition-colors">{t('nav.about')}</Link>
                    <a href="https://docs.generalmarket.io" target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-caption text-text-secondary hover:text-black hover:bg-surface transition-colors">{t('footer.docs')}</a>
                    <a href="https://discord.gg/xsfgzwR6" target="_blank" rel="noopener noreferrer" className="block px-3 py-2.5 text-caption text-text-secondary hover:text-black hover:bg-surface transition-colors">{t('footer.discord')}</a>
                    <Link href="/privacy" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-caption text-text-secondary hover:text-black hover:bg-surface transition-colors">{t('footer.privacy_policy')}</Link>
                    <Link href="/terms" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-caption text-text-secondary hover:text-black hover:bg-surface transition-colors">{t('footer.terms_of_service')}</Link>

                    {/* Language switcher */}
                    <div className="px-3 pt-2 mt-1 border-t border-border-light">
                      <LanguageSwitcher />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Section nav removed — now lives in HomeClient as Morpho-style sidebar */}

    </div>
    </>
  )
}
