'use client'

/**
 * VaultRoundHistory — what the bot actually did, round by round.
 *
 * The legacy VaultPortfolioView pulled from the data-node's /portfolio/trades
 * table, which only catches ITP order fills. Vision vaults trade parimutuel
 * batches, so that table is permanently empty for them — the "no portfolio
 * data" message was technically correct but useless. This component reads
 * PlayerJoined + PlayerSettled events from the chain and renders one row per
 * round: deposit in, payout out, P&L. The truth lives where the events live.
 */

import { useEffect, useMemo, useState } from 'react'

interface RoundRow {
  batchId: string
  blockNumber: number
  status: 'open' | 'settled'
  deposit: number
  payout: number | null
  pnl: number | null
}

interface RoundsResponse {
  vault: string
  rounds: RoundRow[]
  total: number
  lookbackBlocks: number
  headBlock: number
}

type SortKey = 'recent' | 'pnl_desc' | 'pnl_asc' | 'size'

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recent',
  pnl_desc: 'Best',
  pnl_asc: 'Worst',
  size: 'Size',
}

function fmtUsd(v: number) {
  if (Math.abs(v) >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  return `$${v.toFixed(2)}`
}

function fmtPnl(v: number | null): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (v === null) return { text: '—', tone: 'flat' }
  if (Math.abs(v) < 0.005) return { text: '$0.00', tone: 'flat' }
  const sign = v >= 0 ? '+' : '−'
  return {
    text: `${sign}$${Math.abs(v).toFixed(2)}`,
    tone: v >= 0 ? 'up' : 'down',
  }
}

function sortRounds(rows: RoundRow[], key: SortKey): RoundRow[] {
  const copy = [...rows]
  if (key === 'recent') {
    copy.sort((a, b) => b.blockNumber - a.blockNumber)
  } else if (key === 'pnl_desc') {
    copy.sort((a, b) => (b.pnl ?? -Infinity) - (a.pnl ?? -Infinity))
  } else if (key === 'pnl_asc') {
    copy.sort((a, b) => (a.pnl ?? Infinity) - (b.pnl ?? Infinity))
  } else {
    copy.sort((a, b) => b.deposit - a.deposit)
  }
  return copy
}

interface Props {
  vaultAddress: string
}

export function VaultRoundHistory({ vaultAddress }: Props) {
  const [rounds, setRounds] = useState<RoundRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('recent')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/vision/vault/${vaultAddress}/rounds`, {
      signal: AbortSignal.timeout(15_000),
    })
      .then((r) => r.json() as Promise<RoundsResponse>)
      .then((body) => {
        if (cancelled) return
        setRounds(body.rounds ?? [])
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'fetch failed')
        setRounds([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [vaultAddress])

  const sorted = useMemo(() => sortRounds(rounds, sortKey), [rounds, sortKey])

  const totals = useMemo(() => {
    let played = 0
    let settled = 0
    let totalPnl = 0
    for (const r of rounds) {
      played += 1
      if (r.status === 'settled' && r.pnl !== null) {
        settled += 1
        totalPnl += r.pnl
      }
    }
    return { played, settled, totalPnl }
  }, [rounds])

  return (
    <div
      style={{
        fontFamily: 'var(--apple-font-text)',
        color: 'var(--apple-text)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p style={eyebrowStyle}>Round history</p>
          <h2 style={titleStyle}>What the bot did</h2>
        </div>
        <div className="flex flex-wrap gap-4">
          <Summary label="Joined" value={totals.played > 0 ? String(totals.played) : '—'} />
          <Summary label="Settled" value={totals.settled > 0 ? String(totals.settled) : '—'} />
          <Summary
            label="Realized P&L"
            value={fmtPnl(totals.settled > 0 ? totals.totalPnl : null).text}
            tone={fmtPnl(totals.settled > 0 ? totals.totalPnl : null).tone}
          />
        </div>
      </header>

      <div
        role="tablist"
        style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          background: 'var(--apple-surface)',
          borderRadius: 'var(--apple-r-pill,980px)',
          padding: 3,
          gap: 2,
        }}
      >
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={sortKey === key}
            onClick={() => setSortKey(key)}
            style={{
              padding: '6px 14px',
              background: sortKey === key ? 'var(--apple-panel,#ffffff)' : 'transparent',
              color: sortKey === key ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: 'var(--apple-track-tight)',
              border: 'none',
              borderRadius: 'var(--apple-r-pill,980px)',
              cursor: 'pointer',
              boxShadow: sortKey === key ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            {SORT_LABELS[key]}
          </button>
        ))}
      </div>

      {loading ? (
        <EmptyState text="Reading the chain…" />
      ) : error ? (
        <EmptyState text="Could not load round history. Try again in a moment." />
      ) : sorted.length === 0 ? (
        <EmptyState text="No rounds in the last 24 hours of blocks." />
      ) : (
        <RoundsTable rows={sorted.slice(0, 50)} />
      )}

      {sorted.length > 50 && (
        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: 'var(--apple-text-tertiary)',
            margin: 0,
            textAlign: 'center',
            letterSpacing: 'var(--apple-track-mid)',
          }}
        >
          Showing 50 of {sorted.length} rounds.
        </p>
      )}
    </div>
  )
}

function RoundsTable({ rows }: { rows: RoundRow[] }) {
  return (
    <div
      style={{
        border: '1px solid var(--apple-line)',
        borderRadius: 'var(--apple-r-md,12px)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
          gap: 0,
          padding: '10px 16px',
          background: 'var(--apple-surface)',
          borderBottom: '1px solid var(--apple-line)',
          ...headerCellStyle,
        }}
      >
        <span>Round</span>
        <span>Status</span>
        <span style={{ textAlign: 'right' }}>Deposit</span>
        <span style={{ textAlign: 'right' }}>Payout</span>
        <span style={{ textAlign: 'right' }}>P&amp;L</span>
      </div>
      {rows.map((r, i) => {
        const pnl = fmtPnl(r.pnl)
        return (
          <div
            key={`${r.batchId}-${r.blockNumber}-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
              gap: 0,
              padding: '12px 16px',
              borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--apple-line)',
              fontVariantNumeric: 'tabular-nums',
              alignItems: 'baseline',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--apple-text)', fontWeight: 500 }}>#{r.batchId}</span>
            <span>
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-loose)',
                  textTransform: 'uppercase',
                  color:
                    r.status === 'settled'
                      ? 'var(--apple-text-secondary)'
                      : 'rgb(0,113,227)',
                }}
              >
                {r.status === 'settled' ? 'Settled' : 'Open'}
              </span>
            </span>
            <span style={{ textAlign: 'right', color: 'var(--apple-text)' }}>
              {fmtUsd(r.deposit)}
            </span>
            <span style={{ textAlign: 'right', color: 'var(--apple-text)' }}>
              {r.payout !== null ? fmtUsd(r.payout) : '—'}
            </span>
            <span
              style={{
                textAlign: 'right',
                fontWeight: 600,
                color:
                  pnl.tone === 'up' ? 'rgb(52,199,89)'
                  : pnl.tone === 'down' ? 'rgb(255,59,48)'
                  : 'var(--apple-text-secondary)',
              }}
            >
              {pnl.text}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '40px 16px',
        textAlign: 'center',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 14,
        color: 'var(--apple-text-secondary)',
        letterSpacing: 'var(--apple-track-tight)',
        background: 'var(--apple-surface)',
        borderRadius: 'var(--apple-r-md,12px)',
        border: '1px solid var(--apple-line)',
      }}
    >
      {text}
    </div>
  )
}

function Summary({
  label, value, tone,
}: {
  label: string
  value: string
  tone?: 'up' | 'down' | 'flat'
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 90 }}>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-loose)',
          textTransform: 'uppercase',
          color: 'var(--apple-text-tertiary)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-tight)',
          color:
            tone === 'up' ? 'rgb(52,199,89)'
            : tone === 'down' ? 'rgb(255,59,48)'
            : 'var(--apple-text)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-loose)',
  textTransform: 'uppercase',
  color: 'var(--apple-text-tertiary)',
  margin: 0,
}

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--apple-font-display)',
  fontSize: 'var(--apple-fs-21,21px)',
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-tighter)',
  color: 'var(--apple-text)',
  margin: '4px 0 0',
}

const headerCellStyle: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-loose)',
  textTransform: 'uppercase',
  color: 'var(--apple-text-tertiary)',
}
