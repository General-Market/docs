'use client'

import { useTranslations } from 'next-intl'
import { Leaderboard } from '@/components/domain/vision/Leaderboard'

export function TopPlayers({ sourceId }: { sourceId?: string }) {
  const t = useTranslations('vision')
  return (
    <div id="leaderboard" className="mt-6">
      <div className="section-bar">
        <div>
          <div className="section-bar-title">{t('top_players.title')}</div>
          <div className="section-bar-value">{t('top_players.subtitle')}</div>
        </div>
      </div>
      <Leaderboard
        variant="compact"
        sourceId={sourceId}
        initialPageSize={5}
        viewAllHref={sourceId ? `/source/${sourceId}/leaderboard` : '/leaderboard'}
      />
    </div>
  )
}
