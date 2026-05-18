'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { ExplorerChartCard } from '@/components/domain/explorer'

type Range = '24h' | '7d' | '30d'

interface BalancePoint {
  ts: string
  balance: number
}

interface WalletSeries {
  wallet: string
  label: string
  chain: 'l3' | 'sonic'
  points: BalancePoint[]
}

interface RosterEntry {
  address: string
  label: string
}

interface BalancesResponse {
  range: Range
  series: WalletSeries[]
  roster: RosterEntry[]
}

const RANGES: Range[] = ['24h', '7d', '30d']

const LINE_COLORS = [
  '#0071E3', // marketing blue (oracle-1 main)
  '#1F8F4D', // green (oracle-2 main / treasury)
  '#FF9F0A', // amber (oracle-3 main)
  '#5856D6', // indigo (fleet 1a)
  '#AF52DE', // purple (fleet 1b)
  '#FF2D55', // pink (fleet 2a)
  '#FF6482', // rose (fleet 2b)
  '#34C759', // mint (fleet 3a)
  '#64D2FF', // sky (fleet 3b)
]

function formatBalance(v: number, unit: string): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M ${unit}`
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}k ${unit}`
  if (v >= 1) return `${v.toFixed(2)} ${unit}`
  if (v >= 0.01) return `${v.toFixed(4)} ${unit}`
  if (v > 0) return `${v.toFixed(6)} ${unit}`
  return `0 ${unit}`
}

function formatTime(iso: string, range: Range): string {
  const d = new Date(iso)
  if (range === '24h') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Pivot a list of per-wallet point series into a single rows-by-timestamp shape
 * for Recharts. Each row: { ts: ISO, <walletShort>: balance, ... }
 */
function pivot(series: WalletSeries[]): { rows: Record<string, number | string>[]; columns: { key: string; label: string; address: string }[] } {
  const tsSet = new Set<string>()
  for (const s of series) for (const p of s.points) tsSet.add(p.ts)
  const timestamps = Array.from(tsSet).sort()

  const columns = series.map((s) => ({
    key: s.wallet,
    label: s.label,
    address: s.wallet,
  }))

  const byKey: Record<string, Record<string, number>> = {}
  for (const s of series) {
    const m: Record<string, number> = {}
    for (const p of s.points) m[p.ts] = p.balance
    byKey[s.wallet] = m
  }

  const rows = timestamps.map((ts) => {
    const row: Record<string, number | string> = { ts }
    for (const c of columns) {
      const v = byKey[c.key]?.[ts]
      if (v !== undefined) row[c.key] = v
    }
    return row
  })

  return { rows, columns }
}

function ChainPanel({
  title,
  unit,
  data,
  roster,
  range,
}: {
  title: string
  unit: string
  data: WalletSeries[]
  roster: RosterEntry[]
  range: Range
}) {
  const { rows, columns } = useMemo(() => pivot(data), [data])
  const empty = rows.length === 0

  // Roster order — keep colors stable across panels and ranges by indexing on the static roster.
  const rosterIndex = useMemo(() => {
    const m = new Map<string, number>()
    roster.forEach((r, i) => m.set(r.address.toLowerCase(), i))
    return m
  }, [roster])

  return (
    <ExplorerChartCard
      title={title}
      subtitle={empty ? 'Awaiting first poll — the collector runs hourly.' : `${data.length} wallets · hourly`}
      bodyClassName="h-[420px]"
    >
      {empty ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-caption text-[#86868b]">No snapshots yet for the selected range.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="#E5E5EA" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ts"
              tick={{ fontSize: 10, fill: '#86868b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => formatTime(v, range)}
              minTickGap={32}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#86868b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatBalance(v, '')}
              width={64}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'saturate(180%) blur(20px)',
                border: '1px solid #D2D2D7',
                padding: '8px 10px',
              }}
              labelStyle={{ color: '#1d1d1f', marginBottom: 4 }}
              itemStyle={{ color: '#1d1d1f' }}
              formatter={(v: number) => formatBalance(v, unit)}
              labelFormatter={(v: string) => new Date(v).toLocaleString()}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => {
                const col = columns.find((c) => c.key === value)
                return col ? col.label : value
              }}
            />
            {columns.map((c) => {
              const idx = rosterIndex.get(c.address.toLowerCase()) ?? 0
              return (
                <Line
                  key={c.key}
                  type="monotone"
                  dataKey={c.key}
                  name={c.key}
                  stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ExplorerChartCard>
  )
}

export default function OracleBalancesClient() {
  const [range, setRange] = useState<Range>('7d')
  const [data, setData] = useState<BalancesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/oracle/balances?range=${range}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: BalancesResponse) => { if (!cancelled) setData(d) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [range])

  const { l3, sonic, roster } = useMemo(() => {
    const series = data?.series ?? []
    return {
      l3: series.filter((s) => s.chain === 'l3'),
      sonic: series.filter((s) => s.chain === 'sonic'),
      roster: data?.roster ?? [],
    }
  }, [data])

  return (
    <div className="max-w-[1068px] mx-auto px-6 py-12">
      <header className="mb-8">
        <h1 className="text-display font-semibold tracking-apple-tighter text-[#1d1d1f]">
          Oracle balances
        </h1>
        <p className="mt-3 text-body tracking-apple-tight text-[#6e6e73] max-w-[640px]">
          Hourly snapshot of native gas held by the oracle wallets. L3 is GM,
          Sonic testnet is S. The collector started at deploy — history fills
          forward.
        </p>
      </header>

      <div className="mb-6 flex items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`
              px-3 py-1.5 rounded-full text-label font-medium tracking-apple-tight
              transition-colors duration-150
              ${range === r
                ? 'bg-[#1d1d1f] text-white'
                : 'bg-[#F5F5F7] text-[#6e6e73] hover:bg-[#E5E5EA]'}
            `}
          >
            {r}
          </button>
        ))}
        {loading && (
          <span className="ml-2 text-caption text-[#86868b]">loading…</span>
        )}
        {error && (
          <span className="ml-2 text-caption text-[#FF3B30]">error: {error}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <ChainPanel title="L3 (GM)" unit="GM" data={l3} roster={roster} range={range} />
        <ChainPanel title="Sonic testnet (S)" unit="S" data={sonic} roster={roster} range={range} />
      </div>

      {roster.length > 0 && (
        <section className="mt-12">
          <h2 className="text-headline font-semibold tracking-apple-tight text-[#1d1d1f] mb-4">
            Wallet roster
          </h2>
          <div className="rounded-apple-md border border-[#E5E5EA] divide-y divide-[#E5E5EA] overflow-hidden">
            {roster.map((r, i) => (
              <div
                key={r.address}
                className="flex items-center gap-3 px-4 py-3 bg-white"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }}
                />
                <span className="text-label font-medium text-[#1d1d1f] flex-1 truncate">
                  {r.label}
                </span>
                <code className="text-caption text-[#6e6e73] font-mono">
                  {r.address}
                </code>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
