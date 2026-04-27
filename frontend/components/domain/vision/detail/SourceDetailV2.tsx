'use client'

import { useMemo, useCallback, useRef } from 'react'
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
import { SourceSidebarMobile } from './SourceSidebarMobile'
import { VaultShowcase } from './VaultShowcase'
import { SubmarketsGrid } from './SubmarketsGrid'
import { SourceDashboard } from './SourceDashboard'
import { WalletSourceStats } from './shared'
import type { SourceDisplayServer } from '@/lib/vision/sources-server'
import { useTranslations } from 'next-intl'
import { SourceDetailSkeleton } from '@/components/ui/VisionLoader'
import { useOnboarding } from '@/hooks/useOnboarding'
import { OnboardingCompass } from './OnboardingCompass'

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

  // Active batch, `useBatches()` already returns multicall-verified batches
  // from `/api/vision/batches`. The previous client-side `useReadContract`
  // waterfall added a 5-8s delay to first paint and turned a single bad RPC
  // into a permanent "Between rounds" failure. The server multicall is
  // sufficient.
  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    return batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  const verifiedBatch = activeBatch

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

  // ── Onboarding ──
  const onboarding = useOnboarding(sourceId)
  const vaultShowcaseRef = useRef<HTMLDivElement>(null)

  const handleOnboardingVaultDeposit = useCallback(() => {
    vaultShowcaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const handleOnboardingBotDeploy = useCallback(() => {
    router.push('/build-bot')
  }, [router])

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
      {/* Left sidebar — flush to viewport edge, never inset */}
      <SourceSidebar
        currentSourceId={sourceId}
        category={source.category}
        side="left"
      />

      {/* Center content. Internal padding gives the column breathing room
          without pushing the sidebars away from the viewport edge. The
          vertical rhythm is one scale: gap-8 between every top-level
          section, no more mt-* chain. */}
      <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-10 flex flex-col gap-8">
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

          <WalletSourceStats sourceId={sourceId} />

          {/* Pending positions */}
          {rounds && rounds.length > 0 && (
            <PendingPositions
              rounds={rounds}
              activeBatchId={verifiedBatch?.id}
            />
          )}

          {/* Vault showcase — the onboarding compass aims its pointer at the
              data-onboarding-target node when the user is on the vault step. */}
          <div
            ref={vaultShowcaseRef}
            data-onboarding-target="vault"
            className="[&:has(>div:empty)]:hidden [&:has(>div:first-child:empty)]:hidden"
          >
            <VaultShowcase sourceId={sourceId} />
          </div>

          {/* Mobile-only "More Sources" strip, mirrors desktop sidebars,
              sits right beneath the vault section. */}
          <SourceSidebarMobile currentSourceId={sourceId} category={source.category} />

          {/* Dashboard: current round, round spotlight (with past rounds), leaderboard, recent bets */}
          <SourceDashboard
            sourceId={sourceId}
            verifiedBatch={verifiedBatch}
            bettingRound={bettingRound}
            bettingEnd={bettingEnd}
            tickDuration={verifiedBatch?.tickDuration ?? bettingRound?.timeframeSecs ?? 300}
            settlingRound={settlingRound}
            rounds={rounds}
          />

          {/* Submarkets grid, sits at the same edge as every other section */}
          <SubmarketsGrid sourceId={sourceId} />
      </div>

      {/* Floating onboarding compass — bottom-right card + viewport-edge
          pointer that locks onto the next-step target. Renders at viewport
          scope so it survives layout swaps and stays put on mobile. */}
      <OnboardingCompass
        state={onboarding}
        onVaultDeposit={handleOnboardingVaultDeposit}
        onBotDeploy={handleOnboardingBotDeploy}
      />

      {/* Right sidebar — flush to viewport edge, never inset */}
      <SourceSidebar
        currentSourceId={sourceId}
        category={source.category}
        side="right"
      />
    </div>
  )
}
