'use client'

import { useState, Suspense } from 'react'
import { useBatches, type BatchInfo } from '@/hooks/p2pool/useBatches'
import { BatchCard } from './BatchCard'
import { ExpandedBatch } from './ExpandedBatch'
import { CreateBatchModal } from './CreateBatchModal'
import { LeaderboardSection } from '@/components/domain/vision/LeaderboardSection'
import { LeaderboardSkeleton } from '@/components/domain/vision/LeaderboardSkeleton'
import { VisionMarketsGrid } from '@/components/domain/vision/VisionMarketsGrid'

export function P2PoolPage() {
  const { data: batches, isLoading } = useBatches()
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <div className="flex-1">
      {/* P2Pool Section */}
      <section id="p2pool">
        <div className="px-6 lg:px-12">
          <div className="max-w-site-wide mx-auto py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">Prediction Markets</p>
                <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">VISION</h2>
                <p className="text-[14px] text-text-secondary mt-1.5">
                  {batches?.length || 0} live &middot; sealed parimutuel prediction markets
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-terminal text-text-inverse px-4 py-2 rounded-card text-sm font-bold
                                 hover:opacity-90 transition-opacity"
              >
                + CREATE BATCH
              </button>
            </div>

            {/* Cards grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-32 bg-surface rounded-card animate-pulse" />
                ))}
              </div>
            ) : batches && batches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {batches.map((batch: BatchInfo) => (
                  <div key={batch.id}>
                    <BatchCard
                      batch={batch}
                      onClick={() => setExpandedBatchId(
                        expandedBatchId === batch.id ? null : batch.id
                      )}
                    />
                    {expandedBatchId === batch.id && (
                      <div className="mt-2 p-4 bg-surface border border-border-medium rounded-card">
                        <ExpandedBatch batchId={batch.id} batch={batch} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-text-muted font-mono text-sm">No active batches</p>
                <p className="text-text-muted font-mono text-xs mt-1">Create a batch to get started</p>
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
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">AI Agents</p>
              <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">Leaderboard</h2>
              <p className="text-[14px] text-text-secondary mt-1.5">Autonomous agent rankings — P&L, win rate, portfolio complexity, and real-time performance.</p>
            </div>
            <Suspense fallback={<LeaderboardSkeleton />}>
              <LeaderboardSection />
            </Suspense>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Markets Data */}
      <section id="markets-data">
        <div className="px-6 lg:px-12">
          <div className="max-w-site mx-auto">
            <div className="pt-10">
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">Data Coverage</p>
              <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">Markets</h2>
              <p className="text-[14px] text-text-secondary mt-1.5">Live pricing across 50,000+ assets — crypto, stocks, DeFi, commodities, weather, and prediction markets.</p>
            </div>
            <div className="border border-border-light overflow-hidden">
              <VisionMarketsGrid />
            </div>
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
