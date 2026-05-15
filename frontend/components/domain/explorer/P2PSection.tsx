'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('pages')

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
      <h2 className="text-subhead font-display font-semibold tracking-apple-tighter text-[#1d1d1f] mb-4">{t('explorer.p2p_section.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Connected Peers */}
        <ExplorerChartCard title={t('explorer.p2p_section.connected_peers')} subtitle={t('explorer.p2p_section.connected_peers_desc')} loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={peersData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
              <XAxis dataKey="time" tickFormatter={tickFormatter} tick={{ fontSize: 10 }} stroke="#D2D2D7" />
              <YAxis tick={{ fontSize: 10 }} stroke="#D2D2D7" allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                contentStyle={{ fontSize: 12 }}
              />
              <Area type="monotone" dataKey="total_peers" stroke="#1d1d1f" fill="#1d1d1f" fillOpacity={0.08} />
            </AreaChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* Messages Sent / Received */}
        <ExplorerChartCard title={t('explorer.p2p_section.messages_sent_received')} subtitle={t('explorer.p2p_section.messages_desc')} loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={messagesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
              <XAxis dataKey="time" tickFormatter={tickFormatter} tick={{ fontSize: 10 }} stroke="#D2D2D7" />
              <YAxis tick={{ fontSize: 10 }} stroke="#D2D2D7" allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                contentStyle={{ fontSize: 12 }}
              />
              <Line type="monotone" dataKey="sent" stroke="#1d1d1f" strokeWidth={1.5} dot={false} name={t('explorer.p2p_section.sent')} />
              <Line type="monotone" dataKey="received" stroke="#6b7280" strokeWidth={1.5} dot={false} name={t('explorer.p2p_section.received')} />
            </LineChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

        {/* Peer Health */}
        <ExplorerChartCard title={t('explorer.p2p_section.peer_health')} subtitle={t('explorer.p2p_section.peer_health_desc')} loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={peerHealthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
              <XAxis dataKey="time" tickFormatter={tickFormatter} tick={{ fontSize: 10 }} stroke="#D2D2D7" />
              <YAxis tick={{ fontSize: 10 }} stroke="#D2D2D7" allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                contentStyle={{ fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="healthy"
                stackId="1"
                stroke="#1F8F4D"
                fill="#1F8F4D"
                fillOpacity={0.3}
                name={t('explorer.p2p_section.healthy')}
              />
              <Area
                type="monotone"
                dataKey="unhealthy"
                stackId="1"
                stroke="#D70015"
                fill="#D70015"
                fillOpacity={0.3}
                name={t('explorer.p2p_section.unhealthy')}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ExplorerChartCard>

      </div>
    </section>
  )
}
