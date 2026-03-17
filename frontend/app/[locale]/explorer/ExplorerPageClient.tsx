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
          {activeTab === 'consensus' && <ConsensusSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'orders' && <OrdersSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'prices' && <PriceFeedSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'p2p' && <P2PSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'cycles' && <CycleSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'itp' && <ITPSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'vision' && <VisionSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'health' && <SystemHealthSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'chain' && <ChainGasSection snapshots={snapshots} latest={latest} loading={loading} />}
        </div>
      </div>
    </main>
  )
}
