'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { useBatches, type BatchInfo } from '@/hooks/vision/useBatches'
import { useSettlementSSE } from '@/hooks/vision/useSettlementSSE'
import { BatchCard } from './BatchCard'
import { CreateBatchModal } from './CreateBatchModal'
import { Leaderboard } from './Leaderboard'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { GeneralLoader } from '@/components/ui/GeneralLoader'

export function VisionPage() {
  const t = useTranslations('vision')
  const { capture } = usePostHogTracker()
  const { data: batches, isLoading } = useBatches()
  useSettlementSSE() // invalidates batch + leaderboard queries on settlement events
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    capture('vision_page_viewed')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1">
      {/* Vision Section */}
      <section id="vision" className="px-6 lg:px-12 py-12">
        <div className="max-w-site mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <p className="text-label font-semibold tracking-[0.08em] uppercase text-brand mb-1.5">{t('heading.label')}</p>
                <h2 className="text-display font-black tracking-tight text-black leading-[1.1]">{t('heading.title')}</h2>
                <p className="text-body text-text-secondary mt-1.5">
                  {t('heading.description', { count: batches?.length || 0 })}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-brand text-white px-4 py-2 rounded-card text-sm font-bold
                                 hover:bg-brand-dark transition-colors shrink-0 self-start sm:self-auto fluid-press"
              >
                {t('actions.create_batch')}
              </button>
            </div>

            {/* Cards grid */}
            {isLoading ? (
              <GeneralLoader height={320} />
            ) : batches && batches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
                {batches.map((batch: BatchInfo) => (
                  <div key={batch.id} className="animate-fade-up">
                    <BatchCard batch={batch} onClick={() => {}} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={t('empty.no_active_batches')}
                description={t('empty.create_to_start')}
                icon="bets"
                action={
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-brand text-white px-4 py-2 rounded-card text-sm font-bold hover:bg-brand-dark transition-colors fluid-press"
                  >
                    {t('actions.create_batch')}
                  </button>
                }
              />
            )}
        </div>
      </section>

      <div className="section-divider" />

      {/* Leaderboard */}
      <section id="leaderboard" className="px-6 lg:px-12 pt-6 pb-12">
        <div className="max-w-site mx-auto">
          <p className="text-label font-semibold tracking-[0.08em] uppercase text-brand mb-1.5">{t('leaderboard.label')}</p>
          <h3 className="text-title font-bold tracking-tight text-black leading-[1.1]">{t('leaderboard.title')}</h3>
          <p className="text-body text-text-secondary mt-1.5">{t('leaderboard.description')}</p>
          <ErrorBoundary fallback={<div className="py-8 text-center text-text-muted font-mono text-sm">{t('vision_page.leaderboard_unavailable')}</div>}>
            <div className="mt-4">
              <Leaderboard variant="compact" initialPageSize={10} viewAllHref="/leaderboard" />
            </div>
          </ErrorBoundary>
        </div>
      </section>

      {/* Create Batch Modal */}
      {showCreateModal && (
        <CreateBatchModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}
