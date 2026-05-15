'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { ExplorerChartCard } from '@/components/domain/explorer'

const BUCKETS = [
  { label: '<-20%', min: -Infinity, max: -20 },
  { label: '-20–-10', min: -20, max: -10 },
  { label: '-10–-5', min: -10, max: -5 },
  { label: '-5–-2', min: -5, max: -2 },
  { label: '-2–+2', min: -2, max: 2 },
  { label: '+2–+5', min: 2, max: 5 },
  { label: '+5–+10', min: 5, max: 10 },
  { label: '+10–+20', min: 10, max: 20 },
  { label: '>+20%', min: 20, max: Infinity },
]

function bucketColor(label: string): string {
  if (label.includes('-2–+2')) return '#0071E3'
  if (label.includes('-5') || label.includes('+5')) return '#5AC8FA'
  if (label.includes('-10') || label.includes('+10')) return '#B25600'
  if (label.includes('-20') || label.includes('+20') || label.includes('<') || label.includes('>')) return '#D70015'
  return '#86868b'
}

export function SettlementVolatilityChart() {
  const t = useTranslations('pages')
  const [values, setValues] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dn/batches/settlement-distribution?limit=5000')
      .then(r => r.ok ? r.json() : { values: [] })
      .then(data => setValues(data.values ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const histogram = useMemo(() => {
    return BUCKETS.map(b => ({
      label: b.label,
      count: values.filter(v => v >= b.min && v < b.max).length,
    }))
  }, [values])

  const tieZone = useMemo(() => {
    if (values.length === 0) return null
    const nearZero = values.filter(v => v >= -2 && v < 2).length
    return ((nearZero / values.length) * 100).toFixed(0)
  }, [values])

  return (
    <ExplorerChartCard
      title={t('explorer.vision_section.settlement_volatility')}
      subtitle={
        tieZone != null
          ? `${tieZone}% ${t('explorer.vision_section.settlement_in_tie_zone')}`
          : undefined
      }
      loading={loading}
    >
      {values.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={histogram} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: '#86868b' }}
              stroke="#D2D2D7"
              interval={0}
              angle={-30}
              textAnchor="end"
              height={40}
            />
            <YAxis tick={{ fontSize: 10, fill: '#86868b' }} stroke="#D2D2D7" allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 6, background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(0,0,0,0.08)' }}
              labelStyle={{ color: '#1d1d1f' }}
              itemStyle={{ color: '#6e6e73' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36} name={t('explorer.vision_section.settlements')}>
              {histogram.map((entry, i) => (
                <Cell key={i} fill={bucketColor(entry.label)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-caption text-[#86868b]">{t('explorer.vision_section.no_settlement_data')}</p>
        </div>
      )}
    </ExplorerChartCard>
  )
}
