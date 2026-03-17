'use client'

import { useState, useEffect } from 'react'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useTranslations } from 'next-intl'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { useBatches, type BatchInfo } from '@/hooks/vision/useBatches'
import { BatchCard } from './BatchCard'
import { ExpandedBatch } from './ExpandedBatch'
import { CreateBatchModal } from './CreateBatchModal'
import { MyPositions } from './MyPositions'
import { VisionLeaderboard } from './VisionLeaderboard'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { PageSection } from '@/components/layout/PageSection'

export function VisionPage() {
  const t = useTranslations('vision')
  const { capture } = usePostHogTracker()
  const { data: batches, isLoading } = useBatches()
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const revealRef = useScrollReveal()

  useEffect(() => {
    capture('vision_page_viewed')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1" ref={revealRef}>
      {/* Vision Section */}
      <PageSection id="vision" as="div" className="py-section">
        <div data-fade-in>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <p className="text-label font-semibold tracking-[0.08em] uppercase text-brand mb-1.5">{t('heading.label')}</p>
                <h2 className="text-display font-black tracking-tight text-black leading-[1.1] animate-hero-in">{t('heading.title')}</h2>
                <p className="text-body text-text-secondary mt-1.5">
                  {t('heading.description', { count: batches?.length || 0 })}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-brand text-white px-4 py-2 rounded-card text-sm font-bold
                                 hover:bg-brand-dark transition-colors shrink-0 self-start sm:self-auto press"
              >
                {t('actions.create_batch')}
              </button>
            </div>

            {/* My Positions (visible when wallet connected + has positions) */}
            <ErrorBoundary fallback={null}>
              <MyPositions onSelectBatch={(id) => setExpandedBatchId(id)} />
            </ErrorBoundary>

            {/* Cards grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-32 bg-surface rounded-card animate-pulse" />
                ))}
              </div>
            ) : batches && batches.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
                  {batches.map((batch: BatchInfo) => (
                    <div key={batch.id} className="animate-fade-up">
                      <BatchCard
                        batch={batch}
                        onClick={() => setExpandedBatchId(
                          expandedBatchId === batch.id ? null : batch.id
                        )}
                      />
                    </div>
                  ))}
                </div>
                {expandedBatchId !== null && batches.find(b => b.id === expandedBatchId) && (
                  <div key={expandedBatchId} className="mt-4 p-4 bg-surface border border-border-medium rounded-card animate-batch-reveal">
                    <ErrorBoundary fallback={<div className="py-6 text-center text-text-muted font-mono text-sm">Batch details failed to load. Try collapsing and re-expanding.</div>}>
                      <ExpandedBatch
                        batchId={expandedBatchId}
                        batch={batches.find(b => b.id === expandedBatchId)!}
                      />
                    </ErrorBoundary>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                title={t('empty.no_active_batches')}
                description={t('empty.create_to_start')}
                icon="bets"
                action={
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-brand text-white px-4 py-2 rounded-card text-sm font-bold hover:bg-brand-dark transition-colors press"
                  >
                    {t('actions.create_batch')}
                  </button>
                }
              />
            )}
        </div>
      </PageSection>

      <div className="section-divider" />

      {/* Leaderboard */}
      <PageSection id="leaderboard" as="div" className="pt-block-sm pb-section">
        <div data-fade-in style={{ '--stagger-delay': 1 } as React.CSSProperties}>
          <p className="text-label font-semibold tracking-[0.08em] uppercase text-brand mb-1.5">{t('leaderboard.label')}</p>
          <h3 className="text-title font-bold tracking-tight text-black leading-[1.1] animate-hero-in">{t('leaderboard.title')}</h3>
          <p className="text-body text-text-secondary mt-1.5">{t('leaderboard.description')}</p>
          <ErrorBoundary fallback={<div className="py-8 text-center text-text-muted font-mono text-sm">Leaderboard unavailable.</div>}>
            <VisionLeaderboard />
          </ErrorBoundary>
        </div>
      </PageSection>

      {/* Create Batch Modal */}
      {showCreateModal && (
        <CreateBatchModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}
