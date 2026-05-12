'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

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

function fmtPct(v: number | null | undefined, signed = true, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  const sign = signed ? (v > 0 ? '+' : v < 0 ? '−' : '') : ''
  if (abs < 0.01) return signed ? '0.00%' : '0.00%'
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
  // Format directly off the ISO string so server and client render identically,
  // regardless of locale or timezone. `toLocaleTimeString` is a hydration trap.
  const trim = (iso: string) => iso.slice(11, 16)
  return `${trim(start)} → ${trim(end)} UTC`
}

/** Pure relative-time formatter — pass `now` so server and client agree. */
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

/** "now" anchored to the server snapshot until client mounts, then live. */
function useNow(anchorIso: string | null | undefined): number {
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
      <div
        style={{
          border: '1px solid var(--apple-line)',
          borderRadius: 12,
          padding: 28,
          background: 'var(--apple-panel)',
          fontFamily: 'var(--apple-font-text)',
          color: 'var(--apple-text-secondary)',
          fontSize: 'var(--apple-fs-17)',
          letterSpacing: 'var(--apple-track-tight)',
        }}
      >
        No settled batch yet. The first round will tell you what you suspected already.
      </div>
    )
  }

  const { batch, summary } = data
  const now = useNow(data.generatedAt)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <HeadlineStats batch={batch} summary={summary} markets={data.markets} now={now} />

      <div
        role="toolbar"
        aria-label="Sort and filter"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          border: '1px solid var(--apple-line)',
          borderRadius: 980,
          background: 'var(--apple-panel)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--apple-text-tertiary)',
          }}
        >
          Sort
        </span>
        {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
          <SortPill key={k} active={sortKey === k} onClick={() => setSortKey(k)}>
            {SORT_LABEL[k]}
          </SortPill>
        ))}
        <div style={{ flex: 1 }} />
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            color: 'var(--apple-text-secondary)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={winnerOnly}
            onChange={(e) => setWinnerOnly(e.target.checked)}
            style={{ accentColor: 'rgb(0, 113, 227)' }}
          />
          Only rounds with a winner
        </label>
      </div>

      <div
        style={{
          border: '1px solid var(--apple-line)',
          borderRadius: 12,
          background: 'var(--surface, #fff)',
          overflow: 'hidden',
        }}
      >
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 180px 220px 120px',
            gap: 12,
            padding: '12px 16px',
            background: 'var(--apple-panel)',
            borderBottom: '1px solid var(--apple-line)',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--apple-text-tertiary)',
          }}
        >
          <span>Market</span>
          <span style={{ textAlign: 'right' }}>Polymarket · 5-min move</span>
          <span style={{ textAlign: 'right' }}>Vision · winner payout</span>
          <span style={{ textAlign: 'right' }}>Gap</span>
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              padding: 28,
              fontFamily: 'var(--apple-font-text)',
              color: 'var(--apple-text-secondary)',
              fontSize: 'var(--apple-fs-17)',
            }}
          >
            No markets with both sides covered in this round. Try toggling the winner filter.
          </div>
        ) : (
          rows.map((m) => <Row key={m.assetId} m={m} />)
        )}
      </div>

      <Footnote batch={batch} generatedAt={data.generatedAt} now={now} />
    </div>
  )
}

function ComparisonSkeleton() {
  const bar = (w: number) => (
    <div
      style={{
        height: 12,
        width: w,
        borderRadius: 4,
        background: 'var(--apple-line)',
        opacity: 0.6,
      }}
    />
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }} aria-busy="true">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          padding: 18,
          border: '1px solid var(--apple-line)',
          borderRadius: 12,
          background: 'var(--apple-panel)',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bar(64)}
            {bar(110)}
          </div>
        ))}
      </div>
      <div
        style={{
          border: '1px solid var(--apple-line)',
          borderRadius: 12,
          background: 'var(--surface, #fff)',
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 180px 220px 120px',
              gap: 12,
              padding: '14px 16px',
              borderBottom: '1px solid var(--apple-line)',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {bar(260)}
              {bar(120)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{bar(70)}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{bar(90)}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{bar(40)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function sortVal(m: ComparisonMarket, k: SortKey): number | null {
  switch (k) {
    case 'leverageGap':
      return m.leverageGap
    case 'visionGain':
      return m.visionGainPct
    case 'polyChange':
      return m.polyChangePct == null ? null : Math.abs(m.polyChangePct)
    case 'pool':
      return m.visionTotalPool
  }
}

function HeadlineStats({
  batch,
  summary,
  markets,
  now,
}: {
  batch: BatchMeta
  summary: Summary
  markets: ComparisonMarket[]
  now: number
}) {
  const settled = fmtRelativeAt(batch.settledAt, now)
  const stats: Array<{ label: string; value: string; muted?: boolean }> = [
    { label: 'Batch', value: `#${batch.id}` },
    { label: 'Window', value: fmtTimeWindow(batch.bettingStart, batch.bettingEnd) },
    { label: 'Settled', value: settled },
    { label: 'Pool', value: fmtUsd(batch.totalPool) },
    { label: 'Players', value: String(batch.playerCount) },
    { label: 'Active markets', value: String(markets.length) },
  ]
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
        padding: 18,
        border: '1px solid var(--apple-line)',
        borderRadius: 12,
        background: 'var(--apple-panel)',
      }}
    >
      {stats.map((s) => (
        <div key={s.label}>
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--apple-text-tertiary)',
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: 'var(--apple-font-display)',
              fontSize: 21,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {s.value}
          </div>
        </div>
      ))}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          paddingTop: 14,
          borderTop: '1px solid var(--apple-line)',
        }}
      >
        <ContrastTile
          label="Average Polymarket move"
          value={fmtPct(summary.avgPolyChangePct, false, 2)}
          tone="quiet"
        />
        <ContrastTile
          label="Average Vision payout"
          value={fmtPct(summary.avgVisionGainPct, true, 1)}
          tone="loud"
        />
        <ContrastTile
          label="Biggest Vision payout"
          value={fmtPct(summary.biggestVisionGainPct, true, 0)}
          tone="loud"
        />
        <ContrastTile
          label="Widest leverage gap"
          value={fmtPct(summary.biggestLeverageGap, false, 0)}
          tone="loud"
        />
      </div>
    </div>
  )
}

function ContrastTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'quiet' | 'loud'
}) {
  const color = tone === 'loud' ? 'rgb(0, 113, 227)' : 'var(--apple-text)'
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--apple-text-tertiary)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: 'var(--apple-font-display)',
          fontSize: 28,
          letterSpacing: 'var(--apple-track-tighter)',
          fontWeight: 600,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function SortPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '6px 12px',
        borderRadius: 980,
        border: '1px solid ' + (active ? 'var(--apple-text)' : 'var(--apple-line)'),
        background: active ? 'var(--apple-text)' : 'transparent',
        color: active ? 'var(--surface, #fff)' : 'var(--apple-text-secondary)',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 13,
        letterSpacing: 'var(--apple-track-tight)',
        cursor: 'pointer',
        transition: 'all 200ms var(--apple-ease-default)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function Row({ m }: { m: ComparisonMarket }) {
  const polyTone =
    m.polyChangePct == null
      ? 'var(--apple-text-tertiary)'
      : m.polyChangePct > 0
      ? 'rgb(52, 199, 89)'
      : m.polyChangePct < 0
      ? 'rgb(255, 59, 48)'
      : 'var(--apple-text-secondary)'
  const visionTone = 'rgb(0, 113, 227)'
  const polyUrl = `https://polymarket.com/markets?_q=${encodeURIComponent(m.name)}`

  return (
    <div
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 180px 220px 120px',
        gap: 12,
        padding: '14px 16px',
        borderBottom: '1px solid var(--apple-line)',
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <a
          href={polyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-15, 15px)',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={m.name}
        >
          {truncate(m.name, 100)}
        </a>
        <div
          style={{
            marginTop: 2,
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: 'var(--apple-text-tertiary)',
            letterSpacing: '+0.007em',
          }}
        >
          {m.polyVolume24h ? `${fmtUsd(m.polyVolume24h)} 24h` : 'no volume'}
          {' · current '}
          {fmtImpliedProb(m.polyCurrent)}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 19,
            fontWeight: 500,
            color: polyTone,
            letterSpacing: 'var(--apple-track-tight)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {fmtPct(m.polyChangePct, true, 2)}
        </div>
        <div
          style={{
            marginTop: 2,
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: 'var(--apple-text-tertiary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {m.polyStart != null && m.polyEnd != null
            ? `${fmtImpliedProb(m.polyStart)} → ${fmtImpliedProb(m.polyEnd)}`
            : 'no tick in window'}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 19,
            fontWeight: 500,
            color: m.visionGainPct != null ? visionTone : 'var(--apple-text-tertiary)',
            letterSpacing: 'var(--apple-track-tight)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {fmtPct(m.visionGainPct, true, 0)}
        </div>
        <div
          style={{
            marginTop: 2,
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: 'var(--apple-text-tertiary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {fmtMult(m.visionMultiplier)} · {outcomeLabel(m)}
        </div>
      </div>

      <div
        style={{
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontSize: 17,
          fontWeight: 500,
          letterSpacing: 'var(--apple-track-tight)',
          color: m.leverageGap != null ? 'var(--apple-text)' : 'var(--apple-text-tertiary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtPct(m.leverageGap, false, 0)}
      </div>
    </div>
  )
}

function outcomeLabel(m: ComparisonMarket): string {
  if (m.visionWinSide === 'Up') return '▲ Up won'
  if (m.visionWinSide === 'Down') return '▼ Down won'
  if (m.visionOutcome === 'Flat') return 'flat'
  if (m.visionOutcome === 'AllSameSide') return 'one-sided'
  if (m.visionOutcome === 'AllLosers') return 'no winner'
  return 'cancelled'
}

function Footnote({ batch, generatedAt, now }: { batch: BatchMeta; generatedAt: string; now: number }) {
  return (
    <div
      style={{
        fontFamily: 'var(--apple-font-text)',
        fontSize: 12,
        color: 'var(--apple-text-tertiary)',
        letterSpacing: '+0.007em',
        lineHeight: 1.5,
        maxWidth: 734,
      }}
    >
      Polymarket move: change in the question&apos;s implied probability between the start and end of Vision batch
      #{batch.id}&apos;s betting window. Vision payout: the parimutuel multiplier paid to the winning side of the same
      round, expressed as net gain. The gap is the simple subtraction. Five minutes either way. Generated{' '}
      {fmtRelativeAt(generatedAt, now)}.
    </div>
  )
}
