'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
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

// Hours-aware clock for the round timeline. Sources tick anywhere from 60s
// (twitch) to 86400s (ECB), so a bare m:ss would print "1440:00" for a daily
// round. Roll into H:MM:SS past the hour.
function formatClock(secs: number): string {
  if (secs <= 0) return '0:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
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

  // assetId → { resType, thresholdBps } — drives the green/red settlement
  // square on every chart on the page. Batch-config entries are the source
  // of truth for markets in the active batch. Curated markets that aren't
  // in the active batch (locked, "will be in next round") get a fallback
  // derived from the snapshot's 24h move — same heuristic the data-node
  // EMA uses to assign a resolution side. Without the fallback, the chart
  // shows nothing for ~90% of curated tiles on most sources.
  const resolutionByAsset = useMemo(() => {
    const m = new Map<string, { resType: string; thresholdBps: number }>()
    // First pass: batch-config truth.
    for (const row of batchConfig?.markets ?? []) {
      if (!row.assetId) continue
      m.set(row.assetId, {
        resType: (row.resolutionType ?? '').toUpperCase(),
        thresholdBps: row.thresholdBps ?? 0,
      })
    }
    // Second pass: snapshot fallback for everything else on screen.
    // Mirrors resolution_for_volatility in batch_engine: below the 20-bps
    // floor → up_0/down_0; above → up_x/down_x at the 24h move in bps.
    for (const market of curatedMarkets) {
      if (m.has(market.assetId)) continue
      const pct = parseFloat(market.changePct ?? '0')
      if (!isFinite(pct)) continue
      const abs = Math.abs(pct)
      if (abs < 0.2) {
        m.set(market.assetId, {
          resType: pct < 0 ? 'DOWN_0' : 'UP_0',
          thresholdBps: 0,
        })
      } else {
        m.set(market.assetId, {
          resType: pct < 0 ? 'DOWN_X' : 'UP_X',
          thresholdBps: Math.min(Math.round(abs * 100), 10000),
        })
      }
    }
    return m
  }, [batchConfig, curatedMarkets])

  // -- Curated markets that ARE in the current batch (only these are bettable) --
  // Driven by marketIds (source-keyed batch config), NOT activeBatch — so the
  // picker stays live during the window where /vision/batches lags behind the
  // live round on a tick rollover.
  const tradableMarkets: CuratedMarket[] = useMemo(() => {
    if (marketIds.length === 0) return []
    const result: CuratedMarket[] = []
    for (const m of curatedMarkets) {
      const idx = marketIds.indexOf(m.assetId)
      if (idx >= 0) result.push({ market: m, marketIndex: idx })
    }
    return result
  }, [curatedMarkets, marketIds])

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
    if (!rounds || rounds.length === 0) return null
    // Exact match when the two endpoints agree.
    if (activeBatch) {
      const exact = rounds.find(r => r.batchId === activeBatch.id)
      if (exact) return exact
    }
    // /vision/rounds is already filtered to this source and refetches every 5s,
    // while /vision/batches (activeBatch) refetches every 10s AND reads on-chain.
    // On a tick rollover the old batch pauses and a new one is created; for the
    // window where activeBatch still points at the just-paused batch, the exact
    // match misses and the whole timeline blanks to "—". Fall back to the
    // source's newest live betting round so the clock tracks the chain.
    const live = rounds
      .filter(r => r.status === 'betting' && !!r.bettingEnd)
      .sort((a, b) => b.batchId - a.batchId)
    if (live.length > 0) return live[0]
    return [...rounds].sort((a, b) => b.batchId - a.batchId)[0] ?? null
  }, [rounds, activeBatch])
  const bettingEnd = round?.bettingEnd ?? null
  const remainingSecs = useSharedCountdown(bettingEnd)

  // Single source of truth for "which batch is this page operating on". Prefer
  // the live round (fast 5s feed) over activeBatch (10s + on-chain reads), so
  // the join, the on-chain position read, and the timeline never target a
  // stale or just-paused batch during a tick rollover.
  const currentBatchId = round?.batchId ?? activeBatch?.id ?? null
  const currentConfigHash = (round?.configHash || activeBatch?.configHash || null) as
    | `0x${string}`
    | null

  // Round lifecycle. The oracle's /vision/rounds/active drops settled rounds,
  // so between ticks `round` briefly becomes null even though the batch is alive.
  // Treat that gap as "waiting for next round" — never as "no round is active".
  // Gate on currentBatchId (round-or-batch) rather than activeBatch alone, so a
  // lagging /vision/batches can't blank a live round into "absent".
  type RoundPhase = 'open' | 'pending' | 'locked' | 'settling' | 'absent'
  const roundPhase: RoundPhase = useMemo(() => {
    if (currentBatchId == null) return 'absent'
    if (!round) return 'pending'
    if (round.status === 'betting' && !!bettingEnd && remainingSecs > 0) return 'open'
    if (round.status === 'locked') return 'locked'
    if (round.status === 'settling' || round.status === 'settled') return 'settling'
    return 'pending'
  }, [currentBatchId, round, bettingEnd, remainingSecs])

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
  const { isJoined, position, refetch: refetchPosition } = usePlayerPosition(
    currentBatchId ?? undefined,
  )

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
    // One settled round is one tick. The issuer's profile builder can attach the
    // same round to more than one batch, so dedupe by (batch, round) before we
    // sum — a single loss must never read as two.
    const ticks: TickEntry[] = []
    const seen = new Set<string>()
    for (const b of batchesHere) {
      for (const t of b.ticks) {
        const key = `${b.batchId}-${t.tickId}`
        if (seen.has(key)) continue
        seen.add(key)
        ticks.push({ ...t, batchId: b.batchId })
      }
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
  // An undefined read (cold query key after navigation, or the deployment
  // address briefly resolving to 0x0) must NOT read as a real zero — that is
  // what made a freshly funded wallet show "0 USDC / stake exceeds balance"
  // right after a successful faucet claim and a page switch.
  const walletUsdcKnown = walletUsdcRaw !== undefined

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
    if (joinStep !== 'done' || !encodedBitmap || !bitmapHash || currentBatchId == null) return
    setFlow('publishing')
    submitBitmap({
      batchId: currentBatchId,
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
        // Positions rail reads from the player profile (60s poll). Refetch it
        // now so the bet the user just placed shows up immediately instead of
        // after the next poll.
        queryClient.invalidateQueries({ queryKey: ['player-profile'] })
      })
  }, [
    joinStep,
    encodedBitmap,
    bitmapHash,
    currentBatchId,
    submitBitmap,
    resetJoin,
    refetchPosition,
    queryClient,
  ])

  // If user already joined this round (refresh), decode their stored picks
  // so the rows mount in `committed` state with the correct direction visible.
  useEffect(() => {
    if (!isJoined || !position || currentBatchId == null) return
    if (flow === 'committed') return
    // Best-effort decode: we have the bitmap hash on-chain but not the bytes.
    // Try to fetch from the issuer; if unavailable, we still set flow=committed
    // but the rows can't recolor. Issuers expose bitmaps via the rounds bitmaps endpoint.
    let cancelled = false
    const decodeFromIssuer = async () => {
      try {
        const res = await fetch(
          `/api/vision/rounds/${currentBatchId}/bitmaps?player=${address}`,
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
  }, [isJoined, position, currentBatchId, address, marketIds, flow])

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
  const currentCommit = useMemo<CurrentCommit | null>(() => {
    if (!isJoined || !position || currentBatchId == null) return null
    const stakeUsd = Number(formatUnits(position.totalDeposited, VISION_USDC_DECIMALS))
    let ups = 0
    let downs = 0
    for (const m of tradableMarkets) {
      const p = picks[m.market.assetId]
      if (p === 'up') ups += 1
      else if (p === 'down') downs += 1
    }
    return {
      batchId: currentBatchId,
      stakeUsd,
      perMarketUsd:
        tradableMarkets.length > 0 ? stakeUsd / tradableMarkets.length : 0,
      ups,
      downs,
      marketCount: tradableMarkets.length,
    }
  }, [isJoined, position, currentBatchId, tradableMarkets, picks])

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
    isConnected && walletUsdcKnown && stakeNum > 0 && BigInt(Math.round(stakeNum * 1e18)) > walletUsdc

  // Optimistic commit: the instant the user confirms, reflect their stake and
  // picks in the timeline + positions card — don't wait for the on-chain
  // position read to catch up. `currentCommit` (chain truth) supersedes it as
  // soon as usePlayerPosition refetches, so a failed join cleanly reverts.
  const optimisticCommit = useMemo<CurrentCommit | null>(() => {
    if (flow === 'idle' || flow === 'reveal-failed') return null
    if (currentBatchId == null) return null
    let ups = 0
    let downs = 0
    for (const m of tradableMarkets) {
      const p = picks[m.market.assetId]
      if (p === 'up') ups += 1
      else if (p === 'down') downs += 1
    }
    return {
      batchId: currentBatchId,
      stakeUsd: stakeNum,
      perMarketUsd: tradableMarkets.length > 0 ? stakeNum / tradableMarkets.length : 0,
      ups,
      downs,
      marketCount: tradableMarkets.length,
    }
  }, [flow, currentBatchId, tradableMarkets, picks, stakeNum])

  const effectiveCommit = currentCommit ?? optimisticCommit

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
    if (currentBatchId == null || !currentConfigHash || !isConnected || !allPicked) return
    if (!meetsMinimum || exceedsBalance) return
    if (flow !== 'idle') return

    const bets = buildBets()
    const depositAmount = BigInt(Math.round(stakeNum * 1e18))
    const marketCountForBitmap = activeBatch?.marketCount || marketIds.length

    setFlow('approving') // optimistic — useJoinBatch will reconcile

    join({
      batchId: BigInt(currentBatchId),
      configHash: currentConfigHash,
      depositAmount,
      bets,
      marketCount: marketCountForBitmap,
    })
  }, [
    currentBatchId,
    currentConfigHash,
    activeBatch,
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
    if (currentBatchId == null) return
    if (!encodedBitmap || !bitmapHash) {
      // We lost the bitmap from join state. Re-encode from current picks.
      const result = await submitBitmap({
        batchId: currentBatchId,
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
        batchId: currentBatchId,
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
  }, [encodedBitmap, bitmapHash, currentBatchId, submitBitmap])

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
    if (roundPhase === 'absent') return 'Idle'
    if (isBetweenRounds) return 'Next round'
    if (!allPicked) return `${totalPicked} / ${marketCount} filled`
    if (!meetsMinimum) return `Min ${formatUsdDollars(MIN_PER_MARKET)} per market`
    if (exceedsBalance) return 'Insufficient balance'
    return 'Confirm'
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
  // Brand + aggregate value get folded into the tab nav row so the page
  // doesn't burn 70-ish vertical pixels on a hero block before the first
  // chart. The phase chip lives in the right-rail timeline now.
  const headerTrailing = (
    <span
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: '-0.022em',
        color: APPLE_TEXT,
        fontVariantNumeric: 'tabular-nums',
      }}
      title={aggLabel}
    >
      {aggValue}
    </span>
  )

  const content = (
    <div className="flex-1 min-w-0 flex flex-col" style={{ background: APPLE_BG }}>
      <SourceTabNav
        sourceId={sourceId}
        activeTab="overview"
        brand={{ name: source.name, logo: sourceLogo, brandBg: source.brandBg }}
        trailing={headerTrailing}
      />

      <div className="w-full px-4 md:px-6 pt-4 pb-10 flex flex-col lg:flex-row gap-4 lg:gap-6">
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
                  resolutionType={resolutionByAsset.get(focusedMarket.assetId)?.resType ?? null}
                  thresholdBps={resolutionByAsset.get(focusedMarket.assetId)?.thresholdBps ?? null}
                />
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Always show the curated 10 so the logos are visible even
                    when the live batch's marketIds don't intersect the curated
                    allowlist. Picks only fire for markets that are actually in
                    the active batch — the rest are locked and informational. */}
                {curatedMarkets.map((market) => {
                    const inActiveBatch =
                      currentBatchId != null && marketIds.includes(market.assetId)
                    const isInteractive = inActiveBatch && roundPhase === 'open'
                    const res = resolutionByAsset.get(market.assetId)
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
                        resolutionType={res?.resType ?? null}
                        thresholdBps={res?.thresholdBps ?? null}
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
              gap: 10,
              maxHeight: 'calc(100vh - 32px)',
            }}
          >
            <RoundTimeline
              currentTick={round?.batchId ?? activeBatch?.currentTick ?? 0}
              tickDuration={round?.timeframeSecs ?? activeBatch?.tickDuration ?? 0}
              remainingSecs={remainingSecs}
              roundPhase={roundPhase}
              poolNowUsd={(() => {
                const raw = round?.tvl ?? activeBatch?.tvl
                if (!raw || raw === '0') return null
                try { return Number(formatUnits(BigInt(raw), VISION_USDC_DECIMALS)) } catch { return null }
              })()}
              hasCurrentCommit={!!effectiveCommit}
              userStakeUsd={effectiveCommit?.stakeUsd ?? null}
            />
            <EntryCard
              stakeInput={stakeInput}
              setStakeInput={setStakeInput}
              perMarketStake={perMarketStake}
              stakeNum={stakeNum}
              marketCount={marketCount}
              meetsMinimum={meetsMinimum}
              exceedsBalance={exceedsBalance}
              walletUsdc={walletUsdc}
              balanceKnown={walletUsdcKnown}
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
              currentCommit={effectiveCommit}
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
        @keyframes gm-tick-slide {
          0% { transform: translateX(33.5%); opacity: 0; }
          60% { opacity: 1; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes gm-livedot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )

  return hideSidebar ? content : <div className="flex">{content}</div>
}

// ── Round phase typing kept for downstream callers ───────────────────────────

type RoundPhase = 'open' | 'pending' | 'locked' | 'settling' | 'absent'

// ── 3-box round timeline: LAST · NOW · NEXT ──────────────────────────────────
//
// The previous round (T-1) settles at the same instant the current round (T)
// closes for betting — settlement delay equals tick duration. So a single
// countdown drives both: when it hits zero, T-1 settles, T closes, T+1 opens.
// On `currentTick` increment, the boxes slide left and a fresh NEXT appears.

function RoundTimeline({
  currentTick,
  tickDuration,
  remainingSecs,
  roundPhase,
  poolNowUsd,
  hasCurrentCommit,
  userStakeUsd,
}: {
  /** Live batch/round id — increments each tick; drives the slide animation. */
  currentTick: number
  tickDuration: number
  remainingSecs: number
  roundPhase: RoundPhase
  /** Total committed by all players for the NOW round, in USDC. */
  poolNowUsd: number | null
  hasCurrentCommit: boolean
  /** The user's own deposit riding this round, in USDC. */
  userStakeUsd: number | null
}) {
  const [animKey, setAnimKey] = useState(0)
  const prevTickRef = useRef(currentTick)

  useEffect(() => {
    if (currentTick !== prevTickRef.current && prevTickRef.current > 0 && currentTick > 0) {
      setAnimKey(k => k + 1)
    }
    prevTickRef.current = currentTick
  }, [currentTick])

  const R = remainingSecs
  const D = tickDuration
  const nowOpen = roundPhase === 'open' && R > 0
  const urgentNow = nowOpen && R < 60
  const hasD = R > 0 && D > 0
  const clk = (s: number | null) => (s !== null && s > 0 ? formatClock(s) : '—')

  // Every round has two moments: betting CLOSES, then it SETTLES one tick later
  // (settlement delay = tick duration). The three boxes are consecutive rounds:
  //   LAST (T-1): already closed; settles when NOW closes        → R
  //   NOW  (T):   closes in R;        settles in R + D
  //   NEXT (T+1): closes in R + D;    settles in R + 2D
  const poolNowDisplay = poolNowUsd !== null && poolNowUsd > 0 ? formatBigUsd(String(poolNowUsd)) : '—'
  const youDisplay = userStakeUsd !== null && userStakeUsd > 0 ? formatUsdDollars(userStakeUsd) : null

  return (
    <div
      style={{
        background: APPLE_PANEL,
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 16,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        padding: 4,
        overflow: 'hidden',
      }}
    >
      <div
        key={animKey}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          animation: animKey > 0 ? `gm-tick-slide 480ms ${EASE_OUT}` : undefined,
        }}
      >
        <TimelineBox
          slot="LAST"
          closesValue={R > 0 ? 'Closed' : '—'}
          settlesValue={clk(R)}
          // Past-round pool isn't surfaced by /vision/rounds — keep it quiet.
          poolDisplay="—"
          // "IN" belongs only to the round the user demonstrably holds (NOW).
          // We don't track a distinct per-round position for the closing round,
          // so never light LAST off the current commit or stale history.
          youDisplay={null}
          isIn={false}
          tone="muted"
          live={false}
          roundId={null}
        />
        <TimelineBox
          slot="NOW"
          closesValue={clk(R)}
          settlesValue={clk(hasD ? R + D : null)}
          poolDisplay={poolNowDisplay}
          youDisplay={hasCurrentCommit ? youDisplay : null}
          isIn={hasCurrentCommit}
          tone={urgentNow ? 'urgent' : 'primary'}
          live={nowOpen}
          roundId={currentTick > 0 ? currentTick : null}
        />
        <TimelineBox
          slot="NEXT"
          closesValue={clk(hasD ? R + D : null)}
          settlesValue={clk(hasD ? R + 2 * D : null)}
          // Parimutuel auto-rollover: the live pool carries into the next round
          // unless players exit, so NEXT shows the current pool as its size.
          poolDisplay={poolNowDisplay}
          // The stake rides NEXT only after NOW settles without an exit — that
          // hasn't happened yet, so don't claim the user is "IN" the next round.
          youDisplay={null}
          isIn={false}
          tone="muted"
          live={false}
          roundId={null}
        />
      </div>
    </div>
  )
}

function TimelineBox({
  slot,
  closesValue,
  settlesValue,
  poolDisplay,
  youDisplay,
  isIn,
  tone,
  live,
  roundId,
}: {
  slot: 'LAST' | 'NOW' | 'NEXT'
  /** Pre-formatted "betting closes" countdown / word (e.g. "6:14", "Closed"). */
  closesValue: string
  /** Pre-formatted "round settles" countdown / word. */
  settlesValue: string
  /** Pool $ for this round, pre-formatted, or '—' when unknown. */
  poolDisplay: string
  /** The user's own deposit for this round, pre-formatted, or null. */
  youDisplay: string | null
  isIn: boolean
  tone: 'primary' | 'muted' | 'urgent'
  /** Pulsing green dot — only on the live NOW box. */
  live: boolean
  /** Round id shown small in the header, or null to hide. */
  roundId: number | null
}) {
  const slotColor =
    tone === 'urgent' ? APPLE_RED : tone === 'primary' ? APPLE_TEXT : APPLE_TEXT_SECONDARY
  const timerColor = tone === 'muted' ? APPLE_TEXT_SECONDARY : tone === 'urgent' ? APPLE_RED : APPLE_TEXT

  return (
    <div
      style={{
        background: tone === 'primary' || tone === 'urgent' ? APPLE_CHIP_BG : 'transparent',
        borderRadius: 12,
        padding: '8px 10px 9px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {live && (
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: APPLE_GREEN,
                flexShrink: 0,
                animation: 'gm-livedot 1.4s ease-in-out infinite',
              }}
            />
          )}
          <span
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: '+0.04em',
              textTransform: 'uppercase',
              color: slotColor,
            }}
          >
            {slot}
          </span>
        </span>
        {roundId !== null && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9.5,
              color: APPLE_TEXT_SECONDARY,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            #{roundId}
          </span>
        )}
      </div>

      {/* Two timers per round: when betting closes, and when it settles. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <TimerLine label="Closes" value={closesValue} color={timerColor} size={17} />
        <TimerLine label="Settles" value={settlesValue} color={timerColor} size={14} />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          marginTop: 1,
          paddingTop: 6,
          borderTop: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        <DataRow label="Pool" value={poolDisplay} dim={poolDisplay === '—'} />
        <DataRow
          label="You"
          value={youDisplay ?? '—'}
          dim={!isIn || youDisplay === null}
          accent={isIn && youDisplay !== null}
        />
      </div>
    </div>
  )
}

// One timer: a big mono countdown with its label beneath. Falls back to the
// display font for words like "Closed" / "—" so they don't read as numerals.
function TimerLine({
  label,
  value,
  color,
  size,
}: {
  label: string
  value: string
  color: string
  size: number
}) {
  const isNum = /\d/.test(value)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
      <span
        style={{
          fontFamily: isNum ? FONT_MONO : FONT_DISPLAY,
          fontSize: size,
          fontWeight: 600,
          letterSpacing: isNum ? '0' : '-0.022em',
          color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 8.5,
          fontWeight: 500,
          color: APPLE_TEXT_SECONDARY,
          letterSpacing: '+0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  )
}

// Binance-style label:value micro-row — gray uppercase label, mono tabular value.
function DataRow({
  label,
  value,
  dim,
  accent,
}: {
  label: string
  value: string
  dim?: boolean
  accent?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
      <span
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 8.5,
          fontWeight: 500,
          letterSpacing: '+0.02em',
          textTransform: 'uppercase',
          color: APPLE_TEXT_SECONDARY,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10.5,
          fontWeight: 600,
          color: accent ? APPLE_GREEN : dim ? APPLE_TEXT_SECONDARY : APPLE_TEXT,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '66%',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Right-rail entry: stake input + validate (countdown lives in RoundTimeline) ─

function EntryCard({
  stakeInput,
  setStakeInput,
  perMarketStake,
  stakeNum,
  marketCount,
  meetsMinimum,
  exceedsBalance,
  walletUsdc,
  balanceKnown,
  isConnected,
  hasLowGas,
  flow,
  isProcessing,
  validateLabel,
  validateEnabled,
  onValidate,
  inputDisabled,
}: {
  stakeInput: string
  setStakeInput: (v: string) => void
  perMarketStake: number
  stakeNum: number
  marketCount: number
  meetsMinimum: boolean
  exceedsBalance: boolean
  walletUsdc: bigint
  balanceKnown: boolean
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

  return (
    <div
      style={{
        background: APPLE_PANEL,
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 16,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        padding: '12px 14px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
        {/* Stake input — compact */}
        <div
          data-onboarding-target="stake-row"
          style={{
            background: APPLE_CHIP_BG,
            borderRadius: 12,
            padding: '10px 12px',
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
                {balanceKnown
                  ? `${balanceHuman.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
                  : '… USDC'}
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
              {formatUsdDollars(perMarketStake)} × {marketCount} markets
            </p>
          )}
          {marketCount > 0 && !meetsMinimum && stakeNum > 0 && (
            <p
              className="mt-1"
              style={{ fontFamily: FONT_TEXT, fontSize: 11, color: APPLE_RED, letterSpacing: '-0.016em', margin: 0 }}
            >
              Min {formatUsdDollars(MIN_PER_MARKET)} per market.
            </p>
          )}
          {exceedsBalance && (
            <p
              className="mt-1"
              style={{ fontFamily: FONT_TEXT, fontSize: 11, color: APPLE_RED, letterSpacing: '-0.016em', margin: 0 }}
            >
              Stake exceeds balance.
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
  const { totalPnl, ticks } = positions
  const hasCurrent = currentCommit !== null
  const recentTicks = ticks.slice(0, 6)

  if (!isConnected) {
    return (
      <div style={cardShellStyle}>
        <CardHeader>Positions</CardHeader>
        <p style={cardMutedTextStyle}>Connect a wallet to see positions on this source.</p>
      </div>
    )
  }

  if (!hasCurrent && ticks.length === 0) {
    return (
      <div style={cardShellStyle}>
        <CardHeader>Positions</CardHeader>
        <p style={cardMutedTextStyle}>Pick a direction on every market, set a stake, and your first round shows up here.</p>
      </div>
    )
  }

  const totalColor = totalPnl > 0 ? APPLE_GREEN : totalPnl < 0 ? APPLE_RED : APPLE_TEXT_SECONDARY

  return (
    <div style={cardShellStyle}>
      {/* The header number is REALIZED P&L across settled rounds — never the open
          round, which has no result yet. Label it so a past loss can't be read as
          the live bet losing, and hide it entirely until a round has settled. */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <CardHeader>Positions</CardHeader>
        {ticks.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontFamily: FONT_TEXT,
                fontSize: 9.5,
                fontWeight: 500,
                letterSpacing: '+0.04em',
                textTransform: 'uppercase',
                color: APPLE_TEXT_SECONDARY,
              }}
            >
              Realized
            </span>
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 15,
                fontWeight: 600,
                color: totalColor,
                letterSpacing: '-0.016em',
                fontVariantNumeric: 'tabular-nums',
              }}
              title="Realized profit and loss across settled rounds on this source"
            >
              {formatPnl(totalPnl)}
            </span>
          </span>
        )}
      </div>

      {hasCurrent && (
        <div
          style={{
            background: APPLE_CHIP_BG,
            borderRadius: 12,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
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
              This round
            </span>
            <span
              style={{
                fontFamily: FONT_TEXT,
                fontSize: 11,
                color: APPLE_TEXT_SECONDARY,
                letterSpacing: '-0.016em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Batch #{currentCommit!.batchId}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span
              style={{
                fontFamily: FONT_TEXT,
                fontSize: 8.5,
                fontWeight: 500,
                letterSpacing: '+0.04em',
                textTransform: 'uppercase',
                color: APPLE_TEXT_SECONDARY,
              }}
            >
              Deposited
            </span>
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 24,
                fontWeight: 600,
                color: APPLE_TEXT,
                letterSpacing: '-0.016em',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
              }}
            >
              {formatUsdDollars(currentCommit!.stakeUsd)}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              paddingTop: 7,
              borderTop: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <DataRow label="Per market" value={formatUsdDollars(currentCommit!.perMarketUsd)} />
            <DataRow label="Markets" value={String(currentCommit!.marketCount)} />
          </div>
          {(currentCommit!.ups > 0 || currentCommit!.downs > 0) && (
            <div style={{ display: 'inline-flex', gap: 6 }}>
              <PickPill count={currentCommit!.ups} dir="up" />
              <PickPill count={currentCommit!.downs} dir="down" />
            </div>
          )}
        </div>
      )}

      {recentTicks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '+0.011em',
              textTransform: 'uppercase',
              color: APPLE_TEXT_SECONDARY,
              marginBottom: 4,
            }}
          >
            Recent rounds
          </span>
          {recentTicks.map((tick, i) => {
            const color = tick.pnl > 0 ? APPLE_GREEN : tick.pnl < 0 ? APPLE_RED : APPLE_TEXT_SECONDARY
            return (
              <div
                key={`${tick.batchId}-${tick.tickId}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '7px 0',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: tick.won ? APPLE_GREEN : APPLE_RED,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: FONT_TEXT,
                      fontSize: 13,
                      color: APPLE_TEXT,
                      letterSpacing: '-0.016em',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    Round {tick.tickId}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 13,
                    fontWeight: 500,
                    color,
                    letterSpacing: '-0.016em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatPnl(tick.pnl)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// UP/DOWN pick count, rendered as a tinted pill rather than inline text.
function PickPill({ count, dir }: { count: number; dir: 'up' | 'down' }) {
  const color = dir === 'up' ? APPLE_GREEN : APPLE_RED
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: dir === 'up' ? 'rgba(40,205,65,0.10)' : 'rgba(255,59,48,0.10)',
        color,
        borderRadius: 980,
        padding: '2px 9px',
        fontFamily: FONT_TEXT,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '-0.012em',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {count} {dir === 'up' ? 'UP' : 'DOWN'}
    </span>
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


