'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useBatches } from '@/hooks/vision/useBatches'
import { useRounds } from '@/hooks/vision/useRounds'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'
import {
  useSettlementSSE,
  type SettlementEvent,
  type MarketRatio,
} from '@/hooks/vision/useSettlementSSE'

// ── Types ──

export interface TapeRow {
  id: string
  batchId: number
  sourceId: string
  marketCount: number
  totalUpStakeStr: string
  totalDownStakeStr: string
  netDirection: 'up' | 'down' | 'flat'
  receivedAt: number
  displayedAt: number
  synthetic?: boolean
}

export interface FlowRow {
  id: string
  batchId: number
  sourceId: string
  assetId: string
  upStakeStr: string
  downStakeStr: string
  pctChangeBps: number
  outcome: string
  displayedAt: number
  synthetic?: boolean
}

export interface FloorBatch {
  sourceId: string
  sourceName: string
  sourceLogo: string
  sourceBrandBg: string
  batchId: number
  tickDuration: number
  playerCount: number
  tvlStr: string
  marketCount: number
  status: 'betting' | 'locked' | 'settling' | 'settled' | 'unknown'
  bettingEnd: number | null
}

export interface FloorDebug {
  visibleTape: number
  visibleFlow: number
  batches: number
  lastSettlementAt: number | null
  sseConnected: boolean
}

// ── Tunables ──

const TAPE_MAX = 200
const FLOW_MAX = 300
const TAPE_RELEASE_MIN_MS = 1500
const TAPE_RELEASE_MAX_MS = 3000
const TAPE_RELEASE_FAST_MIN_MS = 400
const TAPE_RELEASE_FAST_MAX_MS = 800
const TAPE_QUEUE_OVERFLOW = 30
const FLOW_BUCKET_MS = 80
const FLOW_BUCKET_TAKE = 3

// One unit of L3 USDC (18 decimals)
const ONE_USDC = 10n ** 18n
// Average bet size — used to size synthetic flow rows from TVL deltas
const AVG_BET_USDC = ONE_USDC * 5n
// Cap synth flow rows per single delta — keeps things smooth
const MAX_SYNTH_FLOW_PER_DELTA = 24

// ── Per-slice contexts (prevents cross-pane re-render cascades) ──

const FloorTapeContext = createContext<TapeRow[]>([])
const FloorFlowContext = createContext<FlowRow[]>([])
const FloorBatchesContext = createContext<FloorBatch[]>([])
const FloorDebugContext = createContext<FloorDebug>({
  visibleTape: 0,
  visibleFlow: 0,
  batches: 0,
  lastSettlementAt: null,
  sseConnected: false,
})

// ── Helpers ──

function sumStakes(markets: MarketRatio[]): { up: bigint; down: bigint } {
  let up = 0n
  let down = 0n
  for (const m of markets) {
    try {
      up += BigInt(m.upStake)
    } catch {
      // ignore malformed
    }
    try {
      down += BigInt(m.downStake)
    } catch {
      // ignore malformed
    }
  }
  return { up, down }
}

/**
 * Rounds API returns bettingEnd as an ISO date string like
 * "2026-05-12T22:00:00+00:00". Older code might emit unix seconds.
 * Accept either, return unix seconds.
 */
function parseBettingEnd(s: string | null | undefined): number | null {
  if (!s) return null
  const parsed = Date.parse(s)
  if (!isNaN(parsed)) return Math.floor(parsed / 1000)
  const n = Number(s)
  if (!isNaN(n) && n > 0) return n
  return null
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function safeBigInt(s: string): bigint {
  try {
    return BigInt(s || '0')
  } catch {
    return 0n
  }
}

// ── Provider ──

interface FloorProviderProps {
  children: ReactNode
}

interface PrevSnapshot {
  batchId: number
  tvl: bigint
  status: string
  marketCount: number
}

export function FloorProvider({ children }: FloorProviderProps) {
  const { data: batches = [] } = useBatches()
  const { data: rounds = [] } = useRounds()
  const { sources } = useSourceRegistry()

  // Internal queues — refs, do not trigger renders
  const tapeQueueRef = useRef<TapeRow[]>([])
  const flowQueueRef = useRef<FlowRow[]>([])
  // Previous per-source snapshot, used by the synth derivative below
  const prevSnapshotRef = useRef<Map<string, PrevSnapshot>>(new Map())
  // Monotonic counter so synthetic IDs never collide across polls
  const synthSeqRef = useRef(0)

  // Visible slices — render the panes
  const [visibleTape, setVisibleTape] = useState<TapeRow[]>([])
  const [visibleFlow, setVisibleFlow] = useState<FlowRow[]>([])
  const [lastSettlementAt, setLastSettlementAt] = useState<number | null>(null)

  // SSE → enqueue (when the settlement stream actually delivers, prefer it)
  const { connected } = useSettlementSSE({
    enabled: true,
    onSettlement: (e: SettlementEvent) => {
      const now = Date.now()
      const { up, down } = sumStakes(e.markets)
      const net: TapeRow['netDirection'] =
        up > down ? 'up' : down > up ? 'down' : 'flat'

      tapeQueueRef.current.push({
        id: `${e.batchId}-${e.sourceId}`,
        batchId: e.batchId,
        sourceId: e.sourceId,
        marketCount: e.markets.length,
        totalUpStakeStr: up.toString(),
        totalDownStakeStr: down.toString(),
        netDirection: net,
        receivedAt: now,
        displayedAt: 0,
      })

      const flowRows: FlowRow[] = e.markets.map(m => ({
        id: `${e.batchId}-${m.assetId}`,
        batchId: e.batchId,
        sourceId: e.sourceId,
        assetId: m.assetId,
        upStakeStr: m.upStake,
        downStakeStr: m.downStake,
        pctChangeBps: m.pctChangeBps,
        outcome: m.outcome,
        displayedAt: 0,
      }))
      flowQueueRef.current.push(...shuffle(flowRows))

      setLastSettlementAt(now)
    },
  })

  // Synth derivative — fold useBatches + useRounds deltas into tape/flow.
  // Runs every time the upstream queries refresh. Reads previous snapshot
  // from a ref so no extra renders.
  const firstPollRef = useRef(true)
  useEffect(() => {
    if (batches.length === 0) return
    const now = Date.now()
    const prev = prevSnapshotRef.current
    const isFirstPoll = firstPollRef.current
    firstPollRef.current = false
    const roundByKey = new Map<string, (typeof rounds)[number]>()
    for (const r of rounds) roundByKey.set(`${r.sourceId}-${r.batchId}`, r)

    const newTape: TapeRow[] = []
    const newFlow: FlowRow[] = []

    for (const b of batches) {
      const cur: PrevSnapshot = {
        batchId: b.id,
        tvl: safeBigInt(b.tvl),
        status: roundByKey.get(`${b.sourceId}-${b.id}`)?.status ?? 'unknown',
        marketCount: b.marketCount,
      }
      const before = prev.get(b.sourceId)
      prev.set(b.sourceId, cur)
      // On the very first poll, soft-seed: treat the current TVL as a delta
      // from zero so the flow pane wakes up immediately instead of waiting
      // for the next round of activity. Skip batches with no TVL.
      if (!before) {
        if (isFirstPoll && cur.tvl > 0n) {
          const seed: PrevSnapshot = {
            batchId: cur.batchId,
            tvl: 0n,
            status: cur.status,
            marketCount: cur.marketCount,
          }
          // Fall through with the soft baseline
          const synthBefore = seed
          const delta = cur.tvl - synthBefore.tvl
          if (delta > 0n) {
            const n = Math.min(
              MAX_SYNTH_FLOW_PER_DELTA,
              Math.max(1, Number(delta / AVG_BET_USDC) || 1),
            )
            const perRow = delta / BigInt(n)
            for (let i = 0; i < n; i++) {
              synthSeqRef.current += 1
              const upRatio = 40 + Math.floor(Math.random() * 21)
              const up = (perRow * BigInt(upRatio)) / 100n
              const down = perRow - up
              newFlow.push({
                id: `synth-flow-${b.sourceId}-${b.id}-${synthSeqRef.current}`,
                batchId: b.id,
                sourceId: b.sourceId,
                assetId: '·',
                upStakeStr: up.toString(),
                downStakeStr: down.toString(),
                pctChangeBps: 0,
                outcome: Math.random() > 0.5 ? 'Up' : 'Down',
                displayedAt: 0,
                synthetic: true,
              })
            }
          }
        }
        continue
      }

      // Batch rolled forward → previous one settled. Emit a synthetic tape row.
      if (before.batchId !== cur.batchId) {
        const total = before.tvl
        const upRatio = 30 + Math.floor(Math.random() * 41) // 30–70%
        const upPart = (total * BigInt(upRatio)) / 100n
        const downPart = total - upPart
        const net: TapeRow['netDirection'] =
          upPart === downPart ? 'flat' : upPart > downPart ? 'up' : 'down'
        synthSeqRef.current += 1
        newTape.push({
          id: `synth-tape-${b.sourceId}-${before.batchId}-${synthSeqRef.current}`,
          batchId: before.batchId,
          sourceId: b.sourceId,
          marketCount: before.marketCount,
          totalUpStakeStr: upPart.toString(),
          totalDownStakeStr: downPart.toString(),
          netDirection: net,
          receivedAt: now,
          displayedAt: 0,
          synthetic: true,
        })
        setLastSettlementAt(now)
      }

      // TVL increased → activity. Decompose the delta into synth flow rows.
      const delta = cur.tvl - before.tvl
      if (delta > 0n) {
        const n = Math.min(
          MAX_SYNTH_FLOW_PER_DELTA,
          Math.max(1, Number(delta / AVG_BET_USDC) || 1),
        )
        const perRow = delta / BigInt(n)
        for (let i = 0; i < n; i++) {
          synthSeqRef.current += 1
          // 40–60% to up side, rest to down. Theatre that sums to delta.
          const upRatio = 40 + Math.floor(Math.random() * 21)
          const up = (perRow * BigInt(upRatio)) / 100n
          const down = perRow - up
          newFlow.push({
            id: `synth-flow-${b.sourceId}-${b.id}-${synthSeqRef.current}`,
            batchId: b.id,
            sourceId: b.sourceId,
            assetId: '·',
            upStakeStr: up.toString(),
            downStakeStr: down.toString(),
            pctChangeBps: 0,
            outcome: Math.random() > 0.5 ? 'Up' : 'Down',
            displayedAt: 0,
            synthetic: true,
          })
        }
      }
    }

    if (newTape.length > 0) tapeQueueRef.current.push(...newTape)
    if (newFlow.length > 0) flowQueueRef.current.push(...shuffle(newFlow))
  }, [batches, rounds])

  // Decorrelator — release one tape row at jittered cadence
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    function release() {
      if (cancelled) return
      const q = tapeQueueRef.current
      if (q.length > 0) {
        const row = q.shift()!
        row.displayedAt = Date.now()
        setVisibleTape(prev => {
          const next = [row, ...prev]
          if (next.length > TAPE_MAX) next.length = TAPE_MAX
          return next
        })
      }
      const overflow = q.length > TAPE_QUEUE_OVERFLOW
      const min = overflow ? TAPE_RELEASE_FAST_MIN_MS : TAPE_RELEASE_MIN_MS
      const max = overflow ? TAPE_RELEASE_FAST_MAX_MS : TAPE_RELEASE_MAX_MS
      const next = min + Math.random() * (max - min)
      timer = setTimeout(release, next)
    }

    timer = setTimeout(release, 200)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  // Flow bucket — drain N rows per interval at fixed cadence
  useEffect(() => {
    const i = setInterval(() => {
      const q = flowQueueRef.current
      if (q.length === 0) return
      const take = Math.min(FLOW_BUCKET_TAKE, q.length)
      const now = Date.now()
      const taken = q.splice(0, take).map(r => ({ ...r, displayedAt: now }))
      setVisibleFlow(prev => {
        const next = [...taken, ...prev]
        if (next.length > FLOW_MAX) next.length = FLOW_MAX
        return next
      })
    }, FLOW_BUCKET_MS)
    return () => clearInterval(i)
  }, [])

  // Join batches + rounds + sources
  const floorBatches = useMemo<FloorBatch[]>(() => {
    if (batches.length === 0) return []
    const sourceMap = new Map(sources.map(s => [s.sourceId, s]))
    const roundMap = new Map<string, (typeof rounds)[number]>()
    for (const r of rounds.slice().sort((a, b) => b.batchId - a.batchId)) {
      if (!roundMap.has(r.sourceId)) roundMap.set(r.sourceId, r)
    }
    return batches.map(b => {
      const src = sourceMap.get(b.sourceId)
      const round = roundMap.get(b.sourceId)
      const bettingEnd = parseBettingEnd(round?.bettingEnd)
      return {
        sourceId: b.sourceId,
        sourceName: src?.name ?? b.sourceId,
        sourceLogo: src?.logo ?? '',
        sourceBrandBg: src?.brandBg ?? '#1d1d1f',
        batchId: b.id,
        tickDuration: b.tickDuration,
        playerCount: b.playerCount,
        tvlStr: b.tvl,
        marketCount: b.marketCount,
        status: round?.status ?? 'unknown',
        bettingEnd,
      }
    })
  }, [batches, rounds, sources])

  const debug = useMemo<FloorDebug>(
    () => ({
      visibleTape: visibleTape.length,
      visibleFlow: visibleFlow.length,
      batches: floorBatches.length,
      lastSettlementAt,
      sseConnected: connected,
    }),
    [visibleTape.length, visibleFlow.length, floorBatches.length, lastSettlementAt, connected],
  )

  return (
    <FloorBatchesContext.Provider value={floorBatches}>
      <FloorTapeContext.Provider value={visibleTape}>
        <FloorFlowContext.Provider value={visibleFlow}>
          <FloorDebugContext.Provider value={debug}>
            {children}
          </FloorDebugContext.Provider>
        </FloorFlowContext.Provider>
      </FloorTapeContext.Provider>
    </FloorBatchesContext.Provider>
  )
}

// ── Consumer hooks ──

export function useFloorTape(): TapeRow[] {
  return useContext(FloorTapeContext)
}

export function useFloorFlow(): FlowRow[] {
  return useContext(FloorFlowContext)
}

export function useFloorBatches(): FloorBatch[] {
  return useContext(FloorBatchesContext)
}

export function useFloorDebug(): FloorDebug {
  return useContext(FloorDebugContext)
}
