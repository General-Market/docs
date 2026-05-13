'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'

const PAGE_SIZE = 50

const POS = 'rgb(52,199,89)'
const NEG = 'rgb(255,59,48)'

function truncAddr(a: string): string {
  if (!a || a.length < 12) return a || '--'
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function fmtPnl(pnl: number): { text: string; color: string } {
  if (pnl === 0) return { text: '$0.00', color: 'var(--apple-text-secondary)' }
  const abs = Math.abs(pnl)
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(2)}K` : `$${abs.toFixed(2)}`
  return { text: pnl > 0 ? `+${s}` : `-${s}`, color: pnl > 0 ? POS : NEG }
}

function fmtVolume(v: number): string {
  if (!v) return '$0'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

const headerCell: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-loose)',
  textTransform: 'uppercase',
  color: 'var(--apple-text-tertiary)',
}

const cell: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 14,
  letterSpacing: 'var(--apple-track-tight)',
  color: 'var(--apple-text)',
  fontVariantNumeric: 'tabular-nums',
}

interface Props {
  /** If set, leaderboard is filtered to this source. */
  sourceId?: string
}

export function LeaderboardApple({ sourceId }: Props) {
  const { leaderboard, isLoading } = useVisionLeaderboard(undefined, sourceId)
  const router = useRouter()
  const [visible, setVisible] = useState(PAGE_SIZE)

  const rows = leaderboard.slice(0, visible)
  const hasMore = visible < leaderboard.length

  return (
    <section
      style={{
        background: 'var(--apple-panel)',
        border: '1px solid var(--apple-line)',
        borderRadius: 'var(--apple-r-md)',
        overflow: 'hidden',
      }}
    >
      {/* Desktop header */}
      <div
        role="row"
        className="hidden sm:grid items-center px-5 py-3"
        style={{
          gridTemplateColumns: '40px minmax(0,1fr) 90px 110px 100px 120px',
          gap: 16,
          borderBottom: '1px solid var(--apple-line)',
          background: 'var(--apple-panel-2)',
        }}
      >
        <span style={headerCell}>Rank</span>
        <span style={headerCell}>Player</span>
        <span style={{ ...headerCell, textAlign: 'right' }}>Rounds</span>
        <span style={{ ...headerCell, textAlign: 'right' }}>Volume</span>
        <span style={{ ...headerCell, textAlign: 'right' }}>ROI</span>
        <span style={{ ...headerCell, textAlign: 'right' }}>P&amp;L</span>
      </div>

      {isLoading && (
        <div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="px-5"
              style={{
                height: 56,
                borderBottom: '1px solid var(--apple-line)',
              }}
            >
              <span
                className="skeleton block"
                style={{
                  height: 14,
                  marginTop: 21,
                  background: 'var(--apple-surface)',
                  borderRadius: 4,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div
          className="py-16 text-center"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            color: 'var(--apple-text-secondary)',
            letterSpacing: 'var(--apple-track-tight)',
          }}
        >
          No players yet. The first round writes the ledger.
        </div>
      )}

      {!isLoading && rows.map((p, i) => {
        const rank = p.rank || i + 1
        const pnl = fmtPnl(p.pnl)
        const vol = p.totalVolume || p.volume || 0
        const rounds = p.roundsPlayed || p.portfolioBets || p.totalBets || 0
        const roiColor = p.roi >= 0 ? POS : NEG
        const isPodium = rank <= 3

        return (
          <button
            key={p.walletAddress}
            type="button"
            onClick={() => router.push(`/profile/${p.walletAddress}`)}
            className="leaderboard-row w-full text-left"
            style={{
              display: 'block',
              borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--apple-line)',
              background: 'var(--apple-panel)',
              cursor: 'pointer',
              transition: 'background 160ms var(--apple-ease-default)',
            }}
          >
            {/* Desktop row */}
            <div
              role="row"
              className="hidden sm:grid items-center px-5"
              style={{
                gridTemplateColumns: '40px minmax(0,1fr) 90px 110px 100px 120px',
                gap: 16,
                height: 56,
              }}
            >
              <span
                style={{
                  ...cell,
                  fontWeight: isPodium ? 600 : 500,
                  color: isPodium ? 'var(--apple-text)' : 'var(--apple-text-tertiary)',
                  fontSize: 13,
                }}
              >
                {rank}
              </span>
              <span
                style={{
                  ...cell,
                  fontFamily: '"SF Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 13,
                  fontWeight: 500,
                }}
                className="truncate"
              >
                {truncAddr(p.walletAddress)}
              </span>
              <span style={{ ...cell, textAlign: 'right', color: 'var(--apple-text-secondary)', fontSize: 13 }}>
                {rounds}
              </span>
              <span style={{ ...cell, textAlign: 'right', color: 'var(--apple-text-secondary)', fontSize: 13 }}>
                {fmtVolume(vol)}
              </span>
              <span style={{ ...cell, textAlign: 'right', color: roiColor, fontWeight: 600, fontSize: 13 }}>
                {p.roi >= 0 ? '+' : ''}{p.roi.toFixed(1)}%
              </span>
              <span style={{ ...cell, textAlign: 'right', color: pnl.color, fontWeight: 600, fontSize: 15 }}>
                {pnl.text}
              </span>
            </div>

            {/* Mobile row */}
            <div
              className="grid sm:hidden items-center px-4"
              style={{
                gridTemplateColumns: '28px minmax(0,1fr) auto auto',
                columnGap: 10,
                rowGap: 0,
                height: 56,
              }}
            >
              <span
                style={{
                  ...cell,
                  fontSize: 12,
                  color: isPodium ? 'var(--apple-text)' : 'var(--apple-text-tertiary)',
                  fontWeight: isPodium ? 600 : 500,
                }}
              >
                {rank}
              </span>
              <span
                style={{
                  ...cell,
                  fontFamily: '"SF Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 12,
                  fontWeight: 500,
                }}
                className="truncate"
              >
                {truncAddr(p.walletAddress)}
              </span>
              <span style={{ ...cell, color: roiColor, fontWeight: 600, fontSize: 12 }}>
                {p.roi >= 0 ? '+' : ''}{p.roi.toFixed(1)}%
              </span>
              <span style={{ ...cell, color: pnl.color, fontWeight: 600, fontSize: 14 }}>
                {pnl.text}
              </span>
            </div>
          </button>
        )
      })}

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisible(v => v + PAGE_SIZE)}
          className="w-full"
          style={{
            padding: '14px 20px',
            background: 'var(--apple-panel-2)',
            borderTop: '1px solid var(--apple-line)',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-accent)',
            cursor: 'pointer',
          }}
        >
          Show {Math.min(PAGE_SIZE, leaderboard.length - visible)} more
        </button>
      )}

      <style jsx>{`
        :global(.leaderboard-row:hover) {
          background: var(--apple-page-bg) !important;
        }
      `}</style>
    </section>
  )
}
