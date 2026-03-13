'use client'

import Image from 'next/image'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getUniversityLogo } from '@/lib/university-logos'
import type { SectionProps } from '../SectionRenderer'

const BRAND_COLOR = '#111827'

function HorizontalBarChart({ data, dataKey, label }: {
  data: { label?: string; bucket?: string; count: number }[]
  dataKey: string
  label: string
}) {
  if (data.length === 0) return null
  return (
    <div className="py-4">
      <h3 className="text-sm font-semibold text-text-secondary mb-3">
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

function UniversityChart({ data }: { data: { label: string; count: number }[] }) {
  if (data.length === 0) return null
  const maxCount = Math.max(...data.map(d => d.count))

  return (
    <div className="py-4">
      <h3 className="text-sm font-semibold text-text-secondary mb-3">
        Top Universities
      </h3>
      <div className="flex flex-col gap-1.5">
        {data.map(({ label, count }) => {
          const logoUrl = getUniversityLogo(label)
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
          return (
            <div key={label} className="flex items-center gap-2 h-[26px]">
              <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={label}
                    width={16}
                    height={16}
                    className="rounded-sm object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="w-4 h-4 rounded-sm bg-gray-200" />
                )}
              </div>
              <span className="text-[11px] text-gray-500 w-[90px] truncate flex-shrink-0" title={label}>
                {label}
              </span>
              <div className="flex-1 flex items-center gap-1.5">
                <div className="flex-1 h-[18px] bg-gray-50 rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-r-[3px]"
                    style={{ width: `${pct}%`, backgroundColor: BRAND_COLOR }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 w-5 text-right flex-shrink-0">
                  {count}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FounderDemographics({ enrichment }: SectionProps) {
  const founders = enrichment?.founders
  if (!founders || founders.total_founders === 0) return null

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-text-primary">
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
        <UniversityChart data={founders.top_universities} />
      </div>
    </section>
  )
}
