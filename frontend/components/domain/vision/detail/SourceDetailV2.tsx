'use client'

import { useMemo } from 'react'
import { useRouter } from '@/i18n/routing'
import { useSourceSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useQuery } from '@tanstack/react-query'
import type { BatchConfigResponse } from '@/hooks/vision/useBatchConfig'
import { useBatches } from '@/hooks/vision/useBatches'
import { useRounds } from '@/hooks/vision/useRounds'
import { usePlayerPosition } from '@/hooks/vision/usePlayerPosition'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { SourceHero } from './SourceHero'
import { PendingPositions } from './PendingPositions'
import { SourceSidebar } from './SourceSidebar'
import { FeaturedVault } from './FeaturedVault'
import { SubmarketsGrid } from './SubmarketsGrid'
import { SourceDashboard } from './SourceDashboard'
import { WalletSourceStats } from './shared'
import type { SourceDisplayServer } from '@/lib/vision/sources-server'
import { useTranslations } from 'next-intl'
import { useReadContract } from 'wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'
import { SourceDetailSkeleton } from '@/components/ui/VisionLoader'
// import { FirstTradeCTA } from '../FirstTradeCTA'

// ── Main component ──

interface SourceDetailV2Props {
  sourceId: string
  initialSource?: SourceDisplayServer
}

export function SourceDetailV2({ sourceId, initialSource }: SourceDetailV2Props) {
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

  // Snapshot + meta
  const { data: snapshotData } = useSourceSnapshot(sourceId)
  const { data: meta } = useMarketSnapshotMeta()
  const { data: batches } = useBatches()
  const { data: rounds } = useRounds(sourceId)


  const sourceSchedule = useMemo(() => {
    if (!meta?.sources) return undefined
    return meta.sources.find(s => s.sourceId === sourceId)
  }, [meta?.sources, sourceId])

  const sourceMarkets = snapshotData?.prices ?? []

  // Active batch
  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    return batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  // On-chain batch verification
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
  const batchRpcFailed = !!activeBatch && (batchOnChainError || batchError !== null)
  const verifiedBatch = batchRpcFailed ? null : activeBatch

  // Batch config
  const { data: batchConfig } = useQuery<BatchConfigResponse>({
    queryKey: ['batch-config-source', sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/vision/config/${sourceId}`)
      if (!res.ok) return { markets: [] } as any
      return res.json()
    },
    enabled: !!sourceId,
    staleTime: 300_000,
    retry: 1,
  })

  const marketIds = useMemo(() => {
    if (batchConfig?.markets?.length) {
      return batchConfig.markets.map(m => m.assetId).filter(Boolean) as string[]
    }
    return sourceMarkets.map(p => p.assetId).filter(Boolean) as string[]
  }, [batchConfig?.markets, sourceMarkets])

  const marketCount = marketIds.length || undefined

  // Player position
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

  // Loading / not-found states
  if (isRegistryLoading && !initialSource) {
    return <SourceDetailSkeleton />
  }

  if (!source) {
    return (
      <div className="px-6 lg:px-12 py-12">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-black text-black mb-2">
            {t('source_detail.source_not_found')}
          </h1>
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
    <div className="flex">
      {/* Left sidebar */}
      <SourceSidebar
        currentSourceId={sourceId}
        category={source.category}
        side="left"
      />

      {/* Center content */}
      <div className="flex-1 min-w-0 px-2 lg:px-4 py-5">
        {/* Source hero banner */}
        <SourceHero
          source={source}
          sourceSchedule={sourceSchedule}
          marketCount={marketCount}
          tickRemaining={0}
          tickDuration={0}
          sourceId={sourceId}
          urgency="normal"
        />

        <div className="relative z-[1] bg-page">
          <WalletSourceStats sourceId={sourceId} />

          {/* Source presentation — one-liner */}
          <div className="mt-4 px-1">
            <p className="text-[13px] text-text-secondary leading-relaxed">
              {source.description}
            </p>
          </div>

          {/* Pending positions */}
          {rounds && rounds.length > 0 && (
            <PendingPositions
              rounds={rounds}
              activeBatchId={verifiedBatch?.id}
            />
          )}

          {/* Featured vault */}
          <div className="mt-6">
            <FeaturedVault sourceId={sourceId} />
          </div>

          {/* Dashboard: current round, round spotlight (with past rounds), leaderboard, recent bets */}
          <div className="mt-6">
            <SourceDashboard
              sourceId={sourceId}
              verifiedBatch={verifiedBatch}
              bettingEnd={bettingEnd}
              tickDuration={verifiedBatch?.tickDuration ?? bettingRound?.timeframeSecs ?? 300}
              settlingRound={settlingRound}
              rounds={rounds}
            />
          </div>
        </div>

        {/* Submarkets grid — full width, no side margins, last on page */}
        <div className="-mx-2 lg:-mx-4">
          <SubmarketsGrid sourceId={sourceId} />
        </div>
      </div>

      {/* Right sidebar */}
      <SourceSidebar
        currentSourceId={sourceId}
        category={source.category}
        side="right"
      />
    </div>
  )
}
