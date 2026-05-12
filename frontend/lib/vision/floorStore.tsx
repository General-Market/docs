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

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ── Provider ──

interface FloorProviderProps {
  children: ReactNode
}

export function FloorProvider({ children }: FloorProviderProps) {
  const { data: batches = [] } = useBatches()
  const { data: rounds = [] } = useRounds()
  const { sources } = useSourceRegistry()

  // Internal queues — refs, do not trigger renders
  const tapeQueueRef = useRef<TapeRow[]>([])
  const flowQueueRef = useRef<FlowRow[]>([])

  // Visible slices — render the panes
  const [visibleTape, setVisibleTape] = useState<TapeRow[]>([])
  const [visibleFlow, setVisibleFlow] = useState<FlowRow[]>([])
  const [lastSettlementAt, setLastSettlementAt] = useState<number | null>(null)

  // SSE → enqueue
  const { connected } = useSettlementSSE({
    enabled: true,
    onSettlement: (e: SettlementEvent) => {
      const now = Date.now()
      const { up, down } = sumStakes(e.markets)
      const net: TapeRow['netDirection'] =
        up > down ? 'up' : down > up ? 'down' : 'flat'

      const tapeRow: TapeRow = {
        id: `${e.batchId}-${e.sourceId}`,
        batchId: e.batchId,
        sourceId: e.sourceId,
        marketCount: e.markets.length,
        totalUpStakeStr: up.toString(),
        totalDownStakeStr: down.toString(),
        netDirection: net,
        receivedAt: now,
        displayedAt: 0,
      }
      tapeQueueRef.current.push(tapeRow)

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
    const roundMap = new Map(rounds.map(r => [`${r.sourceId}-${r.batchId}`, r]))
    return batches.map(b => {
      const src = sourceMap.get(b.sourceId)
      const round = roundMap.get(`${b.sourceId}-${b.id}`)
      const bettingEndStr = round?.bettingEnd
      const bettingEnd = bettingEndStr ? Number(bettingEndStr) : null
      return {
        sourceId: b.sourceId,
        sourceName: src?.name ?? b.sourceId,
        sourceLogo: src?.logo ?? '',
        sourceBrandBg: src?.brandBg ?? '#1D1D1F',
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
