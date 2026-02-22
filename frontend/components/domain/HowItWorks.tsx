'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

// Use env vars with fallback to hardcoded values
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xE44c20fbac58Eb1ca4115AC7890F28271aD94364'
const EXPLORER_BASE = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://index.explorer.zeeve.net/address'
const EXPLORER_URL = `${EXPLORER_BASE}/${CONTRACT_ADDRESS}`
const STORAGE_KEY = 'gm-how-it-works-collapsed'

/**
 * Step keys for translation lookup
 */
const STEP_KEYS = [1, 2, 3] as const

/**
 * HowItWorks component (Story 11-1, AC7)
 * Collapsible three-step explainer section
 *
 * - BET → MATCH → RESOLVE flow
 * - Trust statement at bottom
 * - Contract explorer link
 * - Collapsed by default, remembers state in localStorage
 */
export function HowItWorks() {
  const t = useTranslations('common')
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setIsCollapsed(stored === 'true')
    }
    setIsHydrated(true)
  }, [])

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newValue = !isCollapsed
    setIsCollapsed(newValue)
    localStorage.setItem(STORAGE_KEY, String(newValue))
  }

  // Don't render during SSR to avoid hydration mismatch
  if (!isHydrated) {
    return (
      <section
        id="how-it-works"
        className="border border-border-light bg-card rounded-xl shadow-card"
        aria-labelledby="how-it-works-heading"
      >
        <button
          className="w-full flex justify-between items-center p-4 text-left"
          disabled
        >
          <h2 id="how-it-works-heading" className="text-lg font-bold text-text-primary">
            {t('how_it_works.title')}
          </h2>
          <span className="text-text-muted">▾</span>
        </button>
      </section>
    )
  }

  return (
    <section
      id="how-it-works"
      className="border border-border-light bg-card rounded-xl shadow-card"
      aria-labelledby="how-it-works-heading"
    >
      {/* Header - always visible, acts as toggle */}
      <button
        type="button"
        className="w-full flex justify-between items-center p-4 text-left hover:bg-card-hover transition-colors rounded-t-xl"
        onClick={toggleCollapsed}
        aria-expanded={!isCollapsed}
        aria-controls="how-it-works-content"
      >
        <h2 id="how-it-works-heading" className="text-lg font-bold text-text-primary">
          HOW AGIARENA WORKS
        </h2>
        <span className="text-text-muted text-xl" aria-hidden="true">
          {isCollapsed ? '▸' : '▾'}
        </span>
      </button>

      {/* Content - collapsible */}
      {!isCollapsed && (
        <div
          id="how-it-works-content"
          className="border-t border-border-light p-6"
        >
          {/* Three-step flow */}
          <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8 mb-8">
            {STEP_KEYS.map((num, index) => (
              <div key={num} className="flex items-center">
                {/* Step card */}
                <div className="text-center w-40">
                  <div className="border border-border-medium rounded-xl p-4 mb-2">
                    <div className="text-3xl text-zinc-900 font-bold mb-1">{num}</div>
                    <div className="text-lg font-bold text-text-primary">{t(`how_it_works.step${num}_title`)}</div>
                  </div>
                  <div className="text-sm text-text-muted">{t(`how_it_works.step${num}_subtitle`)}</div>
                  <div className="text-xs text-text-muted mt-1 hidden md:block">{t(`how_it_works.step${num}_description`)}</div>
                </div>

                {/* Arrow between steps (not after last) */}
                {index < STEP_KEYS.length - 1 && (
                  <div className="text-border-medium text-2xl mx-2 hidden md:block" aria-hidden="true">→</div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile descriptions */}
          <div className="md:hidden space-y-3 mb-6">
            {STEP_KEYS.map((num) => (
              <div key={num} className="text-xs text-text-muted">
                <span className="text-zinc-900">{num}.</span> {t(`how_it_works.step${num}_description`)}
              </div>
            ))}
          </div>

          {/* Trust statement */}
          <div className="text-center border-t border-border-light pt-6">
            <p className="text-sm text-text-muted mb-2">
              {t('how_it_works.trust_statement')}
            </p>
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              {t('how_it_works.view_contract')}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
