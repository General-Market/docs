'use client'

import { useState } from 'react'
import { useExplorerHealth, type TimeRange } from '@/hooks/useExplorerHealth'
import { ExplorerSummaryBar } from '@/components/domain/explorer/ExplorerSummaryBar'

const TABS = [
  { id: 'consensus', label: 'Consensus' },
  { id: 'orders', label: 'Orders' },
  { id: 'prices', label: 'Price Feeds' },
  { id: 'p2p', label: 'P2P Network' },
  { id: 'cycles', label: 'Cycles' },
  { id: 'itp', label: 'ITP & NAV' },
  { id: 'vision', label: 'Vision' },
  { id: 'health', label: 'System Health' },
  { id: 'chain', label: 'Chain & Gas' },
] as const

type TabId = (typeof TABS)[number]['id']

const RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d']

export default function ExplorerPageClient() {
  const { snapshots, latest, loading, error, range, setRange, refresh } = useExplorerHealth()
  const [activeTab, setActiveTab] = useState<TabId>('consensus')

  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-site-wide mx-auto px-4 md:px-8">
        <div className="pt-10 pb-4">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">
            Network
          </p>
          <h1 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">
            Explorer
          </h1>
        </div>

        <ExplorerSummaryBar latest={latest} loading={loading} />

        <div className="flex items-center justify-between border-b border-border-light mt-4">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-black text-black'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded ${
                  range === r ? 'bg-black text-white' : 'text-text-muted hover:text-black'
                }`}
              >
                {r}
              </button>
            ))}
            <button
              onClick={refresh}
              disabled={loading}
              className="ml-2 px-3 py-1 text-[11px] font-bold text-text-muted hover:text-black disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 border border-color-down/50 bg-surface-down rounded-card px-4 py-3">
            <p className="text-color-down text-[13px] font-semibold">{error}</p>
            <button onClick={refresh} className="mt-2 text-[12px] font-bold text-color-info underline">
              Retry
            </button>
          </div>
        )}

        <div className="py-6 pb-16">
          <SectionPlaceholder tab={activeTab} snapshots={snapshots} latest={latest} loading={loading} />
        </div>
      </div>
    </main>
  )
}

// Placeholder — will be replaced by real section components in Task 9
function SectionPlaceholder({ tab, snapshots, latest, loading }: {
  tab: string
  snapshots: any[]
  latest: any
  loading: boolean
}) {
  return (
    <div className="bg-white border border-border-light rounded-card p-8 text-center">
      <p className="text-[14px] font-semibold text-text-muted">
        {tab.charAt(0).toUpperCase() + tab.slice(1)} section — {snapshots.length} data points loaded
      </p>
      <p className="text-[12px] text-text-muted mt-1">
        Charts will be implemented in Task 9
      </p>
    </div>
  )
}
