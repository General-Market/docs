import type { SectionProps } from '../SectionRenderer'

function formatTvl(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function PctChange({ value }: { value?: number }) {
  if (value == null) return <span className="text-text-muted">—</span>
  const color = value >= 0 ? 'text-color-up' : 'text-color-down'
  return <span className={`font-mono tabular-nums ${color}`}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>
}

export function DefiHealth({ enrichment }: SectionProps) {
  const defi = enrichment?.defi
  if (!defi) return null

  const cards = [
    { label: 'AGGREGATE TVL', value: formatTvl(defi.total_tvl) },
    {
      label: 'AVG TVL CHANGE 7D',
      value: `${defi.avg_tvl_change_7d >= 0 ? '+' : ''}${defi.avg_tvl_change_7d.toFixed(2)}%`,
      color: defi.avg_tvl_change_7d >= 0 ? 'text-color-up' : 'text-color-down',
    },
    { label: 'COVERAGE', value: `${defi.protocols_with_data} of ${defi.total_holdings}` },
  ]

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-4">
        DeFi Protocol Health
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border-light border border-border-light rounded-lg overflow-hidden mb-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">
              {c.label}
            </div>
            <div className={`text-xl font-bold font-mono tabular-nums ${c.color || 'text-text-primary'}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {defi.top_by_tvl.length > 0 && (
        <div className="bg-white border border-border-light rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border-light">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-text-secondary">Protocol</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-secondary">TVL</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-secondary">1D</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-secondary">7D</th>
              </tr>
            </thead>
            <tbody>
              {defi.top_by_tvl.map(p => (
                <tr key={p.symbol} className="border-t border-border-light">
                  <td className="px-4 py-2.5">
                    <span className="font-semibold">{p.symbol}</span>
                    {p.name !== p.symbol && <span className="text-text-muted text-xs ml-1.5">{p.name}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatTvl(p.tvl)}</td>
                  <td className="px-4 py-2.5 text-right"><PctChange value={p.change_1d} /></td>
                  <td className="px-4 py-2.5 text-right"><PctChange value={p.change_7d} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
