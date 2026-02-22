'use client'

import { useState, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { useBatches, type BatchInfo } from '@/hooks/p2pool/useBatches'
import { BatchCard } from './BatchCard'
import { ExpandedBatch } from './ExpandedBatch'
import { CreateBatchModal } from './CreateBatchModal'
import { MyPositions } from './MyPositions'
import { LeaderboardWrapper } from '@/components/domain/LeaderboardWrapper'
import { LeaderboardSkeleton } from '@/components/domain/LeaderboardSkeleton'

export function P2PoolPage() {
  const t = useTranslations('p2pool')
  const { data: batches, isLoading } = useBatches()
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <div className="flex-1">
      {/* P2Pool Section */}
      <section id="p2pool">
        <div className="px-6 lg:px-12">
          <div className="max-w-site mx-auto py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">{t('heading.label')}</p>
                <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">{t('heading.title')}</h2>
                <p className="text-[14px] text-text-secondary mt-1.5">
                  {t('heading.description', { count: batches?.length || 0 })}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-terminal text-text-inverse px-4 py-2 rounded-card text-sm font-bold
                                 hover:opacity-90 transition-opacity"
              >
                {t('actions.create_batch')}
              </button>
            </div>

            {/* My Positions (visible when wallet connected + has positions) */}
            <MyPositions onSelectBatch={(id) => setExpandedBatchId(id)} />

            {/* Cards grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-32 bg-surface rounded-card animate-pulse" />
                ))}
              </div>
            ) : batches && batches.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {batches.map((batch: BatchInfo) => (
                    <BatchCard
                      key={batch.id}
                      batch={batch}
                      onClick={() => setExpandedBatchId(
                        expandedBatchId === batch.id ? null : batch.id
                      )}
                    />
                  ))}
                </div>
                {expandedBatchId !== null && batches.find(b => b.id === expandedBatchId) && (
                  <div className="mt-4 p-4 bg-surface border border-border-medium rounded-card">
                    <ExpandedBatch
                      batchId={expandedBatchId}
                      batch={batches.find(b => b.id === expandedBatchId)!}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-text-muted font-mono text-sm">{t('empty.no_active_batches')}</p>
                <p className="text-text-muted font-mono text-xs mt-1">{t('empty.create_to_start')}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Leaderboard */}
      <section id="leaderboard">
        <div className="px-6 lg:px-12">
          <div className="max-w-site mx-auto">
            <div className="pt-10">
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">{t('leaderboard.label')}</p>
              <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">{t('leaderboard.title')}</h2>
              <p className="text-[14px] text-text-secondary mt-1.5">{t('leaderboard.description')}</p>
            </div>
            <Suspense fallback={<LeaderboardSkeleton />}>
              <LeaderboardWrapper />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Create Batch Modal */}
      {showCreateModal && (
        <CreateBatchModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}
