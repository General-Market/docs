'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useReadContract } from 'wagmi'
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'
import { ExplorerChartCard } from '@/components/domain/explorer'

interface BatchData {
  id: number
  source_id: string
  tvl: string
  player_count: number
  paused: boolean
}

function getSourceName(sourceId: string): string {
  return sourceId.replace(/_/g, ' ')
}

function truncateLabel(label: string, max = 18): string {
  return label.length > max ? label.slice(0, max - 1) + '\u2026' : label
}

function formatUsdc(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
  if (val >= 1) return `$${val.toFixed(2)}`
  if (val >= 0.01) return `$${val.toFixed(4)}`
  return `$${val.toFixed(6)}`
}

const FEE_BPS = 5
const BPS_DENOM = 10_000

export function FeesCollectedChart() {
  const t = useTranslations('pages')
  const { getAddress } = useDeployment()
  const visionAddress = getAddress('Vision')

  // Read accumulated fees from chain
  const { data: rawFees, isLoading: feesLoading } = useReadContract({
    address: visionAddress,
    abi: VISION_ABI,
    functionName: 'accumulatedRealFees',
    chainId: indexL3.id,
    query: {
      enabled: visionAddress !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 30_000,
    },
  })

  const accumulatedFees = rawFees ? Number(rawFees as bigint) / 1e18 : 0

  // Fetch batch data to estimate per-source fees from TVL
  const [batches, setBatches] = useState<BatchData[]>([])
  const [batchLoading, setBatchLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/vision/batches')
      .then(r => r.ok ? r.json() : { batches: [] })
      .then(data => { if (!cancelled) setBatches(data.batches ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBatchLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Estimate fee contribution per source based on TVL (proxy for volume)
  const feesBySource = useMemo(() => {
    const tvlBySource: Record<string, number> = {}
    let totalTvl = 0
    for (const b of batches) {
      const tvl = Number(BigInt(b.tvl || '0')) / 1e18
      tvlBySource[b.source_id] = (tvlBySource[b.source_id] ?? 0) + tvl
      totalTvl += tvl
    }

    if (totalTvl === 0 || accumulatedFees === 0) return []

    return Object.entries(tvlBySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([source, tvl]) => ({
        source: truncateLabel(getSourceName(source), 16),
        fullName: getSourceName(source),
        estimatedFees: (tvl / totalTvl) * accumulatedFees,
        tvl,
      }))
  }, [batches, accumulatedFees])

  const loading = feesLoading || batchLoading

  return (
    <ExplorerChartCard
      title={t('explorer.vision_section.fees_collected')}
      subtitle={t('explorer.vision_section.fees_collected_desc')}
      loading={loading}
    >
      <div className="h-full flex flex-col">
        {/* Header stats */}
        <div className="flex items-baseline gap-4 mb-3">
          <div>
            <span className="text-label text-[#86868b] block tracking-apple-loose">
              {t('explorer.vision_section.accumulated_fees')}
            </span>
            <span className="text-heading font-display font-semibold text-[#1d1d1f] tracking-apple-tighter">
              {formatUsdc(accumulatedFees)}
            </span>
          </div>
          <div className="ml-auto text-right">
            <span className="text-label text-[#86868b] block tracking-apple-loose">
              {t('explorer.vision_section.fee_rate')}
            </span>
            <span className="text-subhead font-semibold text-[#1d1d1f]">
              {(FEE_BPS / BPS_DENOM * 100).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Bar chart: estimated fees by source */}
        <div className="flex-1 min-h-0">
          {feesBySource.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={feesBySource}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 4 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#86868b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatUsdc(v)}
                />
                <YAxis
                  type="category"
                  dataKey="source"
                  tick={{ fontSize: 9, fill: '#6e6e73' }}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 12,
                    background: '#ffffff',
                    border: '1px solid #D2D2D7',
                  }}
                  labelStyle={{ color: '#1d1d1f' }}
                  itemStyle={{ color: '#6e6e73' }}
                  formatter={(v: number, _: string, entry: any) => [
                    formatUsdc(v),
                    entry.payload.fullName,
                  ]}
                  labelFormatter={() => t('explorer.vision_section.estimated_per_source')}
                />
                <Bar dataKey="estimatedFees" radius={[0, 3, 3, 0]} maxBarSize={14}>
                  {feesBySource.map((_, i) => (
                    <Cell
                      key={i}
                      fill="#1F8F4D"
                      fillOpacity={Math.max(0.3, 1 - i * 0.07)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-caption text-[#86868b]">
                {t('explorer.vision_section.no_fee_data')}
              </p>
            </div>
          )}
        </div>
      </div>
    </ExplorerChartCard>
  )
}
