'use client'

import { useState, useEffect } from 'react'
import { WalletConnectButton } from '@/components/domain/WalletConnectButton'

type ActivePage = 'investment' | 'vision'

const INVESTMENT_NAV = [
  { id: 'markets', label: 'Markets' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'create', label: 'Create' },
  { id: 'lend', label: 'Lend' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'system', label: 'System' },
]

const VISION_NAV = [
  { id: 'p2pool', label: 'P2Pool' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'markets-data', label: 'Markets' },
]

interface HeaderProps {
  activePage?: ActivePage
  onPageChange?: (page: ActivePage) => void
}

export function Header({ activePage = 'investment', onPageChange }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('markets')

  const navLinks = activePage === 'investment' ? INVESTMENT_NAV : VISION_NAV

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
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenuOpen(false)
  }

  return (
    <>
      {/* Topbar — thin black strip (scrolls away) */}
      <div className="bg-black text-white text-[11px] font-medium tracking-[0.02em] text-center py-1.5">
        General Market — Decentralized Index Products
      </div>

      <div className="sticky top-0 z-50">
      {/* Primary Header — Logo + Investment/Vision + Support + Wallet */}
      <header className="bg-white border-b border-border-light">
        <div className="px-6 lg:px-12">
          <div className="max-w-site mx-auto flex items-center justify-between h-16">
            {/* Logo */}
            <div className="shrink-0">
              <span className="text-[22px] font-black tracking-[-0.03em] text-black">
                General Market.
              </span>
            </div>

            {/* Page Tabs */}
            <nav className="hidden sm:flex items-center gap-0">
              <button
                onClick={() => onPageChange?.('investment')}
                className={`px-6 py-5 text-[15px] font-semibold transition-all border-b-[3px] ${
                  activePage === 'investment'
                    ? 'text-black border-black'
                    : 'text-text-secondary border-transparent hover:text-black'
                }`}
              >
                Investment
              </button>
              <button
                onClick={() => onPageChange?.('vision')}
                className={`px-6 py-5 text-[15px] font-semibold transition-all border-b-[3px] ${
                  activePage === 'vision'
                    ? 'text-black border-black'
                    : 'text-text-secondary border-transparent hover:text-black'
                }`}
              >
                Vision
              </button>
            </nav>

            {/* Right side — Support + Wallet */}
            <div className="flex items-center gap-5 shrink-0">
              <a
                href="https://discord.gg/xsfgzwR6"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline text-[13px] font-medium text-text-secondary hover:text-black transition-colors"
              >
                Support
              </a>
              <div className="hidden md:block">
                <WalletConnectButton />
              </div>
              <button
                className="md:hidden p-2 text-text-muted hover:text-text-primary"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sub Header — Section Navigation (no wallet, just nav links) */}
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

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden px-6 pb-3 space-y-1">
            {/* Mobile page tabs */}
            <div className="flex gap-2 pb-2 mb-2 border-b border-border-light">
              <button
                onClick={() => onPageChange?.('investment')}
                className={`px-3 py-1.5 text-sm font-semibold rounded ${
                  activePage === 'investment' ? 'bg-black text-white' : 'text-text-secondary'
                }`}
              >
                Investment
              </button>
              <button
                onClick={() => onPageChange?.('vision')}
                className={`px-3 py-1.5 text-sm font-semibold rounded ${
                  activePage === 'vision' ? 'bg-black text-white' : 'text-text-secondary'
                }`}
              >
                Vision
              </button>
            </div>
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className={`block w-full text-left px-3 py-2 text-sm font-medium rounded ${
                  activeSection === link.id
                    ? 'text-black bg-surface'
                    : 'text-text-secondary hover:text-black'
                }`}
              >
                {link.label}
              </button>
            ))}
            <div className="pt-2 border-t border-border-light flex items-center justify-between">
              <a
                href="https://discord.gg/xsfgzwR6"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-text-secondary hover:text-black transition-colors"
              >
                Support
              </a>
              <WalletConnectButton />
            </div>
          </div>
        )}
      </nav>
    </div>
    </>
  )
}
