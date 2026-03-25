'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from '@/i18n/routing'
import { useSourceSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useBatches } from '@/hooks/vision/useBatches'
import { useRounds } from '@/hooks/vision/useRounds'
import { useBitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'
import { SourceHero } from './SourceHero'
import { MarketsTable } from './MarketsTable'
import { TopPlayers } from './TopPlayers'
import BatchEntryPanel from './BatchEntryPanel'
import { PendingPositions } from './PendingPositions'
import { BatchProgressBar } from '../CountdownRing'
import type { SourceDisplayServer } from '@/lib/vision/sources-server'
import { useTranslations } from 'next-intl'
import { useAccount } from 'wagmi'
import { SourceDetailSkeleton } from '@/components/ui/VisionLoader'

function WalletSourceStats({ sourceId }: { sourceId: string }) {
  const { address } = useAccount()
  const { leaderboard } = useVisionLeaderboard(undefined, sourceId)
  const entry = useMemo(() => {
    if (!address || !leaderboard.length) return null
    return leaderboard.find(p => p.walletAddress.toLowerCase() === address.toLowerCase()) ?? null
  }, [address, leaderboard])

  if (!address || !entry) return null

  const pnlColor = entry.pnl > 0 ? 'text-green-600' : entry.pnl < 0 ? 'text-red-600' : 'text-text-muted'
  const pnlSign = entry.pnl > 0 ? '+' : ''

  return (
    <div className="mt-3 bg-black text-white px-5 py-3 flex items-center gap-8">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">Your Stats</div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">Rounds</div>
        <div className="text-[15px] font-bold font-mono">{entry.roundsPlayed}</div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">Won</div>
        <div className="text-[15px] font-bold font-mono text-green-400">{entry.roundsWon}</div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">Win Rate</div>
        <div className="text-[15px] font-bold font-mono">{entry.winRate.toFixed(1)}%</div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">Volume</div>
        <div className="text-[15px] font-bold font-mono">${entry.totalVolume.toFixed(2)}</div>
      </div>
      <div className="flex-1" />
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">P&L</div>
        <div className={`text-[18px] font-black font-mono ${pnlColor}`}>
          {pnlSign}${Math.abs(entry.pnl).toFixed(2)}
        </div>
      </div>
    </div>
  )
}

function CountdownTimer({ bettingEnd, tickDuration }: { bettingEnd: string | null; tickDuration?: number }) {
  const [remaining, setRemaining] = useState<number>(0)
  const [overdue, setOverdue] = useState<number>(0)
  useEffect(() => {
    if (!bettingEnd) return
    const update = () => {
      const diff = Math.floor((new Date(bettingEnd).getTime() - Date.now()) / 1000)
      setRemaining(Math.max(0, diff))
      setOverdue(diff < 0 ? Math.abs(diff) : 0)
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [bettingEnd])
  if (!bettingEnd) return <span className="text-text-muted font-mono">--:--</span>
  if (remaining <= 0) {
    const td = tickDuration || 300
    const eta = Math.max(0, td - overdue)
    return (
      <span className="flex items-center gap-2 text-color-warning font-mono font-black">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-color-warning opacity-50" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-color-warning" />
        </span>
        {eta > 0 ? `~${eta}s` : 'Settling'}
      </span>
    )
  }
  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  const urgent = remaining < 60
  return (
    <span className={`tabular-nums font-mono font-black ${urgent ? 'text-color-down' : ''}`}>
      {m}:{s.toString().padStart(2, '0')}
    </span>
  )
}

interface SourceDetailProps {
  sourceId: string
  initialSource?: SourceDisplayServer
}

function formatTvl(tvl: string): string {
  const raw = parseFloat(tvl)
  if (isNaN(raw) || raw === 0) return '$0'
  const num = raw / 1e18
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

export function SourceDetail({ sourceId, initialSource }: SourceDetailProps) {
  const t = useTranslations('vision')
  const router = useRouter()

  // Source registry
  const { sources, isLoading: isRegistryLoading } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)

  const source = sourceEntry
    ? {
        id: sourceEntry.sourceId,
        name: sourceEntry.name,
        description: sourceEntry.description,
        category: sourceEntry.category,
        logo: sourceEntry.logo,
        brandBg: sourceEntry.brandBg,
        prefixes: sourceEntry.prefixes,
        valueLabel: sourceEntry.valueLabel,
        valueUnit: sourceEntry.valueUnit,
        isPrice: sourceEntry.isPrice,
      }
    : initialSource
      ? {
          id: initialSource.sourceId,
          name: initialSource.name,
          description: initialSource.description,
          category: initialSource.category,
          logo: initialSource.logo,
          brandBg: initialSource.brandBg,
          prefixes: initialSource.prefixes,
          valueLabel: initialSource.valueLabel,
          valueUnit: initialSource.valueUnit,
          isPrice: initialSource.isPrice,
        }
      : null

  // Per-source snapshot for market list
  const { data: snapshotData } = useSourceSnapshot(sourceId)
  const { data: meta } = useMarketSnapshotMeta()
  const { data: batches } = useBatches()
  const { data: rounds } = useRounds(sourceId)
  const activeRound = rounds?.[0]
  const bitmapEditor = useBitmapEditor()

  // Find source schedule from meta
  const sourceSchedule = useMemo(() => {
    if (!meta?.sources) return undefined
    return meta.sources.find((s) => s.sourceId === sourceId)
  }, [meta?.sources, sourceId])

  const sourceMarkets = snapshotData?.prices ?? []
  const marketCount = sourceMarkets.length || undefined
  const marketIds = useMemo(() => sourceMarkets.map(p => p.assetId), [sourceMarkets])

  // Active batch matching this source
  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    return batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  // Bitmap counts for this source
  const counts = bitmapEditor.getCounts(sourceId, marketIds)
  const totalMarkets = marketIds.length
  const totalSet = counts.up + counts.down

  // Round status — derived from oracle status field (betting | settling)
  const isSettling = activeRound?.status === 'settling'
  const bettingOpen = activeRound?.bettingEnd
    ? new Date(activeRound.bettingEnd).getTime() > Date.now()
    : false
  const roundStatusLabel = activeRound
    ? (bettingOpen ? t('source_detail.betting_open') : 'Settling')
    : 'Waiting'

  if (isRegistryLoading && !initialSource) {
    return <SourceDetailSkeleton />
  }

  if (!source) {
    return (
      <div className="px-6 lg:px-12 py-12">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-black text-black mb-2">{t('source_detail.source_not_found')}</h1>
          <p className="text-text-secondary mb-4">
            {t('source_detail.source_not_found_description', { sourceId })}
          </p>
          <button
            onClick={() => router.push('/')}
            className="text-[13px] font-bold text-black underline hover:no-underline"
          >
            {t('common_labels.back_to_sources')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 lg:px-12 py-6">
      <div className="max-w-site mx-auto">
        {/* Source Hero */}
        <SourceHero source={source} sourceSchedule={sourceSchedule} marketCount={marketCount} tickRemaining={0} tickDuration={0} sourceId={sourceId} urgency={'normal'} />

        {/* Batch bar — round status */}
        <div className={`mt-4 border transition-colors duration-300 overflow-hidden ${
          isSettling
            ? 'bg-surface-warning/50 border-color-warning/20'
            : 'bg-[var(--surface)] border-border-light'
        }`}>
          {/* Progress bar — depletes over betting period, pulses when settling */}
          <BatchProgressBar
            bettingEnd={activeRound?.bettingEnd ?? null}
            tickDuration={activeBatch?.tickDuration ?? activeRound?.timeframeSecs ?? 300}
            isSettling={isSettling}
          />
          <div className="flex items-stretch">
            {/* Left: metadata stats */}
            <div className="flex items-center gap-5 px-5 py-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {t('source_detail.round')}
                </div>
                <div className="text-[15px] font-bold font-mono text-black">
                  {activeBatch ? `#${activeBatch.id}` : activeRound ? `#${activeRound.batchId}` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  Status
                </div>
                <div className={`text-[15px] font-bold font-mono flex items-center gap-2 ${isSettling ? 'text-color-warning' : 'text-black'}`}>
                  {isSettling && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-color-warning opacity-50" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-color-warning" />
                    </span>
                  )}
                  {activeBatch || activeRound ? roundStatusLabel : 'Waiting'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {t('source_detail.players')}
                </div>
                <div className="text-[15px] font-bold font-mono text-black">
                  {activeBatch?.playerCount ?? activeRound?.playerCount ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {t('source_detail.pool')}
                </div>
                <div className="text-[15px] font-bold font-mono text-color-up">
                  {activeBatch ? formatTvl(activeBatch.tvl) : '—'}
                </div>
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right: timer — the hero element, visually separated */}
            <div className={`flex items-center gap-5 px-5 py-3 border-l ${
              isSettling ? 'border-color-warning/20' : 'border-border-light'
            }`}>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {t('source_detail.set')}
                </div>
                <div className="text-[15px] font-bold font-mono text-color-up">
                  {totalSet}/{totalMarkets}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {isSettling ? 'Result' : 'Time Left'}
                </div>
                <div className="text-[24px] font-black font-mono text-black leading-none">
                  <CountdownTimer bettingEnd={activeRound?.bettingEnd ?? null} tickDuration={activeBatch?.tickDuration} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Connected wallet stats for this source */}
        <WalletSourceStats sourceId={sourceId} />

        {/* Pending positions — settling batches where user has a deposit */}
        {rounds && rounds.length > 0 && (
          <PendingPositions
            rounds={rounds}
            activeBatchId={activeBatch?.id}
          />
        )}

        {/* Content split */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          {/* Left: Markets + Leaderboard */}
          <div className="flex-1 min-w-0">
            <MarketsTable sourceId={sourceId} bitmapEditor={bitmapEditor} />
            <TopPlayers sourceId={sourceId} />
          </div>

          {/* Right: Batch entry panel (300px, sticky) */}
          <div className="w-full lg:w-[300px] shrink-0">
            <div className="lg:sticky lg:top-28">
              <BatchEntryPanel
                bitmapEditor={bitmapEditor}
                sourceId={sourceId}
                marketIds={marketIds}
                bettingEnd={activeRound?.bettingEnd}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
