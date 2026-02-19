'use client'

import { useState } from 'react'
import Image from 'next/image'
import { WalletConnectButton } from '@/components/domain/WalletConnectButton'

type Tab = 'markets' | 'portfolio' | 'create' | 'lend' | 'backtest' | 'system'

const TABS: { id: Tab; label: string }[] = [
  { id: 'markets', label: 'Markets' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'create', label: 'Create' },
  { id: 'lend', label: 'Lend' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'system', label: 'System' },
]

interface HeaderProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-page border-b border-border-dark">
      <div className="max-w-site mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <Image src="/logo.svg" alt="General Market" width={28} height={28} />
            <span className="text-text-inverse font-semibold text-lg tracking-tight hidden sm:inline">
              General Market
            </span>
          </div>

          {/* Desktop Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'text-text-inverse bg-white/10'
                    : 'text-text-inverse-muted hover:text-text-inverse hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            <WalletConnectButton />
            <button
              className="md:hidden p-2 text-text-inverse-muted hover:text-text-inverse"
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

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-4 border-t border-border-dark pt-4 space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { onTabChange(tab.id); setMobileMenuOpen(false) }}
                className={`block w-full text-left px-3 py-2 text-sm font-medium rounded-lg ${
                  activeTab === tab.id
                    ? 'text-text-inverse bg-white/10'
                    : 'text-text-inverse-muted hover:text-text-inverse'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}
