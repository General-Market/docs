'use client'

import { useTranslations } from 'next-intl'
import type { PlayerProfile } from '@/hooks/usePlayerProfile'
import { PnlChart } from './PnlChart'
import { BatchTickHistory } from './BatchTickHistory'

interface VisionTabProps {
  profile: PlayerProfile
}

export function VisionTab({ profile }: VisionTabProps) {
  const t = useTranslations('common')

  if (profile.batches.length === 0 && profile.pnlHistory.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-caption text-text-muted">{t('profile.no_vision_history')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PnlChart history={profile.pnlHistory} />
      {profile.batches.length > 0 && (
        <div className="border border-border-light rounded overflow-hidden">
          <BatchTickHistory batches={profile.batches} />
        </div>
      )}
    </div>
  )
}
