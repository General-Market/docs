'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { AggregatedSnapshot } from '@/hooks/useExplorerHealth'
import { ExplorerChartCard } from '@/components/domain/explorer'

interface SectionProps {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
}

const tickFormatter = (v: string) =>
  new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const ITP_IDS = [
  { id: '0x0000000000000000000000000000000000000000000000000000000000000001', label: 'ITP-1' },
  { id: '0x0000000000000000000000000000000000000000000000000000000000000002', label: 'ITP-2' },
]

interface ItpData {
  label: string
  nav_display: string
  aum_usd: string | null
  assets_total: number
  name: string | null
  symbol: string | null
  error: boolean
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

export function ITPSection({ snapshots, latest, loading }: SectionProps) {
  const [itpData, setItpData] = useState<ItpData[]>([])
  const [itpLoading, setItpLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchItpData() {
      const results = await Promise.all(
        ITP_IDS.map(async ({ id, label }) => {
          try {
            const res = await fetch(`/api/itp-price?itp_id=${encodeURIComponent(id)}`, {
              signal: AbortSignal.timeout(5_000),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            return {
              label,
              nav_display: data.nav_display || '0',
              aum_usd: data.aum_usd ?? null,
              assets_total: data.assets_total || 0,
              name: data.name ?? null,
              symbol: data.symbol ?? null,
              error: false,
            } as ItpData
          } catch {
            return {
              label,
              nav_display: '--',
              aum_usd: null,
              assets_total: 0,
              name: null,
              symbol: null,
              error: true,
            } as ItpData
          }
        })
      )

      if (!cancelled) {
        setItpData(results)
        setItpLoading(false)
      }
    }

    fetchItpData()
    const interval = setInterval(fetchItpData, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const pendingOrderData = useMemo(
    () =>
      snapshots.map((s) => ({
        time: s.poll_batch_ts,
        pending: s.pending_order_count,
      })),
    [snapshots]
  )

  return (
    <section>
      <h2 className="text-[16px] font-black tracking-[-0.02em] text-black mb-4">ITP Metrics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending Order Volume */}
        <ExplorerChartCard title="Pending Order Volume" subtitle="Pipeline activity proxy" loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pendingOrderData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tickFormatter={tickFormatter} tick={{ fontSize: 10 }} stroke="#ccc" />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                contentStyle={{ fontSize: 12 }}
              />
              <Area type="monotone" dataKey="pending" stroke="#000" fill="#000" fillOpacity={0.08} name="Pending Orders" />
            </AreaChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* Live ITP Metrics */}
        <ExplorerChartCard title="Live ITP Metrics" subtitle="NAV & composition from on-chain data" loading={itpLoading}>
          <div className="h-full flex flex-col justify-center px-1">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-light">
                  <th className="text-[11px] font-semibold text-text-muted pb-2 pr-3">Fund</th>
                  <th className="text-[11px] font-semibold text-text-muted pb-2 pr-3 text-right">NAV</th>
                  <th className="text-[11px] font-semibold text-text-muted pb-2 pr-3 text-right">AUM</th>
                  <th className="text-[11px] font-semibold text-text-muted pb-2 text-right">Assets</th>
                </tr>
              </thead>
              <tbody>
                {itpData.map((itp) => (
                  <tr key={itp.label} className="border-b border-border-light last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="text-[13px] font-bold text-black">
                        {itp.name || itp.label}
                      </span>
                      {itp.symbol && (
                        <span className="text-[11px] text-text-muted ml-1.5">{itp.symbol}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      {itp.error ? (
                        <span className="text-[12px] text-text-muted">--</span>
                      ) : (
                        <span className="text-[13px] font-mono font-semibold text-black">
                          ${itp.nav_display}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      {itp.error || itp.aum_usd == null ? (
                        <span className="text-[11px] text-text-muted">--</span>
                      ) : (
                        <span className="text-[12px] font-mono text-black">
                          {formatUsd(Number(itp.aum_usd))}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {itp.error ? (
                        <span className="text-[11px] text-text-muted">--</span>
                      ) : (
                        <span className="text-[12px] font-mono text-black">{itp.assets_total}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {itpData.length === 0 && !itpLoading && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-[12px] text-text-muted">
                      No ITP data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ExplorerChartCard>
      </div>
    </section>
  )
}
