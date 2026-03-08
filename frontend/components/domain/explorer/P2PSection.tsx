'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { AggregatedSnapshot, computeDeltas } from '@/hooks/useExplorerHealth'
import { ExplorerChartCard } from '@/components/domain/explorer'

interface SectionProps {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
}

const tickFormatter = (v: string) =>
  new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export function P2PSection({ snapshots, latest, loading }: SectionProps) {
  const peersData = useMemo(
    () => snapshots.map((s) => ({ time: s.poll_batch_ts, total_peers: s.total_peers })),
    [snapshots]
  )

  const sentDeltas = useMemo(() => computeDeltas(snapshots, 'p2p_messages_sent'), [snapshots])
  const receivedDeltas = useMemo(() => computeDeltas(snapshots, 'p2p_messages_received'), [snapshots])

  const messagesData = useMemo(() => {
    const map = new Map<string, { time: string; sent: number; received: number }>()
    for (const d of sentDeltas) {
      map.set(d.time, { time: d.time, sent: d.delta, received: 0 })
    }
    for (const d of receivedDeltas) {
      const existing = map.get(d.time)
      if (existing) {
        existing.received = d.delta
      } else {
        map.set(d.time, { time: d.time, sent: 0, received: d.delta })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.time.localeCompare(b.time))
  }, [sentDeltas, receivedDeltas])

  const peerHealthData = useMemo(
    () =>
      snapshots.map((s) => ({
        time: s.poll_batch_ts,
        healthy: s.total_peers_healthy,
        unhealthy: s.total_peers_unhealthy,
      })),
    [snapshots]
  )

  return (
    <section>
      <h2 className="text-[16px] font-black tracking-[-0.02em] text-black mb-4">P2P Network</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Connected Peers */}
        <ExplorerChartCard title="Connected Peers" subtitle="Total peers over time" loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={peersData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tickFormatter={tickFormatter} tick={{ fontSize: 10 }} stroke="#ccc" />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                contentStyle={{ fontSize: 12 }}
              />
              <Area type="monotone" dataKey="total_peers" stroke="#000" fill="#000" fillOpacity={0.08} />
            </AreaChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* Messages Sent / Received */}
        <ExplorerChartCard title="Messages Sent / Received" subtitle="Delta per snapshot interval" loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={messagesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tickFormatter={tickFormatter} tick={{ fontSize: 10 }} stroke="#ccc" />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                contentStyle={{ fontSize: 12 }}
              />
              <Line type="monotone" dataKey="sent" stroke="#000" strokeWidth={1.5} dot={false} name="Sent" />
              <Line type="monotone" dataKey="received" stroke="#6b7280" strokeWidth={1.5} dot={false} name="Received" />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* Peer Health */}
        <ExplorerChartCard title="Peer Health" subtitle="Healthy vs unhealthy peers" loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={peerHealthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tickFormatter={tickFormatter} tick={{ fontSize: 10 }} stroke="#ccc" />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                contentStyle={{ fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="healthy"
                stackId="1"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                name="Healthy"
              />
              <Area
                type="monotone"
                dataKey="unhealthy"
                stackId="1"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.3}
                name="Unhealthy"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* Placeholder for additional P2P graphs */}
        <ExplorerChartCard title="Network Topology & Per-Peer Rates" loading={loading}>
          <div className="h-full flex items-center justify-center">
            <p className="text-[12px] text-text-muted text-center px-4">
              Topology maps, per-peer message rates, and connection-level metrics require data not available from /health snapshots.
            </p>
          </div>
        </ExplorerChartCard>
      </div>
    </section>
  )
}
