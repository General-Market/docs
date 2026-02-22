'use client'

import { formatUnits } from 'viem'
import { useTranslations } from 'next-intl'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useSystemStatus } from '@/hooks/useSystemStatus'
import type { DeployedItpRef } from '@/components/domain/ItpListing'

const NODE_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta']

/** Format large USD values compactly: $1.2B, $345M, $12.3K, $1,234.56 */
function formatUsdCompact(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e4) return `$${(value / 1e3).toFixed(1)}K`
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || '—'
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

function truncateItpId(itpId: string): string {
  if (!itpId || itpId.length < 12) return itpId || '—'
  return itpId.slice(0, 6) + '…' + itpId.slice(-4)
}

function formatTimestamp(unix: number): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatTime(unix: number): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

interface SystemStatusSectionProps {
  deployedItps?: DeployedItpRef[]
}

export function SystemStatusSection({ deployedItps }: SystemStatusSectionProps) {
  const t = useTranslations('system')
  const sys = useSystemStatus()

  // Build ITP name lookup: itpId → display name
  const itpNameMap = new Map<string, string>()
  if (deployedItps) {
    for (const itp of deployedItps) {
      const key = itp.itpId.toLowerCase()
      itpNameMap.set(key, itp.symbol ? `$${itp.symbol}` : itp.name)
    }
  }

  const activeNodes = sys.nodes.filter(n => n.status === 1)

  const stats = [
    {
      label: t('stats.consensus_status'),
      value: sys.isLoading ? t('consensus_values.checking') : sys.isHealthy ? t('consensus_values.healthy') : t('consensus_values.offline'),
      color: sys.isLoading ? 'text-text-muted' : sys.isHealthy ? 'text-color-up' : 'text-color-down',
      fontSize: 'text-[18px]',
    },
    { label: t('stats.active_issuers'), value: `${sys.activeIssuers} / ${sys.totalIssuers}` },
    {
      label: t('stats.avg_fill_speed'),
      value: sys.avgFillTimeSeconds > 0 ? `${sys.avgFillTimeSeconds.toFixed(1)}s` : '—',
    },
    { label: t('stats.orders_total'), value: sys.totalOrders.toLocaleString() },
    {
      label: t('stats.l3_block'),
      value: sys.l3BlockNumber > 0n ? `#${sys.l3BlockNumber.toLocaleString()}` : '—',
      fontSize: 'text-[16px]',
    },
  ]

  return (
    <div>
      {/* Section header */}
      <div className="pt-10 pb-0">
        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">{t('heading.label')}</p>
        <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">{t('heading.title')}</h2>
        <p className="text-[14px] text-text-secondary mt-1.5">{t('heading.description')}</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 py-5 border-b border-border-light mt-0">
        {stats.map((stat, idx) => (
          <div
            key={stat.label}
            className={`py-3 px-4 md:px-6 ${idx > 0 ? 'md:border-l border-border-light' : 'md:pl-0'} ${idx >= 2 ? 'border-t md:border-t-0 border-border-light' : ''}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{stat.label}</p>
            <p className={`${stat.fontSize || 'text-[22px]'} font-extrabold font-mono tabular-nums ${stat.color || 'text-black'}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Content area */}
      <div className="py-5 pb-10">

        {/* ISSUER NETWORK — BLS Consensus Nodes */}
        <div className="section-bar">
          <div>
            <div className="section-bar-title">{t('issuer_network.section_title')}</div>
            <div className="section-bar-value">{t('issuer_network.section_subtitle')}</div>
          </div>
        </div>

        {/* Node grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 border border-border-light" style={{ margin: '20px 0' }}>
          {activeNodes.length === 0 && (
            <NodeGridSkeleton />
          )}
          {activeNodes.map((node, idx) => (
            <div key={node.id} className={`px-5 py-4 ${idx < activeNodes.length - 1 ? 'border-r border-border-light' : ''}`}>
              <div className="text-[13px] font-extrabold text-black mb-2">
                <span className="text-color-up">●</span> {t('issuer_network.issuer_label', { name: NODE_NAMES[idx] || node.id })}
              </div>
              <div>
                {[
                  { label: t('issuer_network.node_details.address'), value: truncateAddr(node.addr) },
                  { label: t('issuer_network.node_details.bls_pubkey'), value: node.blsPubkeyShort },
                  { label: t('issuer_network.node_details.registered'), value: formatTimestamp(node.registeredAt) },
                  { label: t('issuer_network.node_details.status'), value: t('issuer_network.status_active'), color: 'text-color-up' },
                  { label: t('issuer_network.node_details.ap_vault'), value: formatUsdCompact(sys.vaultUsdValue), color: 'text-color-up' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-[3px]">
                    <span className="text-[11px] text-text-muted font-medium">{row.label}</span>
                    <span className={`text-[11px] font-semibold font-mono ${row.color || 'text-black'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ margin: '24px 0' }}>
          {/* Fill Speed bar chart */}
          <div>
            <div className="section-bar">
              <div>
                <div className="section-bar-title">{t('fill_speed.section_title')}</div>
                <div className="section-bar-value">{t('fill_speed.section_subtitle')}</div>
              </div>
            </div>
            <div className="border border-border-light border-t-0 bg-surface h-[220px] flex items-center justify-center overflow-hidden">
              {sys.fillTimeBuckets.length === 0 ? (
                <ChartSkeleton bars={8} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sys.fillTimeBuckets} margin={{ top: 16, right: 16, bottom: 4, left: -8 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} unit="s" width={36} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, border: '1px solid #e5e5e5', borderRadius: 4 }}
                      formatter={(v: number) => [`${v.toFixed(1)}s`, t('fill_speed.tooltip_label')]}
                    />
                    <Bar dataKey="seconds" radius={[3, 3, 0, 0]} maxBarSize={32}>
                      {sys.fillTimeBuckets.map((_, i) => (
                        <Cell key={i} fill="#22c55e" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Inventory — top vault holdings */}
          <div>
            <div className="section-bar">
              <div>
                <div className="section-bar-title">{t('inventory.section_title')}</div>
                <div className="section-bar-value">{t('inventory.section_subtitle')}</div>
              </div>
            </div>
            <div className="border border-border-light border-t-0 bg-surface h-[220px] flex items-center justify-center overflow-hidden">
              {sys.topVaultAssets.length === 0 ? (
                <ChartSkeleton bars={6} horizontal />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sys.topVaultAssets} layout="vertical" margin={{ top: 8, right: 24, bottom: 4, left: 4 }}>
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#888' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatUsdCompact(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="symbol"
                      tick={{ fontSize: 10, fill: '#888' }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, border: '1px solid #e5e5e5', borderRadius: 4 }}
                      formatter={(v: number) => [formatUsdCompact(v), t('inventory.tooltip_label')]}
                    />
                    <Bar dataKey="usdValue" radius={[0, 3, 3, 0]} maxBarSize={18}>
                      {sys.topVaultAssets.map((_, i) => (
                        <Cell key={i} fill="#3b82f6" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* RECENT ACTIVITY — Keeper BLS Signatures */}
        <div className="section-bar">
          <div>
            <div className="section-bar-title">{t('recent_activity.section_title')}</div>
            <div className="section-bar-value">{t('recent_activity.section_subtitle')}</div>
          </div>
        </div>

        {/* Data table */}
        <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] min-w-[640px]">
          <thead>
            <tr>
              {[t('recent_activity.table.time'), t('recent_activity.table.order_id'), t('recent_activity.table.fund'), t('recent_activity.table.type'), t('recent_activity.table.amount'), t('recent_activity.table.fill_time'), t('recent_activity.table.signers'), t('recent_activity.table.status')].map((h, i) => (
                <th
                  key={h}
                  className={`text-left text-[11px] font-bold uppercase tracking-[0.06em] text-text-secondary px-4 py-3 border-b-[3px] border-black whitespace-nowrap ${
                    i === 4 || i === 5 ? 'text-right' : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sys.recentOrders.length === 0 && (
              <TableRowsSkeleton cols={8} rows={4} />
            )}
            {sys.recentOrders.map((order) => {
              const amountFormatted = `$${Number(formatUnits(order.amount, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              return (
                <tr key={order.orderId.toString()} className="hover:bg-surface">
                  <td className="px-4 py-3 border-b border-border-light font-mono text-text-secondary tabular-nums">
                    {formatTime(order.blockTimestamp)}
                  </td>
                  <td className="px-4 py-3 border-b border-border-light font-mono text-[11px] text-text-secondary">
                    #{order.orderId.toString()}
                  </td>
                  <td className="px-4 py-3 border-b border-border-light font-bold text-black">
                    {itpNameMap.get(order.itpId.toLowerCase()) || truncateItpId(order.itpId)}
                  </td>
                  <td className="px-4 py-3 border-b border-border-light text-text-secondary">
                    {order.side === 0 ? t('recent_activity.side_buy') : t('recent_activity.side_sell')}
                  </td>
                  <td className="px-4 py-3 border-b border-border-light text-right font-mono tabular-nums text-[12px] text-text-secondary">
                    {amountFormatted}
                  </td>
                  <td className="px-4 py-3 border-b border-border-light text-right font-mono tabular-nums text-[12px] text-text-secondary">
                    {order.fillTimeSeconds != null ? `${order.fillTimeSeconds.toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-4 py-3 border-b border-border-light text-text-secondary">
                    {order.status === 'filled' ? `${sys.activeIssuers}/${sys.totalIssuers}` : '—'}
                  </td>
                  <td className={`px-4 py-3 border-b border-border-light font-bold ${order.status === 'filled' ? 'text-color-up' : 'text-color-warning'}`}>
                    {order.status === 'filled' ? t('recent_activity.status_confirmed') : t('recent_activity.status_pending')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

/* ── Skeleton helpers ── */
function Bone({ w = 'w-20', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-border-light rounded animate-pulse`} />
}

function NodeGridSkeleton() {
  return (
    <>
      {[0, 1, 2].map(idx => (
        <div key={idx} className={`px-5 py-4 ${idx < 2 ? 'border-r border-border-light' : ''}`}>
          <div className="text-[13px] font-extrabold text-black mb-2 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-border-light animate-pulse" />
            <Bone w="w-20" h="h-4" />
          </div>
          <div className="space-y-[6px]">
            {['Address', 'BLS Pubkey', 'Registered', 'Status', 'AP Vault'].map(label => (
              <div key={label} className="flex justify-between items-center py-[3px]">
                <span className="text-[11px] text-text-muted font-medium">{label}</span>
                <Bone w={label === 'Address' ? 'w-24' : label === 'BLS Pubkey' ? 'w-28' : 'w-16'} h="h-3" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function ChartSkeleton({ bars, horizontal }: { bars: number; horizontal?: boolean }) {
  if (horizontal) {
    return (
      <div className="w-full h-full flex flex-col justify-center gap-2.5 px-6 py-4">
        {Array.from({ length: bars }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Bone w="w-10" h="h-3" />
            <div
              className="h-3 bg-border-light rounded animate-pulse"
              style={{ width: `${30 + Math.random() * 60}%`, animationDelay: `${i * 100}ms` }}
            />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="w-full h-full flex items-end justify-around px-6 pb-6 pt-4 gap-1.5">
      {Array.from({ length: bars }, (_, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-border-light rounded-t animate-pulse"
            style={{ height: `${20 + Math.random() * 70}%`, animationDelay: `${i * 80}ms` }}
          />
          <Bone w="w-6" h="h-2" />
        </div>
      ))}
    </div>
  )
}

function TableRowsSkeleton({ cols, rows }: { cols: number; rows: number }) {
  const widths = ['w-16', 'w-10', 'w-20', 'w-12', 'w-16', 'w-14', 'w-16', 'w-20']
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-border-light">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-4 py-3">
              <Bone w={widths[c] || 'w-16'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
