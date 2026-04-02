'use client'

import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { useSharedCountdown } from '@/hooks/useSharedCountdown'
import { useRouter } from '@/i18n/routing'
import { useSourceSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useQuery } from '@tanstack/react-query'
import type { BatchConfigResponse } from '@/hooks/vision/useBatchConfig'
import { useBatches } from '@/hooks/vision/useBatches'
import { useRounds } from '@/hooks/vision/useRounds'
import { usePlayerPosition } from '@/hooks/vision/usePlayerPosition'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'
import { SourceHero } from './SourceHero'
import { PendingPositions } from './PendingPositions'
import { BatchProgressBar } from '../CountdownRing'
import { SubmarketsGrid } from './SubmarketsGrid'
import { SourceSidebar } from './SourceSidebar'
import { BatchVaultResults } from './BatchVaultResults'
import { VaultCarousel } from './VaultCarousel'
import type { SourceDisplayServer } from '@/lib/vision/sources-server'
import { useTranslations } from 'next-intl'
import { useAccount, useReadContract } from 'wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'
import { SourceDetailSkeleton } from '@/components/ui/VisionLoader'
import { FirstTradeCTA } from '../FirstTradeCTA'

// ── Wallet stats bar (same as SourceDetail) ──

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
        <div className={`text-[15px] font-bold font-mono ${entry.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {entry.roi >= 0 ? '+' : ''}{entry.roi.toFixed(1)}%
        </div>
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

// ── Triple timer — prev settle | close | settle ──

function fmt(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface TripleTimerProps {
  bettingEnd: string | null
  tickDuration: number
  prevBettingEnd: string | null
  prevTickDuration: number
}

function TripleTimer({ bettingEnd, tickDuration, prevBettingEnd, prevTickDuration }: TripleTimerProps) {
  const closeRemaining = useSharedCountdown(bettingEnd)

  const now = Date.now()

  // Current round settle
  const curEnd = bettingEnd ? new Date(bettingEnd).getTime() : 0
  const curSettleRemaining = bettingEnd ? Math.max(0, Math.floor((curEnd + tickDuration * 1000 - now) / 1000)) : 0

  // Previous round settle
  const prevEnd = prevBettingEnd ? new Date(prevBettingEnd).getTime() : 0
  const prevSettleRemaining = prevBettingEnd ? Math.max(0, Math.floor((prevEnd + prevTickDuration * 1000 - now) / 1000)) : 0

  if (!bettingEnd) return <span className="text-text-muted font-mono">--:--</span>

  return (
    <div className="flex items-center gap-3">
      {/* Prev settle — only if a previous round is resolving */}
      {prevBettingEnd && prevSettleRemaining > 0 && (
        <>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-color-warning">Prev Settle</div>
            <div className="text-[14px] font-bold font-mono tabular-nums leading-none text-color-warning">
              {fmt(prevSettleRemaining)}
            </div>
          </div>
          <div className="w-px h-8 bg-border-light" />
        </>
      )}
      {/* Close */}
      <div className="text-right">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Close</div>
        <div className={`text-[20px] font-black font-mono tabular-nums leading-none ${closeRemaining <= 0 ? 'text-text-muted line-through text-[14px]' : closeRemaining < 60 ? 'text-color-down' : 'text-black'}`}>
          {fmt(Math.max(0, closeRemaining))}
        </div>
      </div>
      <div className="w-px h-8 bg-border-light" />
      {/* Settle */}
      <div className="text-right">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Settle</div>
        <div className={`font-mono tabular-nums leading-none ${closeRemaining <= 0 ? 'text-[20px] font-black text-color-warning' : 'text-[14px] font-bold text-text-secondary'}`}>
          {fmt(curSettleRemaining)}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──

function formatTvl(tvl: string): string {
  const raw = parseFloat(tvl)
  if (isNaN(raw) || raw === 0) return '$0'
  const num = raw / 1e18
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

// ── Side banners — HLTV-style fixed border images ──
// Fixed position, outside the content flow, only on very wide screens (>1700px)

function SideBanner({ position }: { position: 'left' | 'right' }) {
  const isLeft = position === 'left'
  return (
    <div
      className="hidden 2xl:block fixed top-[100px] w-[140px] h-[600px] rounded overflow-hidden z-0"
      style={{ [isLeft ? 'left' : 'right']: '12px' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: isLeft
            ? 'linear-gradient(180deg, #0a1628 0%, #162d50 30%, #0f172a 60%, #1e3a5f 100%)'
            : 'linear-gradient(180deg, #1a0a28 0%, #2d1650 30%, #170a2a 60%, #3a1e5f 100%)',
        }}
      />
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      {/* Glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[100px] h-[100px] rounded-full blur-3xl"
        style={{ background: isLeft ? 'rgba(59,130,246,0.08)' : 'rgba(168,85,247,0.08)' }}
      />
      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-3">
        <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-3">
          <svg
            className="w-4 h-4"
            style={{ color: isLeft ? 'rgba(96,165,250,0.5)' : 'rgba(192,132,252,0.5)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            {isLeft ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.01 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.01-9.963-7.178z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
            )}
          </svg>
        </div>
        <div className="text-[11px] font-black text-white/60 tracking-[-0.02em] text-center">
          {isLeft ? 'VISION' : 'TRADE'}
        </div>
        <div
          className="text-[7px] font-bold uppercase tracking-[0.15em] mt-0.5 text-center"
          style={{ color: isLeft ? 'rgba(96,165,250,0.35)' : 'rgba(192,132,252,0.35)' }}
        >
          {isLeft ? 'Prediction Markets' : 'Real-World Data'}
        </div>
        <div className="mt-6 w-px h-12 bg-white/[0.06]" />
        <p className="mt-3 text-[7px] text-white/10 text-center leading-relaxed px-1">
          {isLeft
            ? '93 data sources. Thousands of markets. Settles on-chain.'
            : 'AI-native. Build bots, deploy vaults, earn fees.'}
        </p>
      </div>
    </div>
  )
}

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
    <div>
      {/* HLTV-style fixed border banners */}
      <SideBanner position="left" />
      <SideBanner position="right" />

      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        {/* Source Hero */}
        <SourceHero
          source={source}
          sourceSchedule={sourceSchedule}
          marketCount={marketCount}
          tickRemaining={0}
          tickDuration={0}
          sourceId={sourceId}
          urgency="normal"
        />

        {/* Wallet stats */}
        <WalletSourceStats sourceId={sourceId} />

        {/* First-trade CTA */}
        <div className="mt-4">
          <FirstTradeCTA />
        </div>

        {/* Batch bar — single line with all three timers */}
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

        {/* Pending positions */}
        {rounds && rounds.length > 0 && (
          <PendingPositions
            rounds={rounds}
            activeBatchId={verifiedBatch?.id}
          />
        )}

        {/* ── 2-Column HLTV Layout (sidebar + content) ── */}
        <div className="flex gap-5 mt-5">
          {/* Left sidebar — banner + related sources */}
          <SourceSidebar
            currentSourceId={sourceId}
            category={source.category}
          />

          {/* Center content */}
          <div className="flex-1 min-w-0">
            {/* Vault carousel — above submarkets */}
            <VaultCarousel sourceId={sourceId} />

            {/* Submarkets grid — HLTV "Top streams" style */}
            <div className="mt-5">
              <SubmarketsGrid sourceId={sourceId} />
            </div>

            {/* Vault results + batch history — HLTV "Recent results" style */}
            <BatchVaultResults sourceId={sourceId} />
          </div>
        </div>
      </div>
    </div>
  )
}
