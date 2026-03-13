'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { SectionProps } from '../SectionRenderer'

export function FundingOverview({ enrichment }: SectionProps) {
  const funding = enrichment?.funding
  if (!funding) return null

  const cards = [
    { label: 'TOTAL RAISED', value: `$${funding.total_raised_m.toFixed(0)}M` },
    { label: 'AVG VALUATION', value: funding.avg_valuation_m > 0 ? `$${funding.avg_valuation_m.toFixed(0)}M` : '—' },
    { label: 'FUNDING ROUNDS', value: `${funding.total_rounds}` },
  ]

  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Funding Intelligence
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-6">
        {cards.map(c => (
          <div key={c.label}>
            <div className="text-xs text-gray-500 mb-0.5">
              {c.label}
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-gray-900">
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {funding.top_investors.length > 0 && (
        <div className="py-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Top Investors by Frequency
          </h3>
          <ResponsiveContainer width="100%" height={funding.top_investors.length * 32 + 16}>
            <BarChart data={funding.top_investors} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fontSize: 11, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [value, 'Investments']}
                contentStyle={{
                  fontSize: 12,
                  border: '1px solid #e5e5e5',
                  borderRadius: 6,
                  boxShadow: 'none',
                }}
              />
              <Bar dataKey="count" fill="#111827" radius={[0, 3, 3, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {funding.recent_raises.length > 0 && (
        <div className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-text-secondary">Project</th>
                <th className="text-left px-4 py-2.5 font-semibold text-text-secondary">Round</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-secondary">Amount</th>
                <th className="text-left px-4 py-2.5 font-semibold text-text-secondary">Lead</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-secondary">Date</th>
              </tr>
            </thead>
            <tbody>
              {funding.recent_raises.map((r, i) => (
                <tr key={i} className="border-t border-gray-200">
                  <td className="px-4 py-2.5 font-semibold">{r.project}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.round}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">${r.amount_m.toFixed(1)}M</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.lead}</td>
                  <td className="px-4 py-2.5 text-right text-text-muted">{r.date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
