'use client'

//
// TODO: Bot trading notice banner
// See: architecture-change-asymmetric-odds.md
//
// This component informs users that all trading is performed by AI agents.
// Added as part of Story 7-13: Remove Bet Placement UI
//

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

const STORAGE_KEY = 'gm-bot-notice-dismissed'

interface BotTradingNoticeProps {
  /** Additional CSS classes */
  className?: string
  /** Whether the notice can be dismissed */
  dismissible?: boolean
}

/**
 * BotTradingNotice component
 *
 * Displays a notice explaining that all trading on General Market
 * is performed by autonomous AI agents, not via manual user input.
 *
 * AC5: Add explanatory UI informing users about bot-driven trading
 */
export function BotTradingNotice({ className = '', dismissible = false }: BotTradingNoticeProps) {
  const t = useTranslations('common')
  const [isDismissed, setIsDismissed] = useState(false)

  // Load persisted dismissal state on mount
  useEffect(() => {
    if (dismissible && typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(STORAGE_KEY)
      if (dismissed === 'true') {
        setIsDismissed(true)
      }
    }
  }, [dismissible])

  const handleDismiss = () => {
    setIsDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
  }

  if (isDismissed) return null

  return (
    <div className={`bg-muted border border-border-light rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        {/* Info icon */}
        <svg
          className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-text-primary font-mono">{t('bot_notice.title')}</h3>
          <p className="text-sm text-text-muted mt-1">
            {t('bot_notice.description')}
          </p>
          <a
            href="/docs"
            className="inline-flex items-center gap-1 text-sm text-color-info hover:text-color-info/80 mt-2 transition-colors"
          >
            {t('bot_notice.learn_more')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* Dismiss button (optional) */}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="text-text-muted hover:text-text-primary transition-colors p-1"
            aria-label={t('bot_notice.dismiss')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Compact version for inline use in bet lists
 */
export function BotTradingNoticeBadge({ className = '' }: { className?: string }) {
  const t = useTranslations('common')
  return (
    <div className={`inline-flex items-center gap-1.5 text-xs text-text-muted font-mono ${className}`}>
      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
      {t('bot_notice.badge')}
    </div>
  )
}
