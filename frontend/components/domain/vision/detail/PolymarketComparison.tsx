'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils/cn'

type Outcome = 'Up' | 'Down' | 'Flat' | 'Cancelled' | 'AllSameSide' | 'AllLosers'

interface ComparisonMarket {
  assetId: string
  name: string
  polyStart: number | null
  polyEnd: number | null
  polyChangePct: number | null
  polyCurrent: number | null
  polyVolume24h: number | null
  visionOutcome: Outcome
  visionWinSide: 'Up' | 'Down' | null
  visionUpPool: number
  visionDownPool: number
  visionTotalPool: number
  visionMultiplier: number | null
  visionGainPct: number | null
  leverageGap: number | null
}

interface BatchMeta {
  id: number
  bettingStart: string | null
  bettingEnd: string | null
  settledAt: string | null
  totalPool: number
  playerCount: number
  activeMarketCount: number
  totalSettled: number
}

interface Summary {
  avgPolyChangePct: number | null
  avgVisionGainPct: number | null
  biggestVisionGainPct: number | null
  biggestLeverageGap: number | null
}

interface ComparisonResponse {
  batch: BatchMeta | null
  markets: ComparisonMarket[]
  summary: Summary
  generatedAt: string
  source: 'live' | 'partial' | 'empty'
}

type SortKey = 'leverageGap' | 'visionGain' | 'polyChange' | 'pool'

const SORT_LABEL: Record<SortKey, string> = {
  leverageGap: 'Leverage gap',
  visionGain: 'Vision payout',
  polyChange: 'Polymarket move',
  pool: 'Pool size',
}

const GRID = 'grid grid-cols-[1fr_120px_140px_72px] md:grid-cols-[1fr_160px_180px_92px] gap-2 items-center'

function fmtPct(v: number | null | undefined, signed = true, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  const sign = signed ? (v > 0 ? '+' : v < 0 ? '−' : '') : ''
  return `${sign}${abs.toFixed(digits)}%`
}

function fmtImpliedProb(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function fmtMult(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(2)}×`
}

function fmtUsd(v: number): string {
  if (!Number.isFinite(v)) return '$0'
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
  if (v >= 100) return `$${v.toFixed(0)}`
  return `$${v.toFixed(2)}`
}

function fmtTimeWindow(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  return `${start.slice(11, 16)} → ${end.slice(11, 16)} UTC`
}

function fmtRelativeAt(iso: string | null, now: number): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '—'
  const delta = now - t
  if (delta < 60_000) return 'just now'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min ago`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} h ago`
  return `${Math.floor(delta / 86_400_000)} d ago`
}

function useNow(anchorIso: string | null): number {
  const anchorMs = anchorIso ? new Date(anchorIso).getTime() : 0
  const initial = Number.isFinite(anchorMs) && anchorMs > 0 ? anchorMs : 0
  const [now, setNow] = useState<number>(initial)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}

function sortVal(m: ComparisonMarket, k: SortKey): number | null {
  switch (k) {
    case 'leverageGap': return m.leverageGap
    case 'visionGain': return m.visionGainPct
    case 'polyChange': return m.polyChangePct == null ? null : Math.abs(m.polyChangePct)
    case 'pool': return m.visionTotalPool
  }
}

export function PolymarketComparison() {
  const { data, isLoading, isError } = useQuery<ComparisonResponse | null>({
    queryKey: ['polymarket-comparison', 150],
    queryFn: async () => {
      const res = await fetch('/api/vision/source/polymarket/comparison?limit=150')
      if (!res.ok) return null
      return res.json()
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const [sortKey, setSortKey] = useState<SortKey>('leverageGap')
  const [winnerOnly, setWinnerOnly] = useState(true)
  const now = useNow(data?.generatedAt ?? null)

  const rows = useMemo(() => {
    if (!data?.markets) return []
    let list = data.markets.slice()
    if (winnerOnly) list = list.filter((m) => m.visionWinSide !== null)
    list.sort((a, b) => {
      const av = sortVal(a, sortKey)
      const bv = sortVal(b, sortKey)
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return bv - av
    })
    return list
  }, [data, sortKey, winnerOnly])

  if (isLoading || (!data && !isError)) {
    return <ComparisonSkeleton />
  }

  if (!data || data.source === 'empty' || !data.batch) {
    return (
      <div className="bg-white border border-border-light px-5 py-8 text-center">
        <p className="text-[13px] text-text-muted">
          No settled batch yet. The first round will tell you what you suspected already.
        </p>
      </div>
    )
  }

  const { batch, summary } = data

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <DarkHeader
          tagline={`Batch #${batch.id} · ${fmtTimeWindow(batch.bettingStart, batch.bettingEnd)} · settled ${fmtRelativeAt(batch.settledAt, now)}`}
          title="Polymarket vs Vision"
          right={
            <div className="flex items-center gap-4 text-[11px] font-mono tabular-nums text-white/55">
              <span>{batch.playerCount} players</span>
              <span>{fmtUsd(batch.totalPool)} pool</span>
              <span>{data.markets.length} markets</span>
            </div>
          }
        />
        <SummaryStrip summary={summary} />
        <Toolbar
          sortKey={sortKey}
          onSortChange={setSortKey}
          winnerOnly={winnerOnly}
          onWinnerOnlyChange={setWinnerOnly}
        />
        <div className={cn(GRID, 'px-4 py-2 bg-[var(--surface)] border-y border-border-light text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted')}>
          <div>Market</div>
          <div className="text-right">Poly · 5-min</div>
          <div className="text-right">Vision · payout</div>
          <div className="text-right">Gap</div>
        </div>
        {rows.length === 0 ? (
          <div className="bg-white px-5 py-8 text-center">
            <p className="text-[13px] text-text-muted">
              No markets with both sides covered in this round. Try toggling the winner filter.
            </p>
          </div>
        ) : (
          <div className="bg-white">
            {rows.map((m) => <Row key={m.assetId} m={m} />)}
          </div>
        )}
      </Card>
      <Footnote batchId={batch.id} generatedAt={data.generatedAt} now={now} />
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border-light overflow-hidden">
      {children}
    </div>
  )
}

function DarkHeader({
  tagline,
  title,
  right,
}: {
  tagline: string
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-start sm:items-center justify-between gap-4 px-5 py-3 bg-terminal-dark flex-wrap sm:flex-nowrap">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
          {tagline}
        </div>
        <h3 className="text-[15px] font-bold text-white">{title}</h3>
      </div>
      {right}
    </div>
  )
}

function SummaryStrip({ summary }: { summary: Summary }) {
  const tiles: Array<{ label: string; value: string; loud?: boolean }> = [
    { label: 'Avg Polymarket move', value: fmtPct(summary.avgPolyChangePct, false, 2) },
    { label: 'Avg Vision payout', value: fmtPct(summary.avgVisionGainPct, true, 1), loud: true },
    { label: 'Biggest payout', value: fmtPct(summary.biggestVisionGainPct, true, 0), loud: true },
    { label: 'Widest gap', value: fmtPct(summary.biggestLeverageGap, false, 0), loud: true },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border-light">
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className={cn(
            'px-5 py-4',
            i > 0 && 'border-l border-border-light',
            i === 2 && 'border-l-0 md:border-l border-t md:border-t-0 border-border-light',
            i === 3 && 'border-t md:border-t-0',
          )}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
            {t.label}
          </div>
          <div className={cn(
            'mt-1 text-[22px] leading-none font-mono tabular-nums font-semibold',
            t.loud ? 'text-[color:rgb(0,113,227)]' : 'text-black',
          )}>
            {t.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function Toolbar({
  sortKey,
  onSortChange,
  winnerOnly,
  onWinnerOnlyChange,
}: {
  sortKey: SortKey
  onSortChange: (k: SortKey) => void
  winnerOnly: boolean
  onWinnerOnlyChange: (v: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-[var(--surface)] border-b border-border-light">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted mr-1">
        Sort
      </span>
      {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onSortChange(k)}
          aria-pressed={sortKey === k}
          className={cn(
            'h-7 px-3 text-[11px] font-medium tracking-wide rounded-sm border transition-colors',
            sortKey === k
              ? 'bg-black text-white border-black'
              : 'bg-white text-text-muted border-border-light hover:text-black hover:border-black/40',
          )}
        >
          {SORT_LABEL[k]}
        </button>
      ))}
      <div className="flex-1" />
      <label className="inline-flex items-center gap-2 text-[11px] text-text-muted cursor-pointer select-none">
        <input
          type="checkbox"
          checked={winnerOnly}
          onChange={(e) => onWinnerOnlyChange(e.target.checked)}
          className="accent-black"
        />
        Winner only
      </label>
    </div>
  )
}

function outcomeChip(m: ComparisonMarket): { glyph: string; label: string; color: string } {
  if (m.visionWinSide === 'Up') return { glyph: '▲', label: 'Up', color: 'rgb(34, 139, 78)' }
  if (m.visionWinSide === 'Down') return { glyph: '▼', label: 'Down', color: 'rgb(196, 50, 50)' }
  if (m.visionOutcome === 'Flat') return { glyph: '·', label: 'flat', color: 'var(--text-muted)' }
  if (m.visionOutcome === 'AllSameSide') return { glyph: '·', label: 'one-side', color: 'var(--text-muted)' }
  if (m.visionOutcome === 'AllLosers') return { glyph: '·', label: 'no win', color: 'var(--text-muted)' }
  return { glyph: '·', label: 'cancelled', color: 'var(--text-muted)' }
}

function Row({ m }: { m: ComparisonMarket }) {
  const polyHasName = !m.name.startsWith('0x')
  const displayName = polyHasName ? m.name : '(market name unavailable)'
  const polyUrl = polyHasName
    ? `https://polymarket.com/markets?_q=${encodeURIComponent(m.name)}`
    : null
  const out = outcomeChip(m)

  const polyChangeClass = m.polyChangePct == null
    ? 'text-text-muted'
    : m.polyChangePct > 0
    ? 'text-[color:rgb(34,139,78)]'
    : m.polyChangePct < 0
    ? 'text-[color:rgb(196,50,50)]'
    : 'text-text-muted'

  return (
    <div className={cn(GRID, 'px-4 py-2.5 border-b border-border-light last:border-b-0 hover:bg-[var(--surface)] transition-colors')}>
      <div className="min-w-0">
        {polyUrl ? (
          <a
            href={polyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[12px] text-black font-medium truncate hover:underline"
            title={m.name}
          >
            {truncate(displayName, 110)}
          </a>
        ) : (
          <span className="block text-[12px] text-text-muted truncate" title={m.assetId}>
            {displayName}
          </span>
        )}
        <div className="mt-0.5 text-[10px] font-mono tabular-nums text-text-muted">
          {m.polyVolume24h ? `${fmtUsd(m.polyVolume24h)} 24h` : 'no volume'}
          {' · '}
          implied {fmtImpliedProb(m.polyCurrent)}
        </div>
      </div>

      <div className="text-right">
        <div className={cn('text-[14px] font-mono tabular-nums font-semibold', polyChangeClass)}>
          {fmtPct(m.polyChangePct, true, 2)}
        </div>
        <div className="mt-0.5 text-[10px] font-mono tabular-nums text-text-muted">
          {m.polyStart != null && m.polyEnd != null
            ? `${fmtImpliedProb(m.polyStart)}→${fmtImpliedProb(m.polyEnd)}`
            : '—'}
        </div>
      </div>

      <div className="text-right">
        <div className={cn(
          'text-[14px] font-mono tabular-nums font-semibold',
          m.visionGainPct != null ? 'text-[color:rgb(0,113,227)]' : 'text-text-muted',
        )}>
          {fmtPct(m.visionGainPct, true, 0)}
        </div>
        <div className="mt-0.5 text-[10px] font-mono tabular-nums text-text-muted flex items-center gap-1 justify-end">
          <span style={{ color: out.color }}>{out.glyph}</span>
          <span>{fmtMult(m.visionMultiplier)}</span>
          <span className="text-text-muted/70">· {out.label}</span>
        </div>
      </div>

      <div className={cn(
        'text-right text-[12px] font-mono tabular-nums font-semibold',
        m.leverageGap != null ? 'text-black' : 'text-text-muted',
      )}>
        {fmtPct(m.leverageGap, false, 0)}
      </div>
    </div>
  )
}

function Footnote({ batchId, generatedAt, now }: { batchId: number; generatedAt: string; now: number }) {
  return (
    <p className="text-[11px] text-text-muted leading-relaxed max-w-[680px]">
      Polymarket move: change in the question’s implied probability between the start and end of Vision batch #{batchId}’s
      betting window. Vision payout: the parimutuel multiplier paid to the winning side of the same round, expressed as net
      gain. The gap is the simple subtraction. Five minutes either way. Generated {fmtRelativeAt(generatedAt, now)}.
    </p>
  )
}

function ComparisonSkeleton() {
  const bar = (w: string) => (
    <span className={cn('skeleton inline-block h-[12px] rounded', w)} />
  )
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="bg-white border border-border-light overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-terminal-dark">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
              Last settled batch
            </div>
            <h3 className="text-[15px] font-bold text-white">Polymarket vs Vision</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border-light">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn('px-5 py-4', i > 0 && 'border-l border-border-light')}>
              {bar('w-24')}
              <div className="mt-2">{bar('w-16')}</div>
            </div>
          ))}
        </div>
        <div className={cn(GRID, 'px-4 py-2 bg-[var(--surface)] border-y border-border-light')}>
          {bar('w-12')}<div className="text-right">{bar('w-16')}</div><div className="text-right">{bar('w-20')}</div><div className="text-right">{bar('w-10')}</div>
        </div>
        <div className="bg-white">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={cn(GRID, 'px-4 py-2.5 border-b border-border-light last:border-b-0')}>
              <div>{bar('w-3/4')}<div className="mt-1">{bar('w-1/2')}</div></div>
              <div className="text-right">{bar('w-14')}</div>
              <div className="text-right">{bar('w-16')}</div>
              <div className="text-right">{bar('w-10')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
