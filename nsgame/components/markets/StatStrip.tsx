'use client'

import { formatUSD } from '@/lib/utils/formatters'
import { PulseDot } from './PulseDot'

// A row of small stat blocks. Numbers in sans tabular. Missing values
// become "—". The strip is allowed to know nothing yet — that's what
// placeholders are for.

interface StatStripProps {
  openMarkets?: number
  totalPool?: bigint
  resolvedToday?: number
  network?: 'devnet' | 'mainnet'
}

interface Cell {
  label: string
  value: React.ReactNode
}

const DASH = '—'

function formatCount(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DASH
  return n.toLocaleString('en-US')
}

function formatPool(amount: bigint | undefined): string {
  if (typeof amount !== 'bigint') return DASH
  return formatUSD(amount)
}

export function StatStrip({
  openMarkets,
  totalPool,
  resolvedToday,
  network,
}: StatStripProps) {
  const cells: Cell[] = [
    { label: 'markets', value: formatCount(openMarkets) },
    { label: 'pool', value: formatPool(totalPool) },
    { label: 'closed today', value: formatCount(resolvedToday) },
    {
      label: 'network',
      value: (
        <span className="inline-flex items-center gap-1.5">
          <PulseDot active color="amber" size={6} />
          <span>{network ?? DASH}</span>
        </span>
      ),
    },
  ]

  return (
    <div className="border-b border-zinc-800/70">
      <div className="-mx-4 flex snap-x snap-mandatory items-stretch gap-8 overflow-x-auto px-4 py-4 scrollbar-hide sm:mx-0 sm:gap-12 sm:px-0">
        {cells.map((c) => (
          <div
            key={c.label}
            className="flex shrink-0 snap-start flex-col gap-1"
          >
            <span className="text-label font-medium tracking-tight text-zinc-500">
              {c.label}
            </span>
            <span className="text-title font-semibold tabular-nums tracking-tight text-zinc-100">
              {c.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
