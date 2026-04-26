import Link from 'next/link'
import type { LeaderboardEntryDTO } from '@/app/api/leaderboard/route'
import {
  compactUsdcBig,
  relativeFromSecs,
  safeBigInt,
  shortAddress,
  signedUsdcBig,
} from '@/lib/utils/usdc'

// Server-rendered leaderboard table. Real semantic <table>. Sticky
// header. Top-3 marked with a leading dot — no trophies, no medals.

interface LeaderboardTableProps {
  entries: ReadonlyArray<LeaderboardEntryDTO>
  /** Unix seconds at render time, used for relative timestamps. */
  nowSecs: number
}

function rankClass(rank: number): string {
  if (rank === 1) return 'text-amber-300'
  if (rank === 2) return 'text-zinc-300'
  if (rank === 3) return 'text-amber-700'
  return 'text-zinc-500'
}

function pnlClass(units: bigint): string {
  if (units > 0n) return 'text-emerald-300'
  if (units < 0n) return 'text-rose-300'
  return 'text-zinc-400'
}

function pnlPctClass(pct: number): string {
  if (pct > 0) return 'text-emerald-400'
  if (pct < 0) return 'text-rose-400'
  return 'text-zinc-500'
}

function formatWinRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(0)}%`
}

function formatPctSigned(pct: number): string {
  if (pct === 0) return '0%'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export function LeaderboardTable({ entries, nowSecs }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-12 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          no rank yet. someone has to lose first.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/80">
            <tr className="border-b border-zinc-800 text-left">
              <Th className="w-[72px] text-center">rank</Th>
              <Th>wallet</Th>
              <Th className="text-right">volume</Th>
              <Th className="text-right">pnl</Th>
              <Th className="text-right">pnl %</Th>
              <Th className="text-right">win rate</Th>
              <Th className="text-right">bets</Th>
              <Th className="text-right pr-4">last active</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => {
              const pnlBig = safeBigInt(entry.pnlRealized)
              const volumeBig = safeBigInt(entry.volume)
              const top = entry.rank <= 3
              return (
                <tr
                  key={entry.wallet}
                  className={[
                    'group border-b border-zinc-800/60 transition-colors',
                    'hover:bg-zinc-900/80 focus-within:bg-zinc-900/80',
                    top ? 'bg-zinc-900/30' : '',
                  ].join(' ')}
                >
                  <td className="px-3 py-2.5 text-center align-middle">
                    <span
                      className={[
                        'inline-flex h-6 min-w-[28px] items-center justify-center font-mono text-[12px] tabular-nums',
                        rankClass(entry.rank),
                      ].join(' ')}
                    >
                      {top ? '·' : ''}{entry.rank}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <Link
                      href={`/u/${entry.wallet}`}
                      className="inline-flex items-center gap-2 font-mono text-[12px] tabular-nums text-zinc-200 hover:text-zinc-50"
                      title={entry.wallet}
                    >
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-zinc-600 group-hover:bg-zinc-400" />
                      {shortAddress(entry.wallet)}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right align-middle font-mono text-[12px] tabular-nums text-zinc-200">
                    {compactUsdcBig(volumeBig)}
                  </td>
                  <td
                    className={[
                      'px-3 py-2.5 text-right align-middle font-mono text-[12px] tabular-nums',
                      pnlClass(pnlBig),
                    ].join(' ')}
                  >
                    {signedUsdcBig(pnlBig)}
                  </td>
                  <td
                    className={[
                      'px-3 py-2.5 text-right align-middle font-mono text-[11px] tabular-nums',
                      pnlPctClass(entry.pnlPct),
                    ].join(' ')}
                  >
                    {formatPctSigned(entry.pnlPct)}
                  </td>
                  <td className="px-3 py-2.5 text-right align-middle font-mono text-[11px] tabular-nums text-zinc-300">
                    {formatWinRate(entry.winRate)}
                    <span className="ml-1 text-[10px] text-zinc-600">
                      {entry.resolvedCount > 0 ? `${entry.winCount}/${entry.resolvedCount}` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right align-middle font-mono text-[11px] tabular-nums text-zinc-400">
                    {entry.betsCount}
                  </td>
                  <td className="px-3 py-2.5 pr-4 text-right align-middle font-mono text-[11px] tabular-nums text-zinc-500">
                    {relativeFromSecs(entry.lastActive, nowSecs)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={[
        'px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500',
        className,
      ].join(' ')}
    >
      {children}
    </th>
  )
}

