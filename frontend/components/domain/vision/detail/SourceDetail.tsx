'use client'

import { useMemo, useRef } from 'react'
import { useSharedCountdown } from '@/hooks/useSharedCountdown'
import { useRouter } from '@/i18n/routing'
import { useSourceSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useQuery } from '@tanstack/react-query'
import type { BatchConfigResponse } from '@/hooks/vision/useBatchConfig'
import { useBatches } from '@/hooks/vision/useBatches'
import { useRounds } from '@/hooks/vision/useRounds'
import { useBitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { usePlayerPosition } from '@/hooks/vision/usePlayerPosition'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'
import { SourceHero } from './SourceHero'
import { MarketsTable } from './MarketsTable'
import { TopPlayers } from './TopPlayers'
import BatchEntryPanel from './BatchEntryPanel'
import { PendingPositions } from './PendingPositions'
import { BatchHistory } from './BatchHistory'
import { BatchProgressBar } from '../CountdownRing'
import type { SourceDisplayServer } from '@/lib/vision/sources-server'
import { useTranslations } from 'next-intl'
import { useAccount, useReadContract } from 'wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'
import { SourceDetailSkeleton } from '@/components/ui/VisionLoader'
import { FirstTradeCTA } from '../FirstTradeCTA'
import { SourceFunds } from '@/components/domain/vaults/SourceFunds'

function WalletSourceStats({ sourceId }: { sourceId: string }) {
  const { address } = useAccount()
  const { leaderboard } = useVisionLeaderboard(undefined, sourceId)
  const entry = useMemo(() => {
    if (!address || !leaderboard?.length) return null
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
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">ROI</div>
        <div className={`text-[15px] font-bold font-mono ${entry.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{entry.roi >= 0 ? '+' : ''}{entry.roi.toFixed(1)}%</div>
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

function CountdownTimer({ bettingEnd }: { bettingEnd: string | null }) {
  const remaining = useSharedCountdown(bettingEnd)
  if (!bettingEnd) return <span className="text-text-muted font-mono">--:--</span>
  if (remaining <= 0) {
    return (
      <span className="flex items-center gap-2 text-text-muted font-mono font-black">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-text-muted opacity-50" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-text-muted" />
        </span>
        New round...
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
  const bitmapEditor = useBitmapEditor()

  // Find source schedule from meta
  const sourceSchedule = useMemo(() => {
    if (!meta?.sources) return undefined
    return meta.sources.find((s) => s.sourceId === sourceId)
  }, [meta?.sources, sourceId])

  const sourceMarkets = snapshotData?.prices ?? []

  // Active batch matching this source
  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    return batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  // Verify the batch actually exists on-chain. The oracle API can report
  // stale batches that have already been settled/deleted on-chain.
  const { getAddress } = useDeployment()
  const visionAddress = getAddress('Vision')
  const { data: onChainBatch, isError: batchOnChainError, error: batchError } = useReadContract({
    address: visionAddress,
    abi: VISION_ABI,
    functionName: 'getBatch',
    args: activeBatch ? [BigInt(activeBatch.id)] : undefined,
    chainId: indexL3.id,
    query: {
      enabled: !!activeBatch && visionAddress !== '0x0000000000000000000000000000000000000000',
      retry: false,
    },
  })
  // Optimistic: show activeBatch immediately. Only hide if on-chain check
  // explicitly failed (not while still loading). This eliminates the RPC
  // waterfall from the critical render path.
  const batchRpcFailed = !!activeBatch && (batchOnChainError || batchError !== null)
  const verifiedBatch = batchRpcFailed ? null : activeBatch

  // Fetch latest batch config by sourceId — no waterfall dependency on configHash.
  // The snapshot can drift as assets become healthy/stale; the batch config cannot.
  const { data: batchConfig } = useQuery<BatchConfigResponse>({
    queryKey: ['batch-config-source', sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/vision/config/${sourceId}`)
      if (!res.ok) return { markets: [] }
      return res.json()
    },
    enabled: !!sourceId,
    staleTime: 300_000,
    retry: 1,
  })
  const marketIds = useMemo(() => {
    // Prefer batch config markets (authoritative). Fall back to snapshot if unavailable.
    if (batchConfig?.markets?.length) {
      return batchConfig.markets.map(m => m.assetId).filter(Boolean) as string[]
    }
    return sourceMarkets.map(p => p.assetId).filter(Boolean) as string[]
  }, [batchConfig?.markets, sourceMarkets])
  const marketCount = marketIds.length || undefined

  // On-chain player position — used to reconcile oracle lag in BatchHistory
  const { isJoined: isJoinedOnChain } = usePlayerPosition(verifiedBatch?.id)

  // Active betting round — find the round that's actually accepting bets (not settling).
  // With round overlap, a settling round and a betting round can coexist.
  // The header always shows the betting round; settling rounds surface in PendingPositions.
  const bettingRound = useMemo(() => {
    if (!rounds || rounds.length === 0) return null
    return rounds.find(r => r.status === 'betting') ?? null
  }, [rounds])

  // bettingEnd: prefer the active betting round, fall back to activeBatch-derived timing
  const bettingEnd = bettingRound?.bettingEnd ?? null

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

        {/* First-trade CTA — visible only to wallets with no history */}
        <div className="mt-4">
          <FirstTradeCTA />
        </div>

        {/* Batch bar — always shows the open betting round */}
        {verifiedBatch ? (
          <div className="mt-4 border border-border-light bg-[var(--surface)] overflow-hidden">
            <BatchProgressBar
              bettingEnd={bettingEnd}
              tickDuration={verifiedBatch.tickDuration ?? bettingRound?.timeframeSecs ?? 300}
              isSettling={false}
            />
            <div className="flex items-center px-5 py-3">
              {/* Round # */}
              <div className="mr-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {t('source_detail.round')}
                </div>
                <div className="text-[15px] font-bold font-mono text-black">
                  #{verifiedBatch.id}
                </div>
              </div>
              {/* Players */}
              <div className="mr-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {t('source_detail.players')}
                </div>
                <div className="text-[15px] font-bold font-mono text-black">
                  {verifiedBatch.playerCount}
                </div>
              </div>
              {/* Pool */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {t('source_detail.pool')}
                </div>
                <div className="text-[15px] font-bold font-mono text-color-up">
                  {formatTvl(verifiedBatch.tvl)}
                </div>
              </div>
              {/* Timer — anchored right, the dominant element */}
              <div className="ml-auto pl-5">
                <div className="text-[24px] font-black font-mono text-black leading-none">
                  <CountdownTimer bettingEnd={bettingEnd} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 border border-border-light bg-[var(--surface)] overflow-hidden">
            <div className="px-5 py-3 text-center">
              <span className="text-[13px] font-mono text-text-muted animate-pulse">
                Next round starting...
              </span>
            </div>
          </div>
        )}

        {/* Pending positions — settling batches where user has a deposit */}
        {rounds && rounds.length > 0 && (
          <PendingPositions
            rounds={rounds}
            activeBatchId={verifiedBatch?.id}
          />
        )}

        {/* Managed Funds for this source */}
        <SourceFunds sourceId={sourceId} />

        {/* Content split */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          {/* Left: Markets + Leaderboard + History */}
          <div className="flex-1 min-w-0">
            <MarketsTable sourceId={sourceId} bitmapEditor={bitmapEditor} />
            <BatchHistory
              sourceId={sourceId}
              activeBatchId={verifiedBatch?.id}
              bettingEnd={bettingEnd}
              playerCount={bettingRound?.playerCount ?? verifiedBatch?.playerCount}
              tvl={bettingRound?.tvl ?? verifiedBatch?.tvl}
              tickDuration={verifiedBatch?.tickDuration ?? bettingRound?.timeframeSecs}
              isJoinedOnChain={isJoinedOnChain}
            />
            <TopPlayers sourceId={sourceId} />
          </div>

          {/* Right: Batch entry panel (300px, sticky) */}
          <div className="w-full lg:w-[300px] shrink-0">
            <div className="lg:sticky lg:top-28">
              <BatchEntryPanel
                bitmapEditor={bitmapEditor}
                sourceId={sourceId}
                marketIds={marketIds}
                bettingEnd={bettingEnd}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
