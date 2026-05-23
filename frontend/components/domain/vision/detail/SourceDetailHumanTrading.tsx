'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import Image from 'next/image'
import { useRouter } from '@/i18n/routing'
import { useAccount, useReadContract } from 'wagmi'
import { useWalletLogin } from '@/hooks/useWalletLogin'
import { indexL3 } from '@/lib/wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { useSourceSnapshot, type SnapshotPrice } from '@/hooks/vision/useMarketSnapshot'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { useBatches } from '@/hooks/vision/useBatches'
import { useBatchConfigBySource } from '@/hooks/vision/useBatchConfig'
import { useRounds } from '@/hooks/vision/useRounds'
import { useJoinBatch } from '@/hooks/vision/useJoinBatch'
import { useSubmitBitmap } from '@/hooks/vision/useSubmitBitmap'
import { useL3GasBalance } from '@/hooks/vision/useL3GasBalance'
import { usePlayerPosition } from '@/hooks/vision/usePlayerPosition'
import { usePlayerProfile, type ProfileBatch, type ProfileTick } from '@/hooks/usePlayerProfile'
import { useBulkMarketHistory, type HistoryPoint } from '@/hooks/vision/useBulkMarketHistory'
import { useSharedCountdown } from '@/hooks/useSharedCountdown'
import { useDeployment } from '@/hooks/useDeployment'
import { getDefiLlamaAllowlist } from '@/lib/vision/defillama-curated'
import { toInternalId } from '@/lib/vision/source-ids'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'
import { decodeBitmap, type BetDirection } from '@/lib/vision/bitmap'
import { SourceTabNav } from './SourceTabNav'
import type { SourceDisplayServer } from '@/lib/vision/sources-server'
import { GeneralLoader } from '@/components/ui/GeneralLoader'
import { useTranslations } from 'next-intl'
import { HumanMarketCard } from './HumanMarketCard'
import { HumanTradingOnboarding } from './HumanTradingOnboarding'
import { MarketCandleChart, chartHistoryQueryOptions, type Timeframe } from './MarketCandleChart'

// ── Constants ────────────────────────────────────────────────────────────────

const TOP_N = 10
const APPLE_BLUE = '#0071E3'
const APPLE_BLUE_HOVER = '#0066CC'
const APPLE_GREEN = '#28CD41'
const APPLE_RED = '#FF3B30'
const APPLE_TEXT = '#1D1D1F'
const APPLE_TEXT_SECONDARY = '#86868B'
const APPLE_BG = '#FBFBFD'
const APPLE_PANEL = '#FFFFFF'
const APPLE_CHIP_BG = '#F5F5F7'
const EASE_DEFAULT = 'cubic-bezier(0.4, 0, 0.6, 1)'
const EASE_OUT = 'cubic-bezier(0.25, 0.1, 0.3, 1)'
const FONT_DISPLAY = 'var(--apple-font-display), "SF Pro Display", Helvetica, Arial, sans-serif'
const FONT_TEXT = 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif'
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const STAKE_QUICK_PICKS = [1, 5, 10, 25, 50]
const MIN_PER_MARKET = 0.1

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ── Formatting helpers ───────────────────────────────────────────────────────

function formatBigUsd(value: string | null): string {
  if (!value) return '—'
  const n = parseFloat(value)
  if (!isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function formatCountdown(secs: number): string {
  if (secs <= 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatUsdDollars(n: number): string {
  if (!isFinite(n)) return '$0.00'
  if (Math.abs(n) >= 1000) return `$${n.toFixed(0)}`
  return `$${n.toFixed(2)}`
}

function aggregateValue(prices: SnapshotPrice[]): string {
  let sum = 0
  for (const p of prices) {
    const v = parseFloat(p.value)
    if (isFinite(v)) sum += v
  }
  return String(sum)
}

// ── Types ────────────────────────────────────────────────────────────────────

type Pick = 'up' | 'down'
type Picks = Record<string, Pick>

type FlowStep =
  | 'idle'
  | 'approving'
  | 'committing'
  | 'publishing'
  | 'committed'
  | 'reveal-failed'

interface CuratedMarket {
  market: SnapshotPrice
  marketIndex: number // index inside batch.marketIds
}

interface TickEntry extends ProfileTick {
  batchId: number
}

interface SourcePositions {
  active: ProfileBatch[]
  ticks: TickEntry[]
  totalPnl: number
  batches: ProfileBatch[]
}

const EMPTY_POSITIONS: SourcePositions = {
  active: [],
  ticks: [],
  totalPnl: 0,
  batches: [],
}

// ── Component ────────────────────────────────────────────────────────────────

interface SourceDetailHumanTradingProps {
  sourceId: string
  initialSource?: SourceDisplayServer
  hideSidebar?: boolean
}

export function SourceDetailHumanTrading({
  sourceId,
  initialSource,
  hideSidebar,
}: SourceDetailHumanTradingProps) {
  const t = useTranslations('vision')
  const router = useRouter()
  const queryClient = useQueryClient()

  // -- Registry / source metadata --
  const { sources, isLoading: isRegistryLoading } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)
  const source = useMemo(() => {
    if (sourceEntry) {
      return {
        sourceId: sourceEntry.sourceId,
        name: sourceEntry.name,
        description: sourceEntry.description,
        category: sourceEntry.category,
        logo: sourceEntry.logo,
        brandBg: sourceEntry.brandBg,
        prefixes: sourceEntry.prefixes,
        valueLabel: sourceEntry.valueLabel,
        valueUnit: sourceEntry.valueUnit,
        isPrice: sourceEntry.isPrice,
        internalIds: sourceEntry.internalIds ?? [],
        batchSubsourceKey: sourceEntry.batchSubsourceKey,
      }
    }
    if (initialSource) {
      return {
        sourceId: initialSource.sourceId,
        name: initialSource.name,
        description: initialSource.description,
        category: initialSource.category,
        logo: initialSource.logo,
        brandBg: initialSource.brandBg,
        prefixes: initialSource.prefixes,
        valueLabel: initialSource.valueLabel,
        valueUnit: initialSource.valueUnit,
        isPrice: initialSource.isPrice,
        internalIds: initialSource.internalIds ?? [],
        batchSubsourceKey: initialSource.batchSubsourceKey,
      }
    }
    return null
  }, [sourceEntry, initialSource])

  // -- Snapshot for the source --
  const { data: snapshotData, isLoading: isSnapshotLoading } = useSourceSnapshot(sourceId)
  const allMarkets: SnapshotPrice[] = useMemo(
    () => snapshotData?.prices ?? [],
    [snapshotData],
  )

  // -- Curated allowlist (10 slugs per displaySourceId) --
  const allowlist = useMemo(() => getDefiLlamaAllowlist(sourceId), [sourceId])
  const curatedMarkets: SnapshotPrice[] = useMemo(() => {
    if (!allowlist) {
      // Fallback: take top 10 by value
      return [...allMarkets]
        .sort((a, b) => (parseFloat(b.value) || 0) - (parseFloat(a.value) || 0))
        .slice(0, TOP_N)
    }
    // Preserve curated order from defillama-curated.json by looking up the assetId
    const byAssetId = new Map(allMarkets.map(m => [m.assetId, m]))
    const ordered: SnapshotPrice[] = []
    for (const id of allowlist) {
      const m = byAssetId.get(id)
      if (m) ordered.push(m)
    }
    return ordered.slice(0, TOP_N)
  }, [allMarkets, allowlist])

  // -- Active batch + round phase --
  // Match order: dedicated `batchSubsourceKey` first (e.g. `defillama-bridges`
  // → its own 10-market batch), then `sourceId`, then `internalIds`. Curated
  // sub-pages have to beat the parent firehose; otherwise the bridges page
  // would resolve to the 8 192-market `defi` batch and silently bet DOWN on
  // every protocol the user didn't pick.
  const { data: batches } = useBatches()
  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0 || !source) return null
    const candidates = new Set<string>(
      [source.batchSubsourceKey, source.sourceId, ...(source.internalIds ?? [])]
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
    return batches.find(b => candidates.has(b.sourceId)) ?? null
  }, [batches, source])

  const configHash = (activeBatch?.configHash ?? null) as `0x${string}` | null

  // The /vision/batches API returns market_count but not the full marketIds
  // array. Pull the authoritative ordered list from the data-node, keyed by
  // sourceId so the SSR prefetch (page.tsx → ['batch-config-source', sourceId])
  // warms the same cache slot this hook reads. Keying by configHash here
  // missed the prefetch on every cold paint AND 404'd briefly during round
  // transitions, leaving the picker stuck at "0 active this round".
  const { data: batchConfig } = useBatchConfigBySource(sourceId)
  const marketIds: string[] = useMemo(
    () => batchConfig?.markets?.map(m => m.assetId) ?? [],
    [batchConfig],
  )

  // -- Curated markets that ARE in the current batch (only these are bettable) --
  const tradableMarkets: CuratedMarket[] = useMemo(() => {
    if (!activeBatch) return []
    const result: CuratedMarket[] = []
    for (const m of curatedMarkets) {
      const idx = marketIds.indexOf(m.assetId)
      if (idx >= 0) result.push({ market: m, marketIndex: idx })
    }
    return result
  }, [curatedMarkets, marketIds, activeBatch])

  // -- Bulk 24h history for every curated market — one network call gates the
  //    entire chart area, so the page never shows a row of staggered skeletons. --
  const curatedAssetIds = useMemo(
    () => curatedMarkets.map(m => m.assetId),
    [curatedMarkets],
  )
  const dataNodeSourceId = useMemo(() => toInternalId(sourceId), [sourceId])
  // Bulk 24h history feeds the mini-card sparklines. The big candle chart
  // owns its own per-asset history fetch — gating the page on this endpoint
  // breaks the chart whenever the data-node's batch-history is slow or 502s.
  const { data: historyByAsset } = useBulkMarketHistory(dataNodeSourceId, curatedAssetIds)

  // -- bettingEnd from the round (server-truth) --
  const { data: rounds } = useRounds(sourceId)
  const round = useMemo(() => {
    if (!activeBatch || !rounds) return null
    return rounds.find(r => r.batchId === activeBatch.id) ?? null
  }, [rounds, activeBatch])
  const bettingEnd = round?.bettingEnd ?? null
  const remainingSecs = useSharedCountdown(bettingEnd)

  // Round lifecycle. The oracle's /vision/rounds/active drops settled rounds,
  // so between ticks `round` briefly becomes null even though the batch is alive.
  // Treat that gap as "waiting for next round" — never as "no round is active".
  type RoundPhase = 'open' | 'pending' | 'locked' | 'settling' | 'absent'
  const roundPhase: RoundPhase = useMemo(() => {
    if (!activeBatch) return 'absent'
    if (!round) return 'pending'
    if (round.status === 'betting' && !!bettingEnd && remainingSecs > 0) return 'open'
    if (round.status === 'locked') return 'locked'
    if (round.status === 'settling' || round.status === 'settled') return 'settling'
    return 'pending'
  }, [activeBatch, round, bettingEnd, remainingSecs])

  const isBettingOpen = roundPhase === 'open'
  const isBetweenRounds = roundPhase === 'pending' || roundPhase === 'locked' || roundPhase === 'settling'
  const isRoundSettling = roundPhase === 'settling' || (roundPhase === 'open' && remainingSecs === 0)

  // -- Round window for the per-card chart overlays --
  // Open ≈ bettingEnd − timeframeSecs. Close ≈ bettingEnd. `resolved` flips on once we cross close.
  const { roundOpenAt, roundCloseAt, resolved } = useMemo(() => {
    if (!round || !round.bettingEnd) {
      return { roundOpenAt: null, roundCloseAt: null, resolved: false }
    }
    const closeMs = new Date(round.bettingEnd).getTime()
    const openMs = round.timeframeSecs > 0 ? closeMs - round.timeframeSecs * 1000 : null
    return {
      roundOpenAt: openMs,
      roundCloseAt: closeMs,
      resolved: remainingSecs <= 0,
    }
  }, [round, remainingSecs])

  // -- Player position (for already-joined state on refresh) --
  const { isJoined, position, refetch: refetchPosition } = usePlayerPosition(activeBatch?.id)

  // -- Wallet + gas + USDC balance --
  const { address, isConnected } = useAccount()

  // -- Player profile, filtered to this source's batches (drives positions rail) --
  // The issuer's /player/profile endpoint returns sourceId="" on active batches
  // (only exited rows carry a stable sourceId). So matching by source name alone
  // misses the user's current commit. We match by source name AND by the active
  // batch's ID — the batch we know they're sitting in. Curated subsource pages
  // need this; the umbrella `defillama` keeps working through name matching.
  const { profile: playerProfile } = usePlayerProfile(address ?? '')
  const sourcePositions = useMemo<SourcePositions>(() => {
    if (!playerProfile || !source) return EMPTY_POSITIONS
    const candidates = new Set<string>(
      [source.batchSubsourceKey, source.sourceId, ...(source.internalIds ?? [])]
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
    const activeBatchId = activeBatch?.id
    const batchesHere = playerProfile.batches.filter(b => {
      if (b.sourceId && candidates.has(b.sourceId)) return true
      // Active batches arrive with sourceId="" — keep the one matching the
      // page's live batch by id so the user always sees the commit they just
      // landed instead of "No positions yet".
      if (activeBatchId !== undefined && b.batchId === activeBatchId) return true
      return false
    })
    if (batchesHere.length === 0) return EMPTY_POSITIONS
    const active = batchesHere.filter(b => b.status === 'active')
    const ticks: TickEntry[] = []
    for (const b of batchesHere) {
      for (const t of b.ticks) ticks.push({ ...t, batchId: b.batchId })
    }
    ticks.sort((a, b) => b.tickId - a.tickId)
    const totalPnl = ticks.reduce((s, t) => s + t.pnl, 0)
    return { active, ticks, totalPnl, batches: batchesHere }
  }, [playerProfile, source, activeBatch])
  const handleConnectWallet = useWalletLogin({ source: 'source-detail-human' })
  const { getAddress } = useDeployment()
  const usdcAddress = getAddress('L3_WUSDC')
  const { isLow: hasLowGas } = useL3GasBalance()

  const { data: walletUsdcRaw } = useReadContract({
    address: usdcAddress,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: {
      enabled:
        !!address && usdcAddress !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10_000,
    },
  })
  const walletUsdc = (walletUsdcRaw as bigint | undefined) ?? 0n

  // -- Join + submit hooks --
  const {
    join,
    bitmap: encodedBitmap,
    bitmapHash,
    step: joinStep,
    error: joinError,
    reset: resetJoin,
  } = useJoinBatch()
  const {
    submitBitmap,
    isSubmitting,
    error: submitError,
  } = useSubmitBitmap()

  // -- Picks (forced UP/DOWN per tradable market) --
  const [picks, setPicks] = useState<Picks>({})
  const [stakeInput, setStakeInput] = useState<string>('10')
  const [flow, setFlow] = useState<FlowStep>('idle')
  const [revealRetryCount, setRevealRetryCount] = useState(0)
  // -- Which market the big candle chart on top is currently focused on --
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  // Lifted from MarketCandleChart so hover-prefetch matches the user's choice.
  const [chartTimeframe, setChartTimeframe] = useState<Timeframe>('1h')

  // Reconcile flow with joinStep + isJoined
  useEffect(() => {
    if (joinStep === 'approving' && flow !== 'approving') setFlow('approving')
    if (joinStep === 'joining' && flow !== 'committing') setFlow('committing')
    if (joinStep === 'error' && flow !== 'idle') {
      setFlow('idle')
      resetJoin()
    }
  }, [joinStep, flow, resetJoin])

  // After joinBatchDirect lands, publish bitmap to issuers
  useEffect(() => {
    if (joinStep !== 'done' || !encodedBitmap || !bitmapHash || !activeBatch) return
    setFlow('publishing')
    submitBitmap({
      batchId: activeBatch.id,
      bitmap: encodedBitmap,
      bitmapHash,
    })
      .then(result => {
        if (result.acceptedCount > 0) {
          setFlow('committed')
        } else {
          setFlow('reveal-failed')
        }
      })
      .catch(() => {
        setFlow('reveal-failed')
      })
      .finally(() => {
        resetJoin()
        refetchPosition()
        queryClient.invalidateQueries({ queryKey: ['vision-rounds'] })
        queryClient.invalidateQueries({ queryKey: ['vision-batches'] })
      })
  }, [
    joinStep,
    encodedBitmap,
    bitmapHash,
    activeBatch,
    submitBitmap,
    resetJoin,
    refetchPosition,
    queryClient,
  ])

  // If user already joined this round (refresh), decode their stored picks
  // so the rows mount in `committed` state with the correct direction visible.
  useEffect(() => {
    if (!isJoined || !position || !activeBatch) return
    if (flow === 'committed') return
    // Best-effort decode: we have the bitmap hash on-chain but not the bytes.
    // Try to fetch from the issuer; if unavailable, we still set flow=committed
    // but the rows can't recolor. Issuers expose bitmaps via the rounds bitmaps endpoint.
    let cancelled = false
    const decodeFromIssuer = async () => {
      try {
        const res = await fetch(
          `/api/vision/rounds/${activeBatch.id}/bitmaps?player=${address}`,
        )
        if (!res.ok) return
        const data = await res.json()
        const bm: string | undefined = data?.bitmap_hex ?? data?.bitmapHex
        if (!bm) return
        const hex = bm.startsWith('0x') ? bm.slice(2) : bm
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
        }
        const directions = decodeBitmap(bytes, marketIds.length)
        if (cancelled) return
        const next: Picks = {}
        for (let i = 0; i < marketIds.length; i++) {
          next[marketIds[i]] = directions[i] === 'UP' ? 'up' : 'down'
        }
        setPicks(next)
        setFlow('committed')
      } catch {
        // Issuer history not available — still mark as committed so the UI locks
        if (!cancelled) setFlow('committed')
      }
    }
    decodeFromIssuer()
    return () => { cancelled = true }
  }, [isJoined, position, activeBatch, address, marketIds, flow])

  // -- Pick handlers --
  const onPick = useCallback((marketId: string, direction: Pick) => {
    if (flow !== 'idle') return
    setPicks(prev => {
      if (prev[marketId] === direction) return prev
      return { ...prev, [marketId]: direction }
    })
  }, [flow])

  // Current-round commit, read straight from the contract via usePlayerPosition.
  // The issuer profile drops sourceId on active rows so it's unreliable for
  // subsource pages; on-chain is the source of truth. Picks distribution
  // (X UP / Y DOWN) comes from the decoded bitmap in local `picks` state, so
  // refreshes after lock-in still show the right colors.
  const currentCommit = useMemo(() => {
    if (!isJoined || !position || !activeBatch) return null
    const stakeUsd = Number(formatUnits(position.totalDeposited, VISION_USDC_DECIMALS))
    let ups = 0
    let downs = 0
    for (const m of tradableMarkets) {
      const p = picks[m.market.assetId]
      if (p === 'up') ups += 1
      else if (p === 'down') downs += 1
    }
    return {
      batchId: activeBatch.id,
      stakeUsd,
      perMarketUsd:
        tradableMarkets.length > 0 ? stakeUsd / tradableMarkets.length : 0,
      ups,
      downs,
      marketCount: tradableMarkets.length,
    }
  }, [isJoined, position, activeBatch, tradableMarkets, picks])

  // -- Stake math --
  const stakeNum = parseFloat(stakeInput) || 0
  const marketCount = tradableMarkets.length
  const perMarketStake = marketCount > 0 ? stakeNum / marketCount : 0
  const meetsMinimum = perMarketStake >= MIN_PER_MARKET
  const totalPicked = useMemo(
    () => tradableMarkets.filter(m => picks[m.market.assetId]).length,
    [picks, tradableMarkets],
  )
  const allPicked = totalPicked === marketCount && marketCount > 0
  const exceedsBalance =
    isConnected && stakeNum > 0 && BigInt(Math.round(stakeNum * 1e18)) > walletUsdc

  // -- Build bets array in batch market order --
  const buildBets = useCallback((): BetDirection[] => {
    return marketIds.map(id => {
      const p = picks[id]
      if (p === 'up') return 'UP'
      return 'DOWN'
    })
  }, [marketIds, picks])

  // -- Validate handler --
  const onValidate = useCallback(() => {
    if (!activeBatch || !configHash || !isConnected || !allPicked) return
    if (!meetsMinimum || exceedsBalance) return
    if (flow !== 'idle') return

    const bets = buildBets()
    const depositAmount = BigInt(Math.round(stakeNum * 1e18))
    const marketCountForBitmap = activeBatch.marketCount || marketIds.length

    setFlow('approving') // optimistic — useJoinBatch will reconcile

    join({
      batchId: BigInt(activeBatch.id),
      configHash,
      depositAmount,
      bets,
      marketCount: marketCountForBitmap,
    })
  }, [
    activeBatch,
    configHash,
    isConnected,
    allPicked,
    meetsMinimum,
    exceedsBalance,
    flow,
    buildBets,
    stakeNum,
    marketIds,
    join,
  ])

  // -- Retry reveal --
  const onRetryReveal = useCallback(async () => {
    if (!encodedBitmap || !bitmapHash || !activeBatch) {
      // We lost the bitmap from join state. Re-encode from current picks.
      if (!activeBatch) return
      const bets = buildBets()
      const result = await submitBitmap({
        batchId: activeBatch.id,
        bitmap: new Uint8Array(0), // placeholder — useSubmitBitmap.submitBets is the right call
        bitmapHash: ('0x' + '00'.repeat(32)) as `0x${string}`,
      }).catch(() => null)
      if (result && result.acceptedCount > 0) {
        setFlow('committed')
      }
      setRevealRetryCount(n => n + 1)
      return
    }
    setFlow('publishing')
    try {
      const result = await submitBitmap({
        batchId: activeBatch.id,
        bitmap: encodedBitmap,
        bitmapHash,
      })
      if (result.acceptedCount > 0) {
        setFlow('committed')
      } else {
        setFlow('reveal-failed')
      }
    } catch {
      setFlow('reveal-failed')
    }
    setRevealRetryCount(n => n + 1)
  }, [encodedBitmap, bitmapHash, activeBatch, buildBets, submitBitmap])

  // -- Loading / not-found --
  if (isRegistryLoading && !initialSource) {
    return <GeneralLoader height="70vh" />
  }
  if (!source) {
    return (
      <div className="px-6 lg:px-12 py-12">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-black text-black mb-2">
            {t('source_detail.source_not_found')}
          </h1>
          <p style={{ color: APPLE_TEXT_SECONDARY }} className="mb-4">
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

  // -- Derived view-data --
  const valueLabel = source.valueLabel || 'TVL'
  const aggLabel = source.isPrice ? 'aggregate' : `total ${valueLabel.toLowerCase()}`
  const aggValue = formatBigUsd(aggregateValue(curatedMarkets))
  const showEmpty = !isSnapshotLoading && curatedMarkets.length === 0
  const sourceLogo = source.logo

  const displayError = joinError || submitError

  // Validate button copy state-aware
  const validateLabel = useMemo(() => {
    if (!isConnected) return 'Connect wallet'
    if (flow === 'approving') return 'Approving…'
    if (flow === 'committing') return 'Committing…'
    if (flow === 'publishing') return 'Publishing…'
    if (flow === 'committed') return 'In custody'
    if (flow === 'reveal-failed') return 'Retry reveal'
    if (roundPhase === 'absent') return 'No round yet'
    if (isBetweenRounds) return 'Next round opening'
    if (!allPicked) return `${totalPicked} / ${marketCount} chosen`
    if (!meetsMinimum) return `Min ${formatUsdDollars(MIN_PER_MARKET)} per market`
    if (exceedsBalance) return 'Insufficient balance'
    return 'Validate'
  }, [
    isConnected,
    roundPhase,
    isBetweenRounds,
    flow,
    allPicked,
    totalPicked,
    marketCount,
    meetsMinimum,
    exceedsBalance,
  ])

  const validateEnabled =
    isConnected &&
    isBettingOpen &&
    allPicked &&
    meetsMinimum &&
    !exceedsBalance &&
    (flow === 'idle' || flow === 'reveal-failed')

  const isProcessing = flow === 'approving' || flow === 'committing' || flow === 'publishing'

  // Validate pill colors. Computed via `(flow as FlowStep)` so narrowing from
  // `validateEnabled` doesn't kill the committed/reveal-failed branches.
  const flowForColor = flow as FlowStep
  const validateBgColor = !validateEnabled
    ? APPLE_CHIP_BG
    : flowForColor === 'committed'
      ? APPLE_GREEN
      : flowForColor === 'reveal-failed'
        ? '#F5A623'
        : APPLE_BLUE
  const validateTextColor = !validateEnabled ? APPLE_TEXT_SECONDARY : '#FFFFFF'

  const onValidateClick = () => {
    if (!isConnected) {
      handleConnectWallet()
      return
    }
    if (flow === 'reveal-failed') {
      onRetryReveal()
      return
    }
    onValidate()
  }

  // The chart stays mounted across asset clicks — useQuery + keepPreviousData
  // keeps the old candles visible while the next asset's history loads, and
  // hover-prefetch warms the cache so the swap is instant on click.

  const focusedMarket =
    curatedMarkets.find(m => m.assetId === selectedAssetId) ?? curatedMarkets[0] ?? null

  const getPointsFor = useCallback(
    (assetId: string): HistoryPoint[] | undefined => historyByAsset?.get(assetId),
    [historyByAsset],
  )

  // Warm the big-chart cache for an asset before the user clicks. Uses the
  // currently selected timeframe so the prefetch hits the cache regardless of
  // whether the user is still on '1h' or switched to '5m'/'15m'/'1d'.
  const prefetchChartFor = useCallback(
    (assetId: string) => {
      queryClient.prefetchQuery(chartHistoryQueryOptions(sourceId, assetId, chartTimeframe))
    },
    [queryClient, sourceId, chartTimeframe],
  )

  // -- Layout --
  const content = (
    <div className="flex-1 min-w-0 flex flex-col" style={{ background: APPLE_BG }}>
      <SourceTabNav sourceId={sourceId} activeTab="overview" />

      <CompactHero
        name={source.name}
        description={source.description}
        logo={sourceLogo}
        brandBg={source.brandBg}
        aggValue={aggValue}
        aggLabel={aggLabel}
        roundPhase={roundPhase}
        remainingSecs={remainingSecs}
        bettingEnd={bettingEnd}
      />

      <div className="w-full px-4 md:px-6 pb-10 flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Main column — big candle + grid of mini cards */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {displayError && (
            <ErrorBar message={displayError} onDismiss={() => resetJoin()} />
          )}

          {showEmpty ? (
            <IndexingNotice />
          ) : (
            <>
              {/* Big candle chart — renders as soon as its own history lands.
                  Don't gate on the bulk-history endpoint (which can be slow or
                  502 on overloaded sources); each chart owns its own loader. */}
              {focusedMarket && (
                <MarketCandleChart
                  sourceId={sourceId}
                  source={source}
                  market={focusedMarket}
                  roundOpenAt={roundOpenAt}
                  roundCloseAt={roundCloseAt}
                  resolved={resolved}
                  timeframe={chartTimeframe}
                  onTimeframeChange={setChartTimeframe}
                />
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Always show the curated 10 so the logos are visible even
                    when the live batch's marketIds don't intersect the curated
                    allowlist. Picks only fire for markets that are actually in
                    the active batch — the rest are locked and informational. */}
                {curatedMarkets.map((market) => {
                    const inActiveBatch =
                      !!activeBatch && marketIds.includes(market.assetId)
                    const isInteractive = inActiveBatch && roundPhase === 'open'
                    return (
                      <HumanMarketCard
                        key={market.assetId}
                        sourceId={sourceId}
                        source={source}
                        market={market}
                        pick={picks[market.assetId]}
                        onPick={isInteractive ? onPick : () => { /* picks queued for next round */ }}
                        locked={!isInteractive || (flow !== 'idle' && flow !== 'reveal-failed')}
                        revealFailed={flow === 'reveal-failed'}
                        onRetryReveal={onRetryReveal}
                        roundSettling={isRoundSettling}
                        roundOpenAt={roundOpenAt}
                        roundCloseAt={roundCloseAt}
                        resolved={resolved}
                        selected={(selectedAssetId ?? focusedMarket?.assetId ?? null) === market.assetId}
                        onSelect={() => setSelectedAssetId(market.assetId)}
                        onPrefetch={() => prefetchChartFor(market.assetId)}
                        points={getPointsFor(market.assetId)}
                      />
                    )
                  })}
              </div>
            </>
          )}

          {flow === 'reveal-failed' && (
            <RevealFailedBanner
              retryCount={revealRetryCount}
              isSubmitting={isSubmitting}
              onRetry={onRetryReveal}
            />
          )}
        </div>

        {/* Right rail — entry card + positions stacked, hidden on mobile (MobileValidate covers entry) */}
        <aside
          className="hidden lg:block shrink-0"
          style={{ width: 320 }}
        >
          <div
            className="lg:sticky"
            style={{
              top: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              maxHeight: 'calc(100vh - 32px)',
            }}
          >
            <EntryCard
              roundPhase={roundPhase}
              remainingSecs={remainingSecs}
              bettingEnd={bettingEnd}
              totalPicked={totalPicked}
              marketCount={marketCount}
              stakeInput={stakeInput}
              setStakeInput={setStakeInput}
              perMarketStake={perMarketStake}
              stakeNum={stakeNum}
              meetsMinimum={meetsMinimum}
              exceedsBalance={exceedsBalance}
              walletUsdc={walletUsdc}
              isConnected={isConnected}
              hasLowGas={hasLowGas}
              flow={flow}
              isProcessing={isProcessing}
              validateLabel={validateLabel}
              validateEnabled={validateEnabled}
              onValidate={onValidateClick}
              inputDisabled={flow !== 'idle' && flow !== 'reveal-failed'}
            />
            <PositionsCard
              isConnected={isConnected}
              positions={sourcePositions}
              currentCommit={currentCommit}
            />
          </div>
        </aside>
      </div>

      <MobileValidate
        validateBg={validateBgColor}
        validateColor={validateTextColor}
        validateEnabled={validateEnabled}
        isProcessing={isProcessing}
        flow={flow}
        label={validateLabel}
        onClick={onValidateClick}
      />

      <HumanTradingOnboarding
        sourceId={sourceId}
        isConnected={isConnected}
        hasFunds={isConnected && walletUsdc > 0n && !hasLowGas}
        picksCount={totalPicked}
        marketCount={marketCount}
        isCommitted={flow === 'committed'}
        isProcessing={isProcessing}
        isBettingOpen={isBettingOpen}
      />

      <style>{`
        @keyframes gm-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.015); }
        }
        @keyframes gm-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )

  return hideSidebar ? content : <div className="flex">{content}</div>
}

// ── Compact hero: one row, logo + name + aggregate + round phase chip ────────

type RoundPhase = 'open' | 'pending' | 'locked' | 'settling' | 'absent'

function CompactHero({
  name,
  description,
  logo,
  brandBg,
  aggValue,
  aggLabel,
  roundPhase,
  remainingSecs,
  bettingEnd,
}: {
  name: string
  description: string
  logo: string
  brandBg: string
  aggValue: string
  aggLabel: string
  roundPhase: RoundPhase
  remainingSecs: number
  bettingEnd: string | null
}) {
  const [logoBroken, setLogoBroken] = useState(false)
  const hasLogo = !!logo && !logoBroken

  const phaseLabel =
    roundPhase === 'open'
      ? bettingEnd ? `Round · ${formatCountdown(remainingSecs)}` : 'Round'
      : roundPhase === 'pending'
        ? 'Next round opening'
        : roundPhase === 'locked'
          ? 'Locked'
          : roundPhase === 'settling'
            ? 'Settling'
            : 'No round yet'
  const phaseColor =
    roundPhase === 'open'
      ? remainingSecs > 0 && remainingSecs < 60 ? APPLE_RED : APPLE_TEXT
      : APPLE_TEXT_SECONDARY

  return (
    <header className="w-full px-4 md:px-6 pt-4 pb-3 flex items-center gap-3">
      {hasLogo && (
        <div
          className="shrink-0 inline-flex items-center justify-center overflow-hidden"
          style={{
            width: 36,
            height: 36,
            background: brandBg || '#000',
            borderRadius: 9,
          }}
          aria-hidden
        >
          <Image
            src={logo}
            alt=""
            width={72}
            height={30}
            className="max-h-[28px] max-w-[80%] object-contain"
            priority
            onError={() => setLogoBroken(true)}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1
          className="truncate"
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 'clamp(18px, 2.2vw, 22px)',
            fontWeight: 600,
            letterSpacing: '-0.022em',
            lineHeight: 1.15,
            color: APPLE_TEXT,
            margin: 0,
          }}
        >
          {name}
        </h1>
        {description && (
          <p
            className="truncate hidden sm:block"
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 12,
              lineHeight: 1.4,
              letterSpacing: '-0.016em',
              color: APPLE_TEXT_SECONDARY,
              margin: 0,
              maxWidth: 540,
            }}
          >
            {description}
          </p>
        )}
      </div>
      <div className="hidden md:flex flex-col items-end shrink-0" style={{ minWidth: 110 }}>
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: '-0.022em',
            color: APPLE_TEXT,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
        >
          {aggValue}
        </span>
        <span
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 10.5,
            letterSpacing: '-0.016em',
            color: APPLE_TEXT_SECONDARY,
            marginTop: 1,
          }}
        >
          {aggLabel}
        </span>
      </div>
      <div
        className="shrink-0"
        style={{
          padding: '5px 12px',
          borderRadius: 980,
          background: APPLE_CHIP_BG,
          fontFamily: FONT_TEXT,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '-0.016em',
          color: phaseColor,
          fontVariantNumeric: 'tabular-nums',
          transition: `color 250ms ${EASE_DEFAULT}`,
        }}
      >
        {phaseLabel}
      </div>
    </header>
  )
}

// ── Right-rail entry: countdown, picks progress, stake, validate ─────────────

function EntryCard({
  roundPhase,
  remainingSecs,
  bettingEnd,
  totalPicked,
  marketCount,
  stakeInput,
  setStakeInput,
  perMarketStake,
  stakeNum,
  meetsMinimum,
  exceedsBalance,
  walletUsdc,
  isConnected,
  hasLowGas,
  flow,
  isProcessing,
  validateLabel,
  validateEnabled,
  onValidate,
  inputDisabled,
}: {
  roundPhase: RoundPhase
  remainingSecs: number
  bettingEnd: string | null
  totalPicked: number
  marketCount: number
  stakeInput: string
  setStakeInput: (v: string) => void
  perMarketStake: number
  stakeNum: number
  meetsMinimum: boolean
  exceedsBalance: boolean
  walletUsdc: bigint
  isConnected: boolean
  hasLowGas: boolean
  flow: FlowStep
  isProcessing: boolean
  validateLabel: string
  validateEnabled: boolean
  onValidate: () => void
  inputDisabled: boolean
}) {
  const balanceHuman = parseFloat(formatUnits(walletUsdc, VISION_USDC_DECIMALS))
  const validateBg = !validateEnabled
    ? APPLE_CHIP_BG
    : flow === 'committed'
      ? APPLE_GREEN
      : flow === 'reveal-failed'
        ? '#F5A623'
        : APPLE_BLUE
  const validateColor = !validateEnabled ? APPLE_TEXT_SECONDARY : '#FFFFFF'
  const countdownColor =
    roundPhase === 'open' && remainingSecs > 0 && remainingSecs < 60
      ? APPLE_RED
      : APPLE_TEXT

  return (
    <div
      style={{
        background: APPLE_PANEL,
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 16,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        padding: '16px 18px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
        {/* Round phase + countdown */}
        <div className="flex items-baseline justify-between">
          <span
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '+0.011em',
              color: APPLE_TEXT_SECONDARY,
              textTransform: 'uppercase',
            }}
          >
            {roundPhase === 'open'
              ? 'Round closes in'
              : roundPhase === 'pending'
                ? 'Next round'
                : roundPhase === 'locked'
                  ? 'Locked'
                  : roundPhase === 'settling'
                    ? 'Settling'
                    : 'Status'}
          </span>
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 22,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.022em',
              color: countdownColor,
              transition: `color 250ms ${EASE_DEFAULT}`,
            }}
          >
            {roundPhase === 'open' && bettingEnd
              ? formatCountdown(remainingSecs)
              : roundPhase === 'absent'
                ? '—'
                : 'soon'}
          </span>
        </div>

        {/* Picks progress */}
        <div className="flex items-baseline justify-between">
          <span
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 13,
              color: APPLE_TEXT_SECONDARY,
              letterSpacing: '-0.016em',
            }}
          >
            Chosen
          </span>
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 17,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.016em',
              color: APPLE_TEXT,
            }}
          >
            {totalPicked}
            <span style={{ color: APPLE_TEXT_SECONDARY }}> / {marketCount || '—'}</span>
          </span>
        </div>

        {/* Stake input — compact */}
        <div
          data-onboarding-target="stake-row"
          style={{
            background: APPLE_CHIP_BG,
            borderRadius: 12,
            padding: '12px 14px',
            opacity: inputDisabled ? 0.6 : 1,
            pointerEvents: inputDisabled ? 'none' : undefined,
            transition: `opacity 250ms ${EASE_DEFAULT}`,
          }}
        >
          <div className="flex items-center justify-between">
            <span
              style={{
                fontFamily: FONT_TEXT,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '+0.011em',
                textTransform: 'uppercase',
                color: APPLE_TEXT_SECONDARY,
              }}
            >
              Stake
            </span>
            {isConnected && (
              <span
                style={{
                  fontFamily: FONT_TEXT,
                  fontSize: 11,
                  color: APPLE_TEXT_SECONDARY,
                  letterSpacing: '-0.016em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {balanceHuman.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 28,
                color: APPLE_TEXT,
                fontWeight: 400,
                letterSpacing: '-0.016em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              placeholder="10"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 28,
                color: APPLE_TEXT,
                fontWeight: 400,
                letterSpacing: '-0.016em',
                fontVariantNumeric: 'tabular-nums',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                width: '100%',
                padding: 0,
                appearance: 'textfield',
                MozAppearance: 'textfield',
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STAKE_QUICK_PICKS.map(amount => {
              const active = stakeNum === amount
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setStakeInput(String(amount))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 980,
                    background: active ? APPLE_BLUE : APPLE_PANEL,
                    color: active ? '#FFFFFF' : APPLE_TEXT,
                    fontFamily: FONT_TEXT,
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: '-0.016em',
                    fontVariantNumeric: 'tabular-nums',
                    border: '1px solid rgba(0,0,0,0.06)',
                    cursor: 'pointer',
                    transition: `background 200ms ${EASE_DEFAULT}, color 200ms ${EASE_DEFAULT}`,
                  }}
                >
                  ${amount}
                </button>
              )
            })}
          </div>
          {marketCount > 0 && (
            <p
              className="mt-2"
              style={{
                fontFamily: FONT_TEXT,
                fontSize: 11,
                color: APPLE_TEXT_SECONDARY,
                letterSpacing: '-0.016em',
                fontVariantNumeric: 'tabular-nums',
                margin: 0,
              }}
            >
              {formatUsdDollars(perMarketStake)} per market · {marketCount} markets
            </p>
          )}
          {marketCount > 0 && !meetsMinimum && stakeNum > 0 && (
            <p
              className="mt-1"
              style={{ fontFamily: FONT_TEXT, fontSize: 11, color: APPLE_RED, letterSpacing: '-0.016em', margin: 0 }}
            >
              Minimum {formatUsdDollars(MIN_PER_MARKET)} per market.
            </p>
          )}
          {exceedsBalance && (
            <p
              className="mt-1"
              style={{ fontFamily: FONT_TEXT, fontSize: 11, color: APPLE_RED, letterSpacing: '-0.016em', margin: 0 }}
            >
              Stake exceeds wallet balance.
            </p>
          )}
        </div>

        {isConnected && hasLowGas && (
          <div
            className="flex items-center gap-1.5"
            style={{
              background: '#FFF6E5',
              border: '1px solid #F5C26B',
              borderRadius: 980,
              padding: '4px 10px',
              fontFamily: FONT_TEXT,
              fontSize: 11,
              fontWeight: 500,
              color: '#8A5A00',
              letterSpacing: '-0.016em',
              alignSelf: 'flex-start',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#F5A623' }} />
            Low gas
          </div>
        )}

        {/* Validate */}
        <button
          type="button"
          data-onboarding-target="validate-button"
          onClick={onValidate}
          disabled={!validateEnabled && !isProcessing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '12px 20px',
            borderRadius: 980,
            background: validateBg,
            color: validateColor,
            fontFamily: FONT_TEXT,
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: '-0.016em',
            border: 'none',
            cursor: validateEnabled ? 'pointer' : 'not-allowed',
            transition: `background 200ms ${EASE_DEFAULT}, color 200ms ${EASE_DEFAULT}`,
            animation:
              validateEnabled && flow === 'idle'
                ? `gm-pulse 1.2s ${EASE_DEFAULT} infinite`
                : undefined,
          }}
          onMouseEnter={(e) => {
            if (validateEnabled && flow === 'idle')
              e.currentTarget.style.background = APPLE_BLUE_HOVER
          }}
          onMouseLeave={(e) => {
            if (validateEnabled && flow === 'idle')
              e.currentTarget.style.background = APPLE_BLUE
          }}
        >
          {isProcessing && <Spinner />}
          {flow === 'committed' && <CheckMark />}
          <span>{validateLabel}</span>
        </button>
    </div>
  )
}

// ── Positions card: current commit + past resolved ticks ─────────────────────

interface CurrentCommit {
  batchId: number
  stakeUsd: number
  perMarketUsd: number
  ups: number
  downs: number
  marketCount: number
}

function PositionsCard({
  isConnected,
  positions,
  currentCommit,
}: {
  isConnected: boolean
  positions: SourcePositions
  /** Live on-chain commit for the round the user is sitting in. */
  currentCommit: CurrentCommit | null
}) {
  const { ticks, totalPnl } = positions
  const hasCurrent = currentCommit !== null
  const hasHistory = ticks.length > 0

  // Disconnected wallet — quiet prompt, no shouting.
  if (!isConnected) {
    return (
      <div style={cardShellStyle}>
        <CardHeader>Positions</CardHeader>
        <p style={cardMutedTextStyle}>Connect a wallet to see positions on this source.</p>
      </div>
    )
  }

  if (!hasCurrent && !hasHistory) {
    return (
      <div style={cardShellStyle}>
        <CardHeader>Positions</CardHeader>
        <p style={cardMutedTextStyle}>No positions yet on this source.</p>
      </div>
    )
  }

  const totalColor = totalPnl >= 0 ? APPLE_GREEN : APPLE_RED
  // Cap visible rows so the rail never grows beyond a reasonable height; the
  // sticky wrapper handles overflow but a single page of ten is the right rhythm.
  const visibleTicks = ticks.slice(0, 24)

  return (
    <div style={cardShellStyle}>
      <CardHeader>Positions</CardHeader>

      {hasCurrent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={positionRowStyle}>
            <span style={rowLabelStyle}>This round</span>
            <span style={rowValueStyle}>
              {formatUsdDollars(currentCommit!.stakeUsd)}
              <span style={{ color: APPLE_TEXT_SECONDARY, fontWeight: 400, marginLeft: 6 }}>
                · {formatUsdDollars(currentCommit!.perMarketUsd)}/mkt
              </span>
            </span>
          </div>
          {(currentCommit!.ups > 0 || currentCommit!.downs > 0) && (
            <div style={positionRowStyle}>
              <span style={rowLabelStyle}>Picks</span>
              <span
                style={{
                  ...rowValueStyle,
                  fontVariantNumeric: 'tabular-nums',
                  display: 'inline-flex',
                  gap: 10,
                }}
              >
                <span style={{ color: APPLE_GREEN }}>{currentCommit!.ups} UP</span>
                <span style={{ color: APPLE_TEXT_SECONDARY }}>·</span>
                <span style={{ color: APPLE_RED }}>{currentCommit!.downs} DOWN</span>
              </span>
            </div>
          )}
          <div style={positionRowStyle}>
            <span style={rowLabelStyle}>Batch</span>
            <span
              style={{
                ...rowLabelStyle,
                color: APPLE_TEXT,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              #{currentCommit!.batchId}
            </span>
          </div>
        </div>
      )}

      {hasHistory && (
        <>
          {hasCurrent && <div style={dividerStyle} />}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              overflowY: 'auto',
              maxHeight: 220,
              marginRight: -4,
              paddingRight: 4,
            }}
          >
            {visibleTicks.map(t => {
              const pnlColor = t.pnl > 0 ? APPLE_GREEN : t.pnl < 0 ? APPLE_RED : APPLE_TEXT_SECONDARY
              const verdict = t.won ? 'Won' : t.pnl < 0 ? 'Lost' : 'Tied'
              return (
                <div key={`${t.batchId}-${t.tickId}`} style={positionRowStyle}>
                  <span style={{ ...rowLabelStyle, fontVariantNumeric: 'tabular-nums' }}>
                    #{t.tickId}
                  </span>
                  <span style={{ ...rowLabelStyle, color: APPLE_TEXT }}>{verdict}</span>
                  <span
                    style={{
                      ...rowValueStyle,
                      color: pnlColor,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatPnl(t.pnl)}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {(hasHistory || hasCurrent) && (
        <>
          <div style={dividerStyle} />
          <div style={positionRowStyle}>
            <span style={rowLabelStyle}>Total P&amp;L</span>
            <span
              style={{
                ...rowValueStyle,
                color: totalColor,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatPnl(totalPnl)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: FONT_TEXT,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '+0.011em',
        textTransform: 'uppercase',
        color: APPLE_TEXT_SECONDARY,
      }}
    >
      {children}
    </div>
  )
}

function formatPnl(n: number): string {
  if (!isFinite(n)) return '—'
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  const abs = Math.abs(n)
  const body = abs >= 1000 ? abs.toFixed(0) : abs.toFixed(2)
  return `${sign}$${body}`
}

const cardShellStyle: CSSProperties = {
  background: APPLE_PANEL,
  border: '1px solid rgba(0,0,0,0.06)',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  padding: '14px 18px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const cardMutedTextStyle: CSSProperties = {
  fontFamily: FONT_TEXT,
  fontSize: 13,
  color: APPLE_TEXT_SECONDARY,
  letterSpacing: '-0.016em',
  margin: 0,
}

const positionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 8,
}

const rowLabelStyle: CSSProperties = {
  fontFamily: FONT_TEXT,
  fontSize: 13,
  color: APPLE_TEXT_SECONDARY,
  letterSpacing: '-0.016em',
}

const rowValueStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14,
  fontWeight: 500,
  color: APPLE_TEXT,
  letterSpacing: '-0.016em',
}

const dividerStyle: CSSProperties = {
  height: 1,
  background: 'rgba(0,0,0,0.06)',
  margin: '2px 0',
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        marginRight: 8,
        border: '1.5px solid rgba(255,255,255,0.4)',
        borderTopColor: '#FFFFFF',
        borderRadius: '50%',
        animation: `gm-spin 0.7s linear infinite`,
      }}
    />
  )
}

function CheckMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ marginRight: 6 }}
      aria-hidden
    >
      <path
        d="M3 7L6 10L11 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MobileValidate({
  validateBg,
  validateColor,
  validateEnabled,
  isProcessing,
  flow,
  label,
  onClick,
}: {
  validateBg: string
  validateColor: string
  validateEnabled: boolean
  isProcessing: boolean
  flow: FlowStep
  label: string
  onClick: () => void
}) {
  return (
    <div
      className="sm:hidden"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        padding: '12px 16px calc(env(safe-area-inset-bottom) + 12px)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        background: 'rgba(255,255,255,0.85)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        zIndex: 40,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!validateEnabled && !isProcessing}
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: 980,
          background: validateBg,
          color: validateColor,
          fontFamily: FONT_TEXT,
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: '-0.016em',
          border: 'none',
          cursor: validateEnabled ? 'pointer' : 'not-allowed',
          transition: `background 200ms ${EASE_DEFAULT}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isProcessing && <Spinner />}
        {flow === 'committed' && <CheckMark />}
        <span>{label}</span>
      </button>
    </div>
  )
}



// ── Notices ──────────────────────────────────────────────────────────────────

function ErrorBar({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      style={{
        background: '#FFF1F0',
        border: '1px solid #FBC4C1',
        borderRadius: 14,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <p
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 13,
          color: '#8A0F0F',
          letterSpacing: '-0.016em',
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#8A0F0F',
          fontFamily: FONT_TEXT,
          fontSize: 16,
          cursor: 'pointer',
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

function RevealFailedBanner({
  retryCount,
  isSubmitting,
  onRetry,
}: {
  retryCount: number
  isSubmitting: boolean
  onRetry: () => void
}) {
  return (
    <div
      style={{
        background: '#FFF6E5',
        border: '1px solid #F5C26B',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      <p
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 14,
          color: '#8A5A00',
          letterSpacing: '-0.016em',
          margin: 0,
          fontWeight: 500,
        }}
      >
        Commitment landed on-chain. Reveal is still retrying.
      </p>
      <p
        className="mt-1"
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 12,
          color: '#8A5A00',
          letterSpacing: '-0.016em',
          margin: '4px 0 0',
        }}
      >
        Attempts so far: {retryCount}. The stake is safe; the directions just need to reach the issuers.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isSubmitting}
        style={{
          marginTop: 10,
          padding: '8px 16px',
          borderRadius: 980,
          background: '#F5A623',
          color: '#FFFFFF',
          fontFamily: FONT_TEXT,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '-0.016em',
          border: 'none',
          cursor: isSubmitting ? 'wait' : 'pointer',
          opacity: isSubmitting ? 0.7 : 1,
        }}
      >
        {isSubmitting ? 'Retrying…' : 'Retry now'}
      </button>
    </div>
  )
}

function IndexingNotice() {
  return (
    <div
      style={{
        background: APPLE_PANEL,
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 18,
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 17,
          letterSpacing: '-0.022em',
          color: APPLE_TEXT_SECONDARY,
          margin: 0,
          lineHeight: 1.4706,
        }}
      >
        Markets indexing. Check back tomorrow.
      </p>
    </div>
  )
}


