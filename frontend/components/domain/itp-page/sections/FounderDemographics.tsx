'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { SectionProps } from '../SectionRenderer'

const BRAND_COLOR = '#111827'

function HorizontalBarChart({ data, dataKey, label }: {
  data: { label?: string; bucket?: string; count: number }[]
  dataKey: string
  label: string
}) {
  if (data.length === 0) return null
  return (
    <div className="bg-white border border-border-light rounded-lg p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-3">
        {label}
      </h3>
      <ResponsiveContainer width="100%" height={data.length * 32 + 16}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey={dataKey}
            width={100}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => [value, 'Count']}
            contentStyle={{
              fontSize: 12,
              border: '1px solid #e5e5e5',
              borderRadius: 6,
              boxShadow: 'none',
            }}
          />
          <Bar dataKey="count" fill={BRAND_COLOR} radius={[0, 3, 3, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function FounderDemographics({ enrichment }: SectionProps) {
  const founders = enrichment?.founders
  if (!founders || founders.total_founders === 0) return null

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
          Founder Intelligence
        </h2>
        <p className="text-xs text-text-secondary mt-1">
          Based on {founders.total_founders} founders across {founders.total_companies_matched} portfolio companies
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HorizontalBarChart data={founders.age_distribution} dataKey="bucket" label="Age Distribution" />
        <HorizontalBarChart data={founders.gender_split} dataKey="label" label="Gender Split" />
        <HorizontalBarChart data={founders.top_nationalities} dataKey="label" label="Top Nationalities" />
        <HorizontalBarChart data={founders.top_universities} dataKey="label" label="Top Universities" />
      </div>
    </section>
  )
}
