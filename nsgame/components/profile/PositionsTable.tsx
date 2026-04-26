import type { UserPositionDTO, PositionState } from '@/app/api/positions/[wallet]/route'
import { dollarsUsdcBig, safeBigInt, signedUsdcBig } from '@/lib/utils/usdc'
import { pairById } from '@/lib/markets/pairs'

// Open / settling / resolved positions, table-shaped, in the spirit of
// Kalshi's portfolio. Realized PnL only — for unresolved markets we
// show stake at risk in the same column with a different color, because
// midpoint guesses on a parimutuel pool are theatre.

interface PositionsTableProps {
  positions: ReadonlyArray<UserPositionDTO>
  nowSecs: number
}

function stateLabel(state: PositionState): string {
  switch (state) {
    case 'open': return 'open'
    case 'settling': return 'settling'
    case 'resolved-won': return 'won · unclaimed'
    case 'resolved-lost': return 'lost · unclaimed'
    case 'claimed-won': return 'won'
    case 'claimed-lost': return 'lost'
    case 'stranded-refund': return 'refund'
  }
}

function stateClass(state: PositionState): string {
  switch (state) {
    case 'open': return 'border-emerald-500/30 text-emerald-300'
    case 'settling': return 'border-amber-500/30 text-amber-300'
    case 'resolved-won':
    case 'claimed-won': return 'border-emerald-500/40 text-emerald-200'
    case 'resolved-lost':
    case 'claimed-lost': return 'border-rose-500/30 text-rose-300'
    case 'stranded-refund': return 'border-zinc-600 text-zinc-300'
  }
}

function pairLabel(thresholdBps: number, sourceId: number): string {
  const p = pairById(thresholdBps)
  if (p) return `${p.displayA} vs ${p.displayB}`
  return `src ${sourceId} · #${thresholdBps.toString().padStart(2, '0')}`
}

function formatTimeUntil(secs: number, nowSecs: number): string {
  const left = Math.max(0, secs - nowSecs)
  if (left === 0) return '—'
  if (left >= 86400) return `${Math.floor(left / 86400)}d`
  if (left >= 3600) return `${Math.floor(left / 3600)}h`
  if (left >= 60) return `${Math.floor(left / 60)}m`
  return `${left}s`
}

function pnlForRow(p: UserPositionDTO): { value: bigint; class: string; label: string } {
  const stake = safeBigInt(p.amount)
  const claimNet = safeBigInt(p.claimNet)
  if (p.state === 'claimed-won' || p.state === 'resolved-won') {
    // Net payout from contract is gross (includes stake). PnL = net - stake.
    const pnl = claimNet - stake
    return { value: pnl, class: 'text-emerald-300', label: signedUsdcBig(pnl) }
  }
  if (p.state === 'claimed-lost' || p.state === 'resolved-lost') {
    return { value: -stake, class: 'text-rose-300', label: signedUsdcBig(-stake) }
  }
  if (p.state === 'stranded-refund') {
    return { value: 0n, class: 'text-zinc-400', label: '$0.00' }
  }
  // Open or settling: stake at risk, not pnl.
  return { value: stake, class: 'text-amber-300', label: `at risk ${dollarsUsdcBig(stake)}` }
}

export function PositionsTable({ positions, nowSecs }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-12 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          nothing open. either you finished or you never started.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/80">
            <tr className="border-b border-zinc-800 text-left">
              <Th>market</Th>
              <Th className="text-center w-[64px]">side</Th>
              <Th className="text-right">stake</Th>
              <Th className="text-right">pnl</Th>
              <Th className="text-right">state</Th>
              <Th className="text-right pr-4">closes</Th>
            </tr>
          </thead>
          <tbody>
            {positions.map(p => {
              const stake = safeBigInt(p.amount)
              const pnl = pnlForRow(p)
              const sideClass = p.side === 'yes'
                ? 'border-emerald-500/40 text-emerald-300'
                : 'border-rose-500/40 text-rose-300'
              return (
                <tr
                  key={p.betSig}
                  className="border-b border-zinc-800/60 hover:bg-zinc-900/70"
                >
                  <td className="px-3 py-2.5 align-middle">
                    <p className="text-[13px] text-zinc-100">
                      {pairLabel(p.thresholdBps, p.sourceId)}
                    </p>
                    <p className="font-mono text-[10px] text-zinc-500">
                      market {p.market.slice(0, 4)}…{p.market.slice(-4)}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <span
                      className={[
                        'inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em]',
                        sideClass,
                      ].join(' ')}
                    >
                      {p.side}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right align-middle font-mono text-[12px] tabular-nums text-zinc-200">
                    {dollarsUsdcBig(stake)}
                  </td>
                  <td className={['px-3 py-2.5 text-right align-middle font-mono text-[12px] tabular-nums', pnl.class].join(' ')}>
                    {pnl.label}
                  </td>
                  <td className="px-3 py-2.5 text-right align-middle">
                    <span
                      className={[
                        'inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]',
                        stateClass(p.state),
                      ].join(' ')}
                    >
                      {stateLabel(p.state)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 pr-4 text-right align-middle font-mono text-[11px] tabular-nums text-zinc-500">
                    {p.state === 'open'
                      ? formatTimeUntil(p.closeTime, nowSecs)
                      : p.state === 'settling'
                        ? `settles ${formatTimeUntil(p.settlementTime, nowSecs)}`
                        : '—'}
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
