import Link from 'next/link'
import type { LeaderboardEntryDTO } from '@/app/api/leaderboard/route'
import {
  compactUsdcBig,
  relativeFromSecs,
  safeBigInt,
  shortAddress,
  signedUsdcBig,
} from '@/lib/utils/usdc'

// Server-rendered leaderboard. Two surfaces: a real semantic table on
// md+ screens, a card list below — same data, same semantics, same
// rank colouring. Top-3 marked with a leading dot — no trophies, no
// medals.

interface LeaderboardTableProps {
  entries: ReadonlyArray<LeaderboardEntryDTO>
  /** Unix seconds at render time, used for relative timestamps. */
  nowSecs: number
}

function rankClass(rank: number): string {
  if (rank === 1) return 'text-amber-300'
  if (rank === 2) return 'text-terminal-fg-muted'
  if (rank === 3) return 'text-amber-700'
  return 'text-terminal-fg-faint'
}

function pnlClass(units: bigint): string {
  if (units > 0n) return 'text-emerald-300'
  if (units < 0n) return 'text-rose-300'
  return 'text-terminal-fg-muted'
}

function pnlPctClass(pct: number): string {
  if (pct > 0) return 'text-emerald-400'
  if (pct < 0) return 'text-rose-400'
  return 'text-terminal-fg-faint'
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
      <div className="rounded-md border border-terminal-border bg-terminal-surface/60 px-4 py-12 text-center">
        <p className="font-mono text-label uppercase tracking-[0.14em] text-terminal-fg-faint">
          no rank yet. someone has to lose first.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop — semantic table. Sticky header. */}
      <div className="hidden md:block overflow-hidden rounded-md border border-terminal-border bg-terminal-surface/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="sticky top-0 z-10 bg-terminal-surface/95 backdrop-blur supports-[backdrop-filter]:bg-terminal-surface/80">
              <tr className="border-b border-terminal-border text-left">
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
                    data-wallet={entry.wallet}
                    className={[
                      'group border-b border-terminal-border/60 transition-colors',
                      'hover:bg-terminal-surface/80 focus-within:bg-terminal-surface/80',
                      top ? 'bg-terminal-surface/30' : '',
                    ].join(' ')}
                  >
                    <td className="px-3 py-2.5 text-center align-middle">
                      <span
                        className={[
                          'inline-flex h-6 min-w-[28px] items-center justify-center font-mono text-caption tabular-nums',
                          rankClass(entry.rank),
                        ].join(' ')}
                      >
                        {top ? '·' : ''}{entry.rank}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <Link
                        href={`/u/${entry.wallet}`}
                        className="inline-flex items-center gap-2 font-mono text-caption tabular-nums text-terminal-fg hover:text-terminal-fg"
                        title={entry.wallet}
                      >
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-terminal-fg-faint group-hover:bg-terminal-fg-muted" />
                        {shortAddress(entry.wallet)}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle font-mono text-caption tabular-nums text-terminal-fg">
                      {compactUsdcBig(volumeBig)}
                    </td>
                    <td
                      className={[
                        'px-3 py-2.5 text-right align-middle font-mono text-caption tabular-nums',
                        pnlClass(pnlBig),
                      ].join(' ')}
                    >
                      {signedUsdcBig(pnlBig)}
                    </td>
                    <td
                      className={[
                        'px-3 py-2.5 text-right align-middle font-mono text-label tabular-nums',
                        pnlPctClass(entry.pnlPct),
                      ].join(' ')}
                    >
                      {formatPctSigned(entry.pnlPct)}
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle font-mono text-label tabular-nums text-terminal-fg-muted">
                      {formatWinRate(entry.winRate)}
                      <span className="ml-1 text-micro text-terminal-fg-faint">
                        {entry.resolvedCount > 0 ? `${entry.winCount}/${entry.resolvedCount}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle font-mono text-label tabular-nums text-terminal-fg-muted">
                      {entry.betsCount}
                    </td>
                    <td className="px-3 py-2.5 pr-4 text-right align-middle font-mono text-label tabular-nums text-terminal-fg-faint">
                      {relativeFromSecs(entry.lastActive, nowSecs)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile — card list. Same data, no horizontal scroll. */}
      <ul className="md:hidden space-y-2">
        {entries.map(entry => {
          const pnlBig = safeBigInt(entry.pnlRealized)
          const volumeBig = safeBigInt(entry.volume)
          const top = entry.rank <= 3
          return (
            <li key={entry.wallet} data-wallet={entry.wallet}>
              <Link
                href={`/u/${entry.wallet}`}
                className={[
                  'flex w-full flex-col gap-3 rounded-md border border-terminal-border p-3 transition-colors',
                  top ? 'bg-terminal-surface' : 'bg-terminal-surface/60',
                  'hover:bg-terminal-surface-elevated focus-visible:bg-terminal-surface-elevated',
                ].join(' ')}
                title={entry.wallet}
              >
                {/* Top row — rank, wallet, pnl. */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={[
                        'inline-flex h-6 min-w-[28px] items-center justify-center font-mono text-caption tabular-nums',
                        rankClass(entry.rank),
                      ].join(' ')}
                    >
                      {top ? '·' : ''}{entry.rank}
                    </span>
                    <span className="flex items-center gap-2 font-mono text-caption tabular-nums text-terminal-fg">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-terminal-fg-faint" />
                      {shortAddress(entry.wallet)}
                    </span>
                  </div>
                  <span
                    className={[
                      'font-mono text-body-sm font-semibold tabular-nums',
                      pnlClass(pnlBig),
                    ].join(' ')}
                  >
                    {signedUsdcBig(pnlBig)}
                  </span>
                </div>

                {/* Metric grid — Volume, Winrate, Bets, Last active. */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-terminal-border/60 pt-3">
                  <Metric label="volume">
                    <span className="font-mono text-body-sm tabular-nums text-terminal-fg">
                      {compactUsdcBig(volumeBig)}
                    </span>
                  </Metric>
                  <Metric label="pnl %">
                    <span
                      className={[
                        'font-mono text-body-sm tabular-nums',
                        pnlPctClass(entry.pnlPct),
                      ].join(' ')}
                    >
                      {formatPctSigned(entry.pnlPct)}
                    </span>
                  </Metric>
                  <Metric label="win rate">
                    <span className="font-mono text-body-sm tabular-nums text-terminal-fg-muted">
                      {formatWinRate(entry.winRate)}
                      {entry.resolvedCount > 0 ? (
                        <span className="ml-1 text-micro text-terminal-fg-faint">
                          {entry.winCount}/{entry.resolvedCount}
                        </span>
                      ) : null}
                    </span>
                  </Metric>
                  <Metric label="bets">
                    <span className="font-mono text-body-sm tabular-nums text-terminal-fg-muted">
                      {entry.betsCount}
                    </span>
                  </Metric>
                  <Metric label="last active" full>
                    <span className="font-mono text-body-sm tabular-nums text-terminal-fg-faint">
                      {relativeFromSecs(entry.lastActive, nowSecs)}
                    </span>
                  </Metric>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={[
        'px-3 py-2 font-mono text-micro font-medium uppercase tracking-[0.14em] text-terminal-fg-faint',
        className,
      ].join(' ')}
    >
      {children}
    </th>
  )
}

function Metric({
  label,
  children,
  full = false,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={['flex flex-col gap-0.5', full ? 'col-span-2' : ''].join(' ')}>
      <span className="font-mono text-caption uppercase tracking-[0.14em] text-terminal-fg-faint">
        {label}
      </span>
      {children}
    </div>
  )
}
