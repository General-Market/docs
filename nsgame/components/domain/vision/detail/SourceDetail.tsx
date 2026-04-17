'use client'

import { useMemo } from 'react'
import { useRouter } from '@/i18n/routing'
import { useSourceSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useQuery } from '@tanstack/react-query'
import type { BatchConfigResponse } from '@/hooks/vision/useBatchConfig'
import { useBatches } from '@/hooks/vision/useBatches'
import { useRounds } from '@/hooks/vision/useRounds'
import { useBitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { usePlayerPosition } from '@/hooks/vision/usePlayerPosition'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { SourceHero } from './SourceHero'
import { MarketsTable } from './MarketsTable'
import { TopPlayers } from './TopPlayers'
import BatchEntryPanel from './BatchEntryPanel'
import { PendingPositions } from './PendingPositions'
import { BatchHistory } from './BatchHistory'
import { BatchProgressBar } from '../CountdownRing'
import { WalletSourceStats, TripleTimer, formatTvl } from './shared'
import type { SourceDisplayServer } from '@/lib/vision/sources-server'
import { useTranslations } from 'next-intl'
import { useReadContract } from '@/lib/wallet-shim'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'
import { SourceDetailSkeleton } from '@/components/ui/VisionLoader'
import { FirstTradeCTA } from '../FirstTradeCTA'
import { SourceFunds } from '@/components/domain/vaults/SourceFunds'

interface SourceDetailProps {
  sourceId: string
  initialSource?: SourceDisplayServer
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

  // Fetch latest batch config by sourceId, no waterfall dependency on configHash.
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

  // On-chain player position, used to reconcile oracle lag in BatchHistory
  const { isJoined: isJoinedOnChain } = usePlayerPosition(verifiedBatch?.id)

  // Betting round (current) + settling round (previous)
  const bettingRound = useMemo(() => {
    if (!rounds || rounds.length === 0) return null
    return rounds.find(r => r.status === 'betting') ?? null
  }, [rounds])

  const settlingRound = useMemo(() => {
    if (!rounds || rounds.length === 0) return null
    return rounds.find(r => r.status === 'settling' || r.status === 'locked') ?? null
  }, [rounds])

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

        {/* First-trade CTA, visible only to wallets with no history */}
        <div className="mt-4">
          <FirstTradeCTA />
        </div>

        {/* Batch bar, single line with all three timers */}
        {verifiedBatch ? (
          <div className="mt-4 border border-border-light bg-[var(--surface)] overflow-hidden">
            <BatchProgressBar
              bettingEnd={bettingEnd}
              tickDuration={verifiedBatch.tickDuration ?? bettingRound?.timeframeSecs ?? 300}
            />
            <div className="flex items-center px-5 py-3">
              <div className="mr-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {t('source_detail.round')}
                </div>
                <div className="text-[15px] font-bold font-mono text-black">
                  #{verifiedBatch.id}
                </div>
              </div>
              <div className="mr-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {t('source_detail.players')}
                </div>
                <div className="text-[15px] font-bold font-mono text-black">
                  {verifiedBatch.playerCount}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {t('source_detail.pool')}
                </div>
                <div className="text-[15px] font-bold font-mono text-color-up">
                  {formatTvl(verifiedBatch.tvl)}
                </div>
              </div>
              <div className="ml-auto pl-5">
                <TripleTimer
                  bettingEnd={bettingEnd}
                  tickDuration={verifiedBatch.tickDuration ?? bettingRound?.timeframeSecs ?? 300}
                  prevBettingEnd={settlingRound?.bettingEnd ?? null}
                  prevTickDuration={settlingRound?.timeframeSecs ?? 300}
                />
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

        {/* Pending positions, settling batches where user has a deposit */}
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
