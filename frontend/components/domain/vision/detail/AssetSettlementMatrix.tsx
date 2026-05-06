'use client'

import { useMemo } from 'react'
import { useAssetSettlements, type AssetSettlement } from '@/hooks/vision/useAssetSettlements'

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
  cells: { side: 'Up' | 'Down' | null; won: boolean }[]
  wins: number
  total: number
}

function buildMatrix(settlements: AssetSettlement[]): {
  batches: AssetSettlement[]
  rows: MatrixRow[]
} {
  const ordered = [...settlements].sort(
    (a, b) => new Date(a.settledAt).getTime() - new Date(b.settledAt).getTime(),
  )
  const players = new Map<string, MatrixRow>()
  ordered.forEach((s, colIdx) => {
    s.players.forEach(p => {
      const key = p.player.toLowerCase()
      let row = players.get(key)
      if (!row) {
        row = {
          player: p.player,
          cells: ordered.map(() => ({ side: null, won: false })),
          wins: 0,
          total: 0,
        }
        players.set(key, row)
      }
      row.cells[colIdx] = { side: p.side, won: p.won }
      row.total += 1
      if (p.won) row.wins += 1
    })
  })
  const rows = [...players.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    return b.wins - a.wins
  })
  return { batches: ordered, rows }
}

export function AssetSettlementMatrix({
  sourceId,
  assetId,
}: {
  sourceId: string
  assetId: string
}) {
  const { data, isLoading } = useAssetSettlements(sourceId, assetId, 60)

  const { batches, rows } = useMemo(() => buildMatrix(data ?? []), [data])

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

  if (batches.length === 0) {
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
              Player
            </th>
            {batches.map(b => (
              <th
                key={b.batchId}
                title={formatTime(b.settledAt)}
                style={{
                  padding: '6px 2px',
                  color:
                    b.outcome === 'Up'
                      ? 'rgb(52,199,89)'
                      : b.outcome === 'Down'
                      ? 'rgb(255,59,48)'
                      : 'var(--apple-text-tertiary)',
                  fontWeight: 600,
                  fontSize: 10,
                  textAlign: 'center',
                  borderBottom: '1px solid var(--apple-line)',
                }}
              >
                #{b.batchId}
              </th>
            ))}
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
                  fontFamily: 'var(--apple-font-mono, monospace)',
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                }}
              >
                {shortAddr(r.player)}
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
