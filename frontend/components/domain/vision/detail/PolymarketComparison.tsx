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
  visionPctChangeBps: number
  visionTieBroken: boolean
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

// ─── Apple chrome tokens ─────────────────────────────────────────
const CARD_CLASS = 'rounded-[var(--apple-r-card)] border overflow-hidden'
const CARD_STYLE: React.CSSProperties = {
  borderColor: 'var(--apple-line)',
  background: 'var(--apple-panel)',
}

const APPLE_BLUE = '#0071E3'
const APPLE_GREEN = 'rgb(52, 199, 89)'
const APPLE_RED = 'rgb(255, 59, 48)'

const EYEBROW: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  letterSpacing: 'var(--apple-track-loose)',
  color: 'var(--apple-text-tertiary)',
  fontWeight: 600,
  textTransform: 'uppercase',
}

const NUM_DISPLAY: React.CSSProperties = {
  fontFamily: 'var(--apple-font-display)',
  letterSpacing: 'var(--apple-track-tighter)',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 500,
}

// ─── Formatters ──────────────────────────────────────────────────
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

// ─── Component ───────────────────────────────────────────────────
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
  const [realMovesOnly, setRealMovesOnly] = useState(true)
  const now = useNow(data?.generatedAt ?? null)

  const rows = useMemo(() => {
    if (!data?.markets) return []
    let list = data.markets.slice()
    if (realMovesOnly) {
      list = list.filter((m) => m.visionWinSide !== null && !m.visionTieBroken)
    }
    list.sort((a, b) => {
      const av = sortVal(a, sortKey)
      const bv = sortVal(b, sortKey)
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return bv - av
    })
    return list
  }, [data, sortKey, realMovesOnly])

  if (isLoading || (!data && !isError)) return <ComparisonSkeleton />

  if (!data || data.source === 'empty' || !data.batch) {
    return (
      <div className={CARD_CLASS} style={{ ...CARD_STYLE, padding: 28 }}>
        <p style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-17)',
          color: 'var(--apple-text-secondary)',
          letterSpacing: 'var(--apple-track-tight)',
          margin: 0,
        }}>
          No settled batch yet. The first round will tell you what you suspected already.
        </p>
      </div>
    )
  }

  const { batch, summary } = data

  return (
    <div className="flex flex-col gap-5">
      <ContrastHero batch={batch} summary={summary} now={now} />
      <ListCard
        rows={rows}
        sortKey={sortKey}
        onSortChange={setSortKey}
        realMovesOnly={realMovesOnly}
        onRealMovesOnlyChange={setRealMovesOnly}
      />
      <Footnote batchId={batch.id} generatedAt={data.generatedAt} now={now} />
    </div>
  )
}

// ─── Hero card: identity + four-number contrast ──────────────────
function ContrastHero({ batch, summary, now }: { batch: BatchMeta; summary: Summary; now: number }) {
  const tagline = `Batch #${batch.id} · ${fmtTimeWindow(batch.bettingStart, batch.bettingEnd)} · settled ${fmtRelativeAt(batch.settledAt, now)}`

  return (
    <div className={CARD_CLASS} style={{ ...CARD_STYLE, padding: 28 }}>
      <div className="flex flex-col gap-1">
        <span className="apple-pill apple-pill--external self-start" style={{ textTransform: 'uppercase' }}>
          last settled batch
        </span>
        <h2 className="mt-3" style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 'var(--apple-fs-28)',
          letterSpacing: 'var(--apple-track-tighter)',
          lineHeight: 1.1428,
          fontWeight: 600,
          color: 'var(--apple-text)',
          margin: 0,
        }}>
          Polymarket prices vs Vision payouts
        </h2>
        <p className="mt-1.5" style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-17)',
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text-secondary)',
          lineHeight: 1.47,
          margin: 0,
          maxWidth: '52ch',
        }}>
          Same questions, different time horizons. Polymarket prices over the trailing 24 hours. Vision multipliers from
          the five minutes inside it.
        </p>
        <p className="mt-1" style={{ ...EYEBROW, fontSize: 11, letterSpacing: 'var(--apple-track-loose)', color: 'var(--apple-text-tertiary)', fontWeight: 500, textTransform: 'none' }}>
          {tagline} · {batch.playerCount} players · {fmtUsd(batch.totalPool)} pool · {batch.activeMarketCount} markets
        </p>
      </div>

      <div
        className="mt-5 grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 18,
          padding: '18px 0 0',
          borderTop: '1px solid var(--apple-line)',
        }}
      >
        <ContrastTile label="Avg Polymarket move" value={fmtPct(summary.avgPolyChangePct, false, 2)} tone="quiet" />
        <ContrastTile label="Avg Vision payout" value={fmtPct(summary.avgVisionGainPct, true, 1)} tone="loud" />
        <ContrastTile label="Biggest payout" value={fmtPct(summary.biggestVisionGainPct, true, 0)} tone="loud" />
        <ContrastTile label="Widest gap" value={fmtPct(summary.biggestLeverageGap, false, 0)} tone="loud" />
      </div>
    </div>
  )
}

function ContrastTile({ label, value, tone }: { label: string; value: string; tone: 'quiet' | 'loud' }) {
  return (
    <div>
      <div style={EYEBROW}>{label}</div>
      <div
        className="mt-1"
        style={{
          ...NUM_DISPLAY,
          fontSize: 'var(--apple-fs-32, 32px)',
          color: tone === 'loud' ? APPLE_BLUE : 'var(--apple-text)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  )
}

// ─── List card: sort/filter toolbar + rows ───────────────────────
function ListCard({
  rows,
  sortKey,
  onSortChange,
  realMovesOnly,
  onRealMovesOnlyChange,
}: {
  rows: ComparisonMarket[]
  sortKey: SortKey
  onSortChange: (k: SortKey) => void
  realMovesOnly: boolean
  onRealMovesOnlyChange: (v: boolean) => void
}) {
  return (
    <div className={CARD_CLASS} style={CARD_STYLE}>
      <div
        className="flex flex-wrap items-center gap-2"
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--apple-line)',
        }}
      >
        <span style={{ ...EYEBROW, marginRight: 4 }}>Sort</span>
        {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
          <SortPill key={k} active={sortKey === k} onClick={() => onSortChange(k)}>
            {SORT_LABEL[k]}
          </SortPill>
        ))}
        <div className="flex-1" />
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text-secondary)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={realMovesOnly}
            onChange={(e) => onRealMovesOnlyChange(e.target.checked)}
            style={{ accentColor: APPLE_BLUE }}
          />
          Real moves only
        </label>
      </div>

      <div
        role="row"
        className="grid"
        style={{
          gridTemplateColumns: '1fr 160px 200px 100px',
          gap: 12,
          padding: '12px 20px',
          background: 'var(--apple-surface, transparent)',
          borderBottom: '1px solid var(--apple-line)',
        }}
      >
        <span style={EYEBROW}>Market</span>
        <span style={{ ...EYEBROW, textAlign: 'right' }}>Poly · 24h move</span>
        <span style={{ ...EYEBROW, textAlign: 'right' }}>Vision · payout</span>
        <span style={{ ...EYEBROW, textAlign: 'right' }}>Gap</span>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: 28 }}>
          <p style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-17)',
            color: 'var(--apple-text-secondary)',
            margin: 0,
          }}>
            No markets that actually moved on both sides in this round. Turn off the filter to include
            tie-broken rounds.
          </p>
        </div>
      ) : (
        rows.map((m) => <Row key={m.assetId} m={m} />)
      )}
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
        borderRadius: 'var(--apple-r-pill)',
        border: '1px solid ' + (active ? 'var(--apple-text)' : 'var(--apple-line)'),
        background: active ? 'var(--apple-text)' : 'transparent',
        color: active ? '#fff' : 'var(--apple-text-secondary)',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 13,
        letterSpacing: 'var(--apple-track-tight)',
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        transition: 'all 200ms var(--apple-ease-default)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function outcomeChip(m: ComparisonMarket): { glyph: string; label: string; color: string } {
  if (m.visionTieBroken) return { glyph: '∼', label: 'tiebreak', color: 'var(--apple-text-tertiary)' }
  if (m.visionWinSide === 'Up') return { glyph: '▲', label: 'Up', color: APPLE_GREEN }
  if (m.visionWinSide === 'Down') return { glyph: '▼', label: 'Down', color: APPLE_RED }
  if (m.visionOutcome === 'Flat') return { glyph: '·', label: 'flat', color: 'var(--apple-text-tertiary)' }
  if (m.visionOutcome === 'AllSameSide') return { glyph: '·', label: 'one-side', color: 'var(--apple-text-tertiary)' }
  if (m.visionOutcome === 'AllLosers') return { glyph: '·', label: 'no win', color: 'var(--apple-text-tertiary)' }
  return { glyph: '·', label: 'cancelled', color: 'var(--apple-text-tertiary)' }
}

function Row({ m }: { m: ComparisonMarket }) {
  const polyHasName = !m.name.startsWith('0x')
  const displayName = polyHasName ? m.name : '(market name unavailable)'
  const polyUrl = polyHasName
    ? `https://polymarket.com/markets?_q=${encodeURIComponent(m.name)}`
    : null
  const out = outcomeChip(m)

  const polyColor = m.polyChangePct == null
    ? 'var(--apple-text-tertiary)'
    : m.polyChangePct > 0
    ? APPLE_GREEN
    : m.polyChangePct < 0
    ? APPLE_RED
    : 'var(--apple-text-secondary)'

  return (
    <div
      role="row"
      className="grid"
      style={{
        gridTemplateColumns: '1fr 160px 200px 100px',
        gap: 12,
        padding: '16px 20px',
        alignItems: 'center',
        borderBottom: '1px solid var(--apple-line)',
        transition: 'background-color 160ms var(--apple-ease-default)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        {polyUrl ? (
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
              fontWeight: 500,
            }}
            title={m.name}
          >
            {truncate(displayName, 110)}
          </a>
        ) : (
          <span
            style={{
              display: 'block',
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-15, 15px)',
              color: 'var(--apple-text-tertiary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={m.assetId}
          >
            {displayName}
          </span>
        )}
        <div
          className="mt-1"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: 'var(--apple-text-tertiary)',
            letterSpacing: '+0.007em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {m.polyVolume24h ? `${fmtUsd(m.polyVolume24h)} 24h` : 'no volume'}
          {' · implied '}
          {fmtImpliedProb(m.polyCurrent)}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ ...NUM_DISPLAY, fontSize: 19, color: polyColor }}>
          {fmtPct(m.polyChangePct, true, 2)}
        </div>
        <div
          className="mt-0.5"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            color: 'var(--apple-text-tertiary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {m.polyStart != null && m.polyEnd != null
            ? `${fmtImpliedProb(m.polyStart)} → ${fmtImpliedProb(m.polyEnd)}`
            : '—'}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{
          ...NUM_DISPLAY,
          fontSize: 19,
          color: m.visionGainPct == null
            ? 'var(--apple-text-tertiary)'
            : m.visionTieBroken
            ? 'var(--apple-text-tertiary)'
            : APPLE_BLUE,
        }}>
          {fmtPct(m.visionGainPct, true, 0)}
        </div>
        <div
          className="mt-0.5"
          style={{
            display: 'inline-flex',
            justifyContent: 'flex-end',
            gap: 6,
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            color: 'var(--apple-text-tertiary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ color: out.color }}>{out.glyph}</span>
          <span>{fmtMult(m.visionMultiplier)}</span>
          <span>· {out.label}</span>
        </div>
      </div>

      <div
        style={{
          textAlign: 'right',
          ...NUM_DISPLAY,
          fontSize: 17,
          color: m.leverageGap != null ? 'var(--apple-text)' : 'var(--apple-text-tertiary)',
        }}
      >
        {fmtPct(m.leverageGap, false, 0)}
      </div>
    </div>
  )
}

function Footnote({ batchId, generatedAt, now }: { batchId: number; generatedAt: string; now: number }) {
  return (
    <p
      className="mt-1"
      style={{
        fontFamily: 'var(--apple-font-text)',
        fontSize: 12,
        color: 'var(--apple-text-tertiary)',
        letterSpacing: '+0.007em',
        lineHeight: 1.5,
        maxWidth: '68ch',
        margin: 0,
      }}
    >
      Polymarket move: change in the question’s implied probability over the 24 hours ending when Vision batch
      #{batchId} settled. Vision payout: the parimutuel multiplier paid to the winning side of that five-minute round,
      expressed as net gain. Generated {fmtRelativeAt(generatedAt, now)}.
    </p>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────
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
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className={CARD_CLASS} style={{ ...CARD_STYLE, padding: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bar(120)}
          {bar(360)}
          {bar(280)}
        </div>
        <div
          className="mt-5 grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 18,
            paddingTop: 18,
            borderTop: '1px solid var(--apple-line)',
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bar(110)}
              {bar(90)}
            </div>
          ))}
        </div>
      </div>
      <div className={CARD_CLASS} style={CARD_STYLE}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid"
            style={{
              gridTemplateColumns: '1fr 160px 200px 100px',
              gap: 12,
              padding: '16px 20px',
              borderBottom: i < 7 ? '1px solid var(--apple-line)' : 'none',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {bar(280)}
              {bar(140)}
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
