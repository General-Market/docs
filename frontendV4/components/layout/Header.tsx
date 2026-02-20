'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
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
    <div className="sticky top-0 z-50">
      {/* Primary Header — Logo + Investment / Vision + Wallet */}
      <header className="bg-white/95 backdrop-blur-md border-b border-border-light">
        <div className="max-w-site mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <Image src="/logo.svg" alt="General Market" width={28} height={28} />
              <span className="text-text-primary font-semibold text-lg tracking-tight hidden sm:inline">
                General Market
              </span>
            </div>

            {/* Page Tabs */}
            <nav className="flex items-center gap-0">
              <button
                onClick={() => onPageChange?.('investment')}
                className={`px-5 py-2 text-sm font-semibold tracking-wide transition-all border-b-2 ${
                  activePage === 'investment'
                    ? 'text-text-primary border-zinc-900'
                    : 'text-text-muted border-transparent hover:text-text-primary hover:border-zinc-300'
                }`}
              >
                Investment
              </button>
              <button
                onClick={() => onPageChange?.('vision')}
                className={`px-5 py-2 text-sm font-semibold tracking-wide transition-all border-b-2 ${
                  activePage === 'vision'
                    ? 'text-text-primary border-zinc-900'
                    : 'text-text-muted border-transparent hover:text-text-primary hover:border-zinc-300'
                }`}
              >
                Vision
              </button>
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3 shrink-0">
              <WalletConnectButton />
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

      {/* Sub Header — Section Navigation */}
      <nav className="bg-white/90 backdrop-blur-sm border-b border-border-light shadow-sm">
        <div className="max-w-site mx-auto px-6 lg:px-12">
          <div className="hidden md:flex items-center gap-1 h-10">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeSection === link.id
                    ? 'text-text-primary bg-muted'
                    : 'text-text-muted hover:text-text-primary hover:bg-muted/50'
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
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className={`block w-full text-left px-3 py-2 text-sm font-medium rounded-lg ${
                  activeSection === link.id
                    ? 'text-text-primary bg-muted'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
        )}
      </nav>
    </div>
  )
}
