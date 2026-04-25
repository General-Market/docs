import type { UserPositionDTO } from '@/app/api/positions/[wallet]/route'
import { formatUsdcBig, relativeFromSecs, safeBigInt } from '@/lib/utils/usdc'
import { pairById } from '@/lib/markets/pairs'

// Recent fills for a single wallet. Same row idiom as GlobalActivity but
// scoped to one user — no owner column, no "anyone can see this" feed
// chrome. Just bets, in time order. Last 25.

interface RecentFillsProps {
  positions: ReadonlyArray<UserPositionDTO>
  nowSecs: number
  /** Cap row count. Default 25. */
  limit?: number
}

function pairLabel(thresholdBps: number, sourceId: number): string {
  const p = pairById(thresholdBps)
  if (p) return `${p.displayA} vs ${p.displayB}`
  return `src ${sourceId} · #${thresholdBps.toString().padStart(2, '0')}`
}

export function RecentFills({ positions, nowSecs, limit = 25 }: RecentFillsProps) {
  const sorted = [...positions]
    .filter(p => p.betTs !== null)
    .sort((a, b) => (b.betTs ?? 0) - (a.betTs ?? 0))
    .slice(0, limit)

  if (sorted.length === 0) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          no fills recorded
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/40">
      <header className="border-b border-zinc-800 px-4 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          recent fills
        </p>
      </header>
      <ul className="divide-y divide-zinc-800/60">
        {sorted.map(p => {
          const stake = safeBigInt(p.amount)
          const sideClass = p.side === 'yes'
            ? 'border-emerald-500/40 text-emerald-300'
            : 'border-rose-500/40 text-rose-300'
          return (
            <li key={p.betSig} className="flex items-center gap-3 px-4 py-2">
              <span
                className={[
                  'inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em]',
                  sideClass,
                ].join(' ')}
              >
                {p.side}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-200">
                {pairLabel(p.thresholdBps, p.sourceId)}
              </span>
              <span className="font-mono text-[12px] tabular-nums text-zinc-100">
                {formatUsdcBig(stake)} <span className="text-zinc-500">USDC</span>
              </span>
              <span className="hidden font-mono text-[11px] tabular-nums text-zinc-500 sm:inline">
                {relativeFromSecs(p.betTs, nowSecs)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
