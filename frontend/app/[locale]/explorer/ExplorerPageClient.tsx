'use client'

import { useState } from 'react'
import { useExplorerHealth, type TimeRange } from '@/hooks/useExplorerHealth'
import { ExplorerSummaryBar } from '@/components/domain/explorer/ExplorerSummaryBar'
import { ConsensusSection } from '@/components/domain/explorer/ConsensusSection'
import { OrdersSection } from '@/components/domain/explorer/OrdersSection'
import { PriceFeedSection } from '@/components/domain/explorer/PriceFeedSection'
import { P2PSection } from '@/components/domain/explorer/P2PSection'
import { CycleSection } from '@/components/domain/explorer/CycleSection'
import { ITPSection } from '@/components/domain/explorer/ITPSection'
import { VisionSection } from '@/components/domain/explorer/VisionSection'
import { SystemHealthSection } from '@/components/domain/explorer/SystemHealthSection'
import { ChainGasSection } from '@/components/domain/explorer/ChainGasSection'
import { SourcesExplorerSection } from '@/components/domain/explorer/SourcesExplorerSection'
import { SystemExplorerSection } from '@/components/domain/explorer/SystemExplorerSection'

const TABS = [
  { id: 'consensus', label: 'Consensus' },
  { id: 'orders', label: 'Orders' },
  { id: 'prices', label: 'Price Feeds' },
  { id: 'p2p', label: 'P2P Network' },
  { id: 'cycles', label: 'Cycles' },
  { id: 'itp', label: 'ITP & NAV' },
  { id: 'vision', label: 'Vision' },
  { id: 'sources', label: 'Sources' },
  { id: 'system', label: 'System' },
  { id: 'health', label: 'System Health' },
  { id: 'chain', label: 'Chain & Gas' },
] as const

type TabId = (typeof TABS)[number]['id']

// Tabs that use their own data sources (not explorer health snapshots)
const STANDALONE_TABS = new Set<TabId>(['sources', 'system'])

const RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d']

export default function ExplorerPageClient() {
  const { snapshots, latest, loading, error, range, setRange, refresh } = useExplorerHealth()
  const [activeTab, setActiveTab] = useState<TabId>('consensus')

  const isStandalone = STANDALONE_TABS.has(activeTab)

  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-site-wide mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="pt-10 pb-4">
          <p className="text-label font-semibold tracking-[0.08em] uppercase text-text-muted mb-1.5">
            Network
          </p>
          <h1 className="text-display font-black tracking-tight text-black leading-[1.1]">
            Explorer
          </h1>
        </div>

        <ExplorerSummaryBar latest={latest} loading={loading} />

        {/* Tab bar + time range */}
        <div className="flex items-center justify-between border-b border-border-light mt-4">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-3 text-caption font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-black text-black'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {!isStandalone && (
            <div className="flex items-center gap-1.5 shrink-0 ml-4">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 text-label font-bold rounded transition-colors ${
                    range === r
                      ? 'bg-black text-white'
                      : 'text-text-muted hover:text-black hover:bg-gray-50'
                  }`}
                >
                  {r}
                </button>
              ))}
              <button
                onClick={refresh}
                disabled={loading}
                className="ml-2 px-3 py-1 text-label font-bold text-text-muted hover:text-black disabled:opacity-50 transition-colors"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && !isStandalone && (
          <div className="mt-4 border border-color-down/50 bg-surface-down rounded-card px-4 py-3">
            <p className="text-color-down text-caption font-semibold">{error}</p>
            <button onClick={refresh} className="mt-2 text-caption font-bold text-color-info underline">
              Retry
            </button>
          </div>
        )}

        {/* Sections */}
        <div className="py-6 pb-16">
          {activeTab === 'consensus' && <ConsensusSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'orders' && <OrdersSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'prices' && <PriceFeedSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'p2p' && <P2PSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'cycles' && <CycleSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'itp' && <ITPSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'vision' && <VisionSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'sources' && <SourcesExplorerSection />}
          {activeTab === 'system' && <SystemExplorerSection />}
          {activeTab === 'health' && <SystemHealthSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'chain' && <ChainGasSection snapshots={snapshots} latest={latest} loading={loading} />}
        </div>
      </div>
    </main>
  )
}
