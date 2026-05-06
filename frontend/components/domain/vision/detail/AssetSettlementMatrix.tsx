'use client'

import { useMemo } from 'react'
import { useAssetSettlements, type AssetSettlement } from '@/hooks/vision/useAssetSettlements'
import fundData from '@/data/fund-branding.json'

interface FundEntry {
  name?: string
  symbol?: string
  vault?: string
  color?: string
}

const VAULT_BY_ADDR: Map<string, FundEntry> = (() => {
  const m = new Map<string, FundEntry>()
  for (const f of (fundData as { funds: FundEntry[] }).funds) {
    if (f.vault) m.set(f.vault.toLowerCase(), f)
  }
  return m
})()

function shortAddr(a: string): string {
  if (!a) return '?'
  const lower = a.toLowerCase()
  return `${lower.slice(0, 6)}…${lower.slice(-4)}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

interface CellProps {
  side: 'Up' | 'Down' | null
  won: boolean
}

function Cell({ side, won }: CellProps) {
  if (!side) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: 18,
          textAlign: 'center',
          color: 'var(--apple-text-tertiary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        ·
      </span>
    )
  }
  const color = won ? 'rgb(52,199,89)' : 'rgb(255,59,48)'
  const glyph = side === 'Up' ? '▲' : '▼'
  return (
    <span
      style={{
        display: 'inline-block',
        width: 18,
        textAlign: 'center',
        color,
        fontSize: 12,
        lineHeight: 1,
        opacity: won ? 1 : 0.65,
      }}
      title={`${side} · ${won ? 'won' : 'lost'}`}
    >
      {glyph}
    </span>
  )
}

interface MatrixRow {
  player: string
  label: string
  color?: string
  cells: { side: 'Up' | 'Down' | null; won: boolean }[]
  wins: number
  total: number
}

interface BatchColumn {
  batch: AssetSettlement
  upPct: number | null
  downPct: number | null
}

function computeOdds(s: AssetSettlement): { upPct: number | null; downPct: number | null } {
  let up = 0
  let down = 0
  try {
    up = Number(BigInt(s.upStake))
    down = Number(BigInt(s.downStake))
  } catch {
    return { upPct: null, downPct: null }
  }
  const total = up + down
  if (!total) return { upPct: null, downPct: null }
  return { upPct: (up / total) * 100, downPct: (down / total) * 100 }
}

function buildMatrix(settlements: AssetSettlement[]): {
  columns: BatchColumn[]
  rows: MatrixRow[]
} {
  const ordered = [...settlements].sort(
    (a, b) => new Date(a.settledAt).getTime() - new Date(b.settledAt).getTime(),
  )
  const columns: BatchColumn[] = ordered.map(b => ({ batch: b, ...computeOdds(b) }))
  const rows = new Map<string, MatrixRow>()
  ordered.forEach((s, colIdx) => {
    s.players.forEach(p => {
      const key = p.player.toLowerCase()
      const fund = VAULT_BY_ADDR.get(key)
      // Filter: only show known vaults. EOAs and unbranded contracts drop out.
      if (!fund) return
      let row = rows.get(key)
      if (!row) {
        row = {
          player: p.player,
          label: fund.name || shortAddr(p.player),
          color: fund.color,
          cells: ordered.map(() => ({ side: null, won: false })),
          wins: 0,
          total: 0,
        }
        rows.set(key, row)
      }
      row.cells[colIdx] = { side: p.side, won: p.won }
      row.total += 1
      if (p.won) row.wins += 1
    })
  })
  const sorted = [...rows.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.label.localeCompare(b.label)
  })
  return { columns, rows: sorted }
}

export function AssetSettlementMatrix({
  sourceId,
  assetId,
}: {
  sourceId: string
  assetId: string
}) {
  const { data, isLoading } = useAssetSettlements(sourceId, assetId, 60)

  const { columns, rows } = useMemo(() => buildMatrix(data ?? []), [data])

  if (isLoading) {
    return (
      <div
        className="text-center py-6"
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          color: 'var(--apple-text-tertiary)',
        }}
      >
        Loading positions…
      </div>
    )
  }

  if (columns.length === 0) {
    return (
      <div
        className="text-center py-6"
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          color: 'var(--apple-text-tertiary)',
        }}
      >
        No settlements yet for this market.
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div
        className="text-center py-6"
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          color: 'var(--apple-text-tertiary)',
        }}
      >
        No vault has bet on this market yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table
        style={{
          borderCollapse: 'separate',
          borderSpacing: 0,
          fontFamily: 'var(--apple-font-text)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 11,
          minWidth: '100%',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                position: 'sticky',
                left: 0,
                background: 'var(--apple-panel)',
                textAlign: 'left',
                padding: '6px 12px 6px 0',
                color: 'var(--apple-text-tertiary)',
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-loose)',
                textTransform: 'uppercase',
                fontSize: 10,
                borderBottom: '1px solid var(--apple-line)',
              }}
            >
              Vault
            </th>
            {columns.map(c => {
              const b = c.batch
              const headColor =
                b.outcome === 'Up'
                  ? 'rgb(52,199,89)'
                  : b.outcome === 'Down'
                  ? 'rgb(255,59,48)'
                  : 'var(--apple-text-tertiary)'
              const oddsTitle =
                c.upPct !== null && c.downPct !== null
                  ? `${formatTime(b.settledAt)} · ↑${c.upPct.toFixed(0)}% / ↓${c.downPct.toFixed(0)}%`
                  : formatTime(b.settledAt)
              return (
                <th
                  key={b.batchId}
                  title={oddsTitle}
                  style={{
                    padding: '6px 2px',
                    color: headColor,
                    fontWeight: 600,
                    fontSize: 10,
                    textAlign: 'center',
                    borderBottom: '1px solid var(--apple-line)',
                    verticalAlign: 'bottom',
                    lineHeight: 1.15,
                  }}
                >
                  <div>#{b.batchId}</div>
                  {c.upPct !== null && c.downPct !== null ? (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 9,
                        fontWeight: 500,
                        color: 'var(--apple-text-tertiary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {c.upPct.toFixed(0)}/{c.downPct.toFixed(0)}
                    </div>
                  ) : null}
                </th>
              )
            })}
            <th
              style={{
                padding: '6px 0 6px 12px',
                color: 'var(--apple-text-tertiary)',
                fontWeight: 600,
                fontSize: 10,
                textAlign: 'right',
                borderBottom: '1px solid var(--apple-line)',
                letterSpacing: 'var(--apple-track-loose)',
                textTransform: 'uppercase',
              }}
            >
              W/T
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.player}>
              <td
                style={{
                  position: 'sticky',
                  left: 0,
                  background: 'var(--apple-panel)',
                  padding: '4px 12px 4px 0',
                  color: 'var(--apple-text)',
                  fontSize: 12,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    marginRight: 8,
                    background: r.color || 'var(--apple-text-tertiary)',
                    verticalAlign: 'middle',
                  }}
                />
                {r.label}
              </td>
              {r.cells.map((c, i) => (
                <td
                  key={i}
                  style={{
                    padding: '4px 0',
                    textAlign: 'center',
                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                  }}
                >
                  <Cell side={c.side} won={c.won} />
                </td>
              ))}
              <td
                style={{
                  padding: '4px 0 4px 12px',
                  textAlign: 'right',
                  color: 'var(--apple-text-tertiary)',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                }}
              >
                {r.wins}/{r.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
