import type { UserSummaryDTO } from '@/app/api/users/[wallet]/summary/route'
import { compactUsdcBig, formatUsdcBig, safeBigInt, signedUsdcBig } from '@/lib/utils/usdc'
import { PnlSparkline } from './PnlSparkline'

// Profile header. One row of stats, one sparkline. Volume, lifetime PnL,
// stake at risk, win rate, joined date. The wallet pubkey lives on top
// in monospace. No avatar — there is no identity here yet, only a key.

interface ProfileHeaderProps {
  summary: UserSummaryDTO
}

function formatJoined(ts: number | null): string {
  if (ts === null) return 'never bet'
  const d = new Date(ts * 1000)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatWinRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(0)}%`
}

export function ProfileHeader({ summary }: ProfileHeaderProps) {
  const pnl = safeBigInt(summary.pnlRealized)
  const volume = safeBigInt(summary.volume)
  const stake = safeBigInt(summary.stakeAtRisk)
  const pnlClass =
    pnl > 0n ? 'text-emerald-300' :
    pnl < 0n ? 'text-rose-300' :
    'text-zinc-300'

  return (
    <section
      className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5"
      aria-label="Profile summary"
    >
      <div className="flex flex-col gap-1 border-b border-zinc-800/60 pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          wallet
        </p>
        <p className="break-all font-mono text-[14px] tabular-nums text-zinc-100">
          {summary.wallet}
        </p>
        <p className="font-mono text-[11px] text-zinc-500">
          first bet {formatJoined(summary.joinedAt)} · {summary.betsCount} fills total
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="lifetime pnl">
          <span className={['font-mono text-[18px] tabular-nums tracking-tight', pnlClass].join(' ')}>
            {pnl === 0n ? formatUsdcBig(0n) : signedUsdcBig(pnl)}
          </span>
        </Stat>

        <Stat label="volume">
          <span className="font-mono text-[18px] tabular-nums tracking-tight text-zinc-100">
            {compactUsdcBig(volume)}
          </span>
        </Stat>

        <Stat label="stake at risk">
          <span className="font-mono text-[18px] tabular-nums tracking-tight text-amber-300">
            {compactUsdcBig(stake)}
          </span>
        </Stat>

        <Stat label="win rate">
          <span className="font-mono text-[18px] tabular-nums tracking-tight text-zinc-100">
            {formatWinRate(summary.winRate)}
          </span>
          <span className="ml-1 font-mono text-[10px] text-zinc-500">
            {summary.resolvedCount > 0 ? `${summary.winCount}/${summary.resolvedCount}` : ''}
          </span>
        </Stat>

        <Stat label="30d pnl">
          <PnlSparkline series={summary.pnlSeries} width={140} height={36} />
        </Stat>
      </div>
    </section>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <div className="flex min-h-[28px] items-center">{children}</div>
    </div>
  )
}
