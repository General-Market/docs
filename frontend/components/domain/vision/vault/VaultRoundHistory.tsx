'use client'

/**
 * VaultRoundHistory — what the bot actually did, round by round.
 *
 * Reads PlayerJoined / PlayerSettled / PlayerRefunded from the chain via
 * /api/vision/vault/<addr>/rounds. Renders four states: pending, settled,
 * refundable, refunded. Stuck is no longer a category — past expiration,
 * deposits become claimable. The keeper handles most refunds in the
 * background; the manual button is the user's escape hatch.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import deployment from '@/lib/contracts/deployment.json'

const VISION_ADDRESS = (deployment as any).contracts?.Vision as `0x${string}`

type RoundStatus = 'pending' | 'settled' | 'refundable' | 'refunded'

interface RoundRow {
  batchId: string
  joinBlock: number
  joinTime: number
  resolveBlock: number | null
  resolveTime: number | null
  status: RoundStatus
  deposit: number
  payout: number | null
  pnl: number | null
  expirationTime: number | null
}

interface RoundsResponse {
  vault: string
  rounds: RoundRow[]
  total: number
  nowSec: number
  totals: {
    joined: number
    settled: number
    refunded: number
    refundable: number
    pending: number
  }
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
  return { text: `${sign}$${Math.abs(v).toFixed(2)}`, tone: v >= 0 ? 'up' : 'down' }
}

function fmtRelTime(unixSec: number | null): string {
  if (!unixSec) return '—'
  const diff = Math.floor(Date.now() / 1000) - unixSec
  if (diff < 0) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function sortRounds(rows: RoundRow[], key: SortKey): RoundRow[] {
  const copy = [...rows]
  const recency = (r: RoundRow) => r.resolveBlock ?? r.joinBlock
  if (key === 'recent') {
    copy.sort((a, b) => recency(b) - recency(a))
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
  const [totals, setTotals] = useState<RoundsResponse['totals'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('recent')

  const fetchRounds = useCallback(() => {
    setLoading(true)
    setError(null)
    return fetch(`/api/vision/vault/${vaultAddress}/rounds`, {
      signal: AbortSignal.timeout(15_000),
    })
      .then((r) => r.json() as Promise<RoundsResponse>)
      .then((body) => {
        setRounds(body.rounds ?? [])
        setTotals(body.totals ?? null)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'fetch failed')
        setRounds([])
        setTotals(null)
      })
      .finally(() => setLoading(false))
  }, [vaultAddress])

  useEffect(() => {
    let cancelled = false
    fetchRounds().then(() => {
      if (cancelled) return
    })
    return () => { cancelled = true }
  }, [fetchRounds])

  const sorted = useMemo(() => sortRounds(rounds, sortKey), [rounds, sortKey])

  const realizedPnl = useMemo(() => {
    let pnl = 0
    for (const r of rounds) {
      if (r.status === 'settled' && r.pnl !== null) pnl += r.pnl
    }
    return pnl
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
          <Summary label="Joined" value={totals ? String(totals.joined) : '—'} />
          <Summary label="Settled" value={totals ? String(totals.settled) : '—'} />
          <Summary
            label="Refunded"
            value={totals ? String(totals.refunded) : '—'}
            mute={!totals || totals.refunded === 0}
          />
          <Summary
            label="Refundable"
            value={totals ? String(totals.refundable) : '—'}
            tone={totals && totals.refundable > 0 ? 'alert' : undefined}
          />
          <Summary
            label="Realized P&L"
            value={fmtPnl(totals && totals.settled > 0 ? realizedPnl : null).text}
            tone={fmtPnl(totals && totals.settled > 0 ? realizedPnl : null).tone}
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
        <EmptyState text="No rounds in the lookback window." />
      ) : (
        <RoundsTable rows={sorted.slice(0, 50)} onRefunded={fetchRounds} />
      )}

      {sorted.length > 50 && (
        <p style={overflowNoteStyle}>Showing 50 of {sorted.length} rounds.</p>
      )}
    </div>
  )
}

function RoundsTable({ rows, onRefunded }: { rows: RoundRow[]; onRefunded: () => void }) {
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
          gridTemplateColumns: '0.7fr 1fr 1fr 1fr 1fr 1fr 1fr',
          gap: 0,
          padding: '10px 16px',
          background: 'var(--apple-surface)',
          borderBottom: '1px solid var(--apple-line)',
          ...headerCellStyle,
        }}
      >
        <span>Round</span>
        <span>Status</span>
        <span>When</span>
        <span style={{ textAlign: 'right' }}>Deposit</span>
        <span style={{ textAlign: 'right' }}>Payout</span>
        <span style={{ textAlign: 'right' }}>P&amp;L</span>
        <span style={{ textAlign: 'right' }}>Action</span>
      </div>
      {rows.map((r, i) => (
        <RoundRowView
          key={`${r.batchId}-${r.joinBlock}-${i}`}
          row={r}
          isLast={i === rows.length - 1}
          onRefunded={onRefunded}
        />
      ))}
    </div>
  )
}

function RoundRowView({
  row,
  isLast,
  onRefunded,
}: {
  row: RoundRow
  isLast: boolean
  onRefunded: () => void
}) {
  const pnl = fmtPnl(row.pnl)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '0.8fr 1fr 1fr 1fr 1fr 1.2fr',
        gap: 0,
        padding: '12px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--apple-line)',
        fontVariantNumeric: 'tabular-nums',
        alignItems: 'baseline',
        fontSize: 13,
      }}
    >
      <span style={{ color: 'var(--apple-text)', fontWeight: 500 }}>#{row.batchId}</span>
      <StatusPill status={row.status} expirationTime={row.expirationTime} />
      <span
        style={{ color: 'var(--apple-text-secondary)' }}
        title={(() => {
          const ts = row.resolveTime ?? row.joinTime
          return ts ? new Date(ts * 1000).toLocaleString() : ''
        })()}
      >
        {fmtRelTime(row.resolveTime ?? row.joinTime)}
      </span>
      <span style={cellRight}>{fmtUsd(row.deposit)}</span>
      <span style={cellRight}>{row.payout !== null ? fmtUsd(row.payout) : '—'}</span>
      <span
        style={{
          ...cellRight,
          fontWeight: 600,
          color:
            pnl.tone === 'up' ? 'rgb(52,199,89)'
            : pnl.tone === 'down' ? 'rgb(255,59,48)'
            : 'var(--apple-text-secondary)',
        }}
      >
        {pnl.text}
      </span>
      <span style={cellRight}>
        {row.status === 'refundable' ? (
          <ClaimRefundButton batchId={row.batchId} onSuccess={onRefunded} />
        ) : (
          <span style={{ color: 'var(--apple-text-tertiary)' }}>—</span>
        )}
      </span>
    </div>
  )
}

function StatusPill({
  status,
  expirationTime,
}: {
  status: RoundStatus
  expirationTime: number | null
}) {
  const palette = {
    pending: { bg: 'rgba(0,113,227,0.10)', fg: 'rgb(0,113,227)', label: 'Open' },
    settled: { bg: 'transparent', fg: 'var(--apple-text-secondary)', label: 'Settled' },
    refunded: { bg: 'rgba(120,120,128,0.12)', fg: 'var(--apple-text-secondary)', label: 'Refunded' },
    refundable: { bg: 'rgba(255,159,10,0.14)', fg: 'rgb(178,90,0)', label: 'Refundable' },
  }[status]

  const tooltip =
    status === 'refundable'
      ? 'Settlement window passed without payout. Deposit is claimable.'
      : status === 'pending' && expirationTime
      ? `Settles by ${new Date(expirationTime * 1000).toLocaleString()}`
      : undefined

  return (
    <span
      title={tooltip}
      style={{
        fontFamily: 'var(--apple-font-text)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 'var(--apple-track-loose)',
        textTransform: 'uppercase',
        color: palette.fg,
        background: palette.bg,
        padding: status === 'settled' ? 0 : '2px 8px',
        borderRadius: 'var(--apple-r-pill,980px)',
        display: 'inline-block',
      }}
    >
      {palette.label}
    </span>
  )
}

function ClaimRefundButton({ batchId, onSuccess }: { batchId: string; onSuccess: () => void }) {
  const { isConnected } = useAccount()
  const { writeContractAsync, isPending } = useWriteContract()
  const [error, setError] = useState<string | null>(null)

  const handleClick = useCallback(async () => {
    setError(null)
    try {
      await writeContractAsync({
        address: VISION_ADDRESS,
        abi: VISION_ABI,
        functionName: 'claimRefund',
        args: [BigInt(batchId)],
      })
      // Give the indexer a moment, then refresh.
      setTimeout(onSuccess, 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 80) : 'claim failed')
    }
  }, [batchId, writeContractAsync, onSuccess])

  // Keeper auto-claims on its next poll cycle. The button is here as a
  // fallback in case the keeper is slow or down — but no-wallet users see
  // the keeper-status hint, not a useless prompt.
  if (!isConnected) {
    return (
      <span
        style={{ color: 'var(--apple-text-tertiary)', fontSize: 11 }}
        title="The vision-keeper service auto-claims refundable rounds. This row will resolve on the next keeper poll cycle (~60s)."
      >
        Auto-claim pending
      </span>
    )
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-tight)',
          padding: '4px 12px',
          borderRadius: 'var(--apple-r-pill,980px)',
          border: '1px solid rgb(178,90,0)',
          background: isPending ? 'rgba(255,159,10,0.10)' : 'rgb(255,159,10)',
          color: isPending ? 'rgb(178,90,0)' : '#fff',
          cursor: isPending ? 'wait' : 'pointer',
        }}
      >
        {isPending ? 'Claiming…' : 'Claim refund'}
      </button>
      {error && (
        <span style={{ color: 'rgb(255,59,48)', fontSize: 10 }}>{error}</span>
      )}
    </span>
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
  label,
  value,
  tone,
  mute,
}: {
  label: string
  value: string
  tone?: 'up' | 'down' | 'flat' | 'alert'
  mute?: boolean
}) {
  const valueColor =
    tone === 'up' ? 'rgb(52,199,89)'
    : tone === 'down' ? 'rgb(255,59,48)'
    : tone === 'alert' ? 'rgb(178,90,0)'
    : mute ? 'var(--apple-text-tertiary)'
    : 'var(--apple-text)'
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
          color: valueColor,
        }}
      >
        {value}
      </span>
    </div>
  )
}

const cellRight: React.CSSProperties = { textAlign: 'right', color: 'var(--apple-text)' }

const overflowNoteStyle: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 12,
  color: 'var(--apple-text-tertiary)',
  margin: 0,
  textAlign: 'center',
  letterSpacing: 'var(--apple-track-mid)',
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
