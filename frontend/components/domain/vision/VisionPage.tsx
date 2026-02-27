'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { useBatches, type BatchInfo } from '@/hooks/vision/useBatches'
import { useVisionBalance } from '@/hooks/vision/useVisionBalance'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'
import { BatchCard } from './BatchCard'
import { ExpandedBatch } from './ExpandedBatch'
import { CreateBatchModal } from './CreateBatchModal'
import { MyPositions } from './MyPositions'
import { VisionLeaderboard } from './VisionLeaderboard'

export function VisionPage() {
  const t = useTranslations('vision')
  const { capture } = usePostHogTracker()
  const { isConnected } = useAccount()
  const { data: batches, isLoading } = useBatches()
  const { realBalance, virtualBalance, total, isLoading: balanceLoading } = useVisionBalance()
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    capture('vision_page_viewed')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fmtBal = (v: bigint) => parseFloat(formatUnits(v, VISION_USDC_DECIMALS)).toFixed(2)

  return (
    <div className="flex-1">
      {/* Vision Section */}
      <section id="vision">
        <div className="px-6 lg:px-12">
          <div className="max-w-site mx-auto py-8">
            {/* Balance bar (visible when wallet connected) */}
            {isConnected && !balanceLoading && total > 0n && (
              <div className="mb-6 flex items-center justify-between bg-card border border-border-light rounded-card px-5 py-3">
                <div>
                  <p className="text-sm font-bold text-text-primary">
                    Balance: {fmtBal(total)} USDC
                  </p>
                  <p className="text-[10px] text-text-muted font-mono">
                    L3: {fmtBal(realBalance)}  &middot;  Arb-backed: {fmtBal(virtualBalance)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href="#deposit"
                    className="px-3 py-1.5 bg-color-up text-white text-xs font-bold rounded-card hover:opacity-90 transition-opacity"
                  >
                    DEPOSIT
                  </a>
                  <a
                    href="#withdraw"
                    className="px-3 py-1.5 bg-muted text-text-secondary text-xs font-bold rounded-card border border-border-light hover:bg-surface transition-colors"
                  >
                    WITHDRAW
                  </a>
                </div>
              </div>
            )}

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
            <VisionLeaderboard />
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
