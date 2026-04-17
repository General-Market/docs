'use client'

import { useTranslations } from 'next-intl'
import { APBalanceCard } from './APBalanceCard'

interface APBalanceSectionProps {
  expanded: boolean
  onToggle: () => void
}

export function APBalanceSection({ expanded, onToggle }: APBalanceSectionProps) {
  const t = useTranslations('system')
  return (
    <div>
      {!expanded && (
        <button
          onClick={onToggle}
          className="w-full bg-card rounded-xl shadow-card border border-border-light p-4 flex justify-between items-center text-left hover:shadow-card-hover transition-shadow"
        >
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{t('ap_section.title')}</h2>
            <p className="text-sm text-text-secondary">{t('ap_section.description')}</p>
          </div>
          <span className="text-text-muted text-2xl">+</span>
        </button>
      )}

      {expanded && (
        <div>
          <APBalanceCard />
        </div>
      )}
    </div>
  )
}
