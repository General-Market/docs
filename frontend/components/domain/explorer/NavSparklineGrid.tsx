'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ResponsiveContainer, LineChart, Line } from 'recharts'
import { useSSENav } from '@/hooks/useSSE'
import { ExplorerChartCard } from '@/components/domain/explorer'

interface OhlcPoint {
  time: number
  close: string
}

interface ItpSparkline {
  itp_id: string
  symbol: string
  nav_per_share: number
  aum_usd: number
  points: { time: number; close: number }[]
}

export function NavSparklineGrid() {
  const t = useTranslations('pages')
  const navList = useSSENav()
  const [sparklines, setSparklines] = useState<ItpSparkline[]>([])
  const [loading, setLoading] = useState(true)

  const topItps = useMemo(() => {
    return [...navList]
      .filter(n => BigInt(n.total_supply || '0') > 0n)
      .sort((a, b) => (b.aum_usd || 0) - (a.aum_usd || 0))
      .slice(0, 8)
  }, [navList])

  useEffect(() => {
    if (topItps.length === 0) return

    const now = new Date()
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const to = now.toISOString()

    Promise.all(
      topItps.map(async (itp) => {
        try {
          const res = await fetch(
            `/api/dn/nav-series?itp_id=${itp.itp_id}&from=${from}&to=${to}&interval=1d`
          )
          if (!res.ok) return null
          const data = await res.json()
          return {
            itp_id: itp.itp_id,
            symbol: itp.symbol || itp.name || 'ITP',
            nav_per_share: itp.nav_per_share,
            aum_usd: itp.aum_usd || 0,
            points: (data.points || []).map((p: OhlcPoint) => ({
              time: p.time,
              close: parseFloat(p.close),
            })),
          } as ItpSparkline
        } catch {
          return null
        }
      })
    ).then(results => {
      setSparklines(results.filter(Boolean) as ItpSparkline[])
      setLoading(false)
    })
  }, [topItps])

  return (
    <ExplorerChartCard
      title={t('explorer.itp_section.nav_sparklines')}
      subtitle={t('explorer.itp_section.nav_sparklines_desc')}
      loading={loading && navList.length === 0}
      className="md:col-span-2"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {sparklines.map(s => {
          const first = s.points[0]?.close ?? 0
          const last = s.points[s.points.length - 1]?.close ?? 0
          const change = first > 0 ? ((last - first) / first) * 100 : 0
          const color = change >= 0 ? '#10b981' : '#ef4444'

          return (
            <div key={s.itp_id} className="bg-white/[0.04] rounded-lg p-2.5">
              <div className="flex items-baseline justify-between mb-0.5">
                <span className="text-label font-bold text-white truncate">{s.symbol}</span>
                <span className={`text-micro font-mono ${change >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                </span>
              </div>
              <div className="text-micro text-white/40 mb-1 font-mono">
                ${s.nav_per_share.toFixed(4)}
              </div>
              <div className="h-[40px]">
                {s.points.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={s.points}>
                      <Line
                        type="monotone"
                        dataKey="close"
                        stroke={color}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-micro text-white/20">&mdash;</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {sparklines.length === 0 && !loading && navList.length > 0 && (
          <div className="col-span-full text-center py-4 text-caption text-white/40">
            {t('explorer.itp_section.no_data')}
          </div>
        )}
      </div>
    </ExplorerChartCard>
  )
}
