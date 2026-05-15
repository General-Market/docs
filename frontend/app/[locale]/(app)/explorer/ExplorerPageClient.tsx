'use client'

import { useState } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useExplorerHealth, type TimeRange } from '@/hooks/useExplorerHealth'
import { ExplorerSummaryBar } from '@/components/domain/explorer/ExplorerSummaryBar'
import { ConsensusSection } from '@/components/domain/explorer/ConsensusSection'
import { OrdersSection } from '@/components/domain/explorer/OrdersSection'
import { PriceFeedSection } from '@/components/domain/explorer/PriceFeedSection'
import { P2PSection } from '@/components/domain/explorer/P2PSection'
import { CycleSection } from '@/components/domain/explorer/CycleSection'
import { ITPSection } from '@/components/domain/explorer/ITPSection'
import { VisionSection } from '@/components/domain/explorer/VisionSection'
import { TieRateSection } from '@/components/domain/explorer/TieRateSection'
import { TieRateHistorySection } from '@/components/domain/explorer/TieRateHistorySection'
import { SystemHealthSection } from '@/components/domain/explorer/SystemHealthSection'
import { ChainGasSection } from '@/components/domain/explorer/ChainGasSection'
import { SourcesExplorerSection } from '@/components/domain/explorer/SourcesExplorerSection'
import { SystemExplorerSection } from '@/components/domain/explorer/SystemExplorerSection'
import { LendingSection } from '@/components/domain/explorer/LendingSection'
import { springs } from '@/components/ui/spring'
import { usePrefersReducedMotion } from '@/hooks/useMediaQueries'

const TAB_IDS = ['consensus', 'orders', 'prices', 'p2p', 'cycles', 'itp', 'lending', 'vision', 'sources', 'system', 'health', 'chain'] as const
type TabId = (typeof TAB_IDS)[number]

const STANDALONE_TABS = new Set<TabId>(['sources', 'system', 'lending'])
const RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d']

export default function ExplorerPageClient() {
  const t = useTranslations('pages')
  const { snapshots, latest, loading, error, range, setRange, refresh } = useExplorerHealth()
  const [activeTab, setActiveTab] = useState<TabId>('consensus')
  const reduced = usePrefersReducedMotion()
  const tabs = TAB_IDS.map(id => ({ id, label: t(`explorer.tabs.${id}`) }))

  const isStandalone = STANDALONE_TABS.has(activeTab)

  return (
    <main className="min-h-screen explorer-light-bg">
      <div className="relative max-w-apple-max mx-auto px-4 md:px-8">
        {/* Header — apple display */}
        <div className="pt-12 pb-5">
          <p className="text-[12px] font-semibold tracking-apple-loose uppercase text-[#86868b] mb-2">
            {t('explorer.network')}
          </p>
          <h1 className="text-display font-display font-semibold tracking-apple-tighter text-[#1d1d1f] leading-[1.05]">
            {t('explorer.title')}
          </h1>
        </div>

        <ExplorerSummaryBar latest={latest} loading={loading} />

        {/* Tab bar — full width, scroll-affordant */}
        <div className="relative mt-6 border-b border-[#D2D2D7]">
          <LayoutGroup id="explorer-tabs">
            <div className="flex gap-0 overflow-x-auto scrollbar-hide -mx-1 px-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-4 py-3 text-caption font-semibold tracking-apple-tight transition-colors whitespace-nowrap ${
                      isActive ? 'text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'
                    }`}
                  >
                    {tab.label}
                    {isActive && (
                      <motion.div
                        layoutId="explorer-tab-indicator"
                        className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#1d1d1f]"
                        transition={reduced ? { duration: 0 } : springs.indicator}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </LayoutGroup>
          {/* Edge fades signal horizontal scroll */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-px w-6 bg-gradient-to-r from-[var(--explorer-bg,#FAFAFC)] to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-px w-6 bg-gradient-to-l from-[var(--explorer-bg,#FAFAFC)] to-transparent" />
        </div>

        {/* Time range + refresh — own row, apple pill controls */}
        {!isStandalone && (
          <div className="flex items-center justify-end gap-1 mt-4">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-label font-semibold tracking-apple-tight rounded-apple-pill transition-colors ${
                  range === r
                    ? 'bg-[#1d1d1f] text-white'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]'
                }`}
              >
                {r}
              </button>
            ))}
            <button
              onClick={refresh}
              disabled={loading}
              className="ml-2 px-3.5 py-1.5 text-label font-semibold tracking-apple-tight rounded-apple-pill text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04] disabled:opacity-40 transition-colors"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        )}

        {/* Error */}
        {error && !isStandalone && (
          <div className="mt-4 border border-[#FF3B30]/25 bg-[#FF3B30]/[0.06] rounded-apple-md px-4 py-3">
            <p className="text-[#D70015] text-caption font-semibold">{error}</p>
            <button onClick={refresh} className="mt-2 text-caption font-semibold text-[#0071E3] hover:text-[#0066CC] transition-colors">
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
          {activeTab === 'lending' && <LendingSection loading={loading} />}
          {activeTab === 'vision' && (
            <>
              <VisionSection snapshots={snapshots} latest={latest} loading={loading} />
              <div className="mt-4">
                <TieRateHistorySection />
              </div>
              <div className="mt-4">
                <TieRateSection />
              </div>
            </>
          )}
          {activeTab === 'sources' && <SourcesExplorerSection />}
          {activeTab === 'system' && <SystemExplorerSection />}
          {activeTab === 'health' && <SystemHealthSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'chain' && <ChainGasSection snapshots={snapshots} latest={latest} loading={loading} />}
        </div>
      </div>
    </main>
  )
}
