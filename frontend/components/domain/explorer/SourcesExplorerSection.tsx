'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSourceHealth } from '@/hooks/useSourceHealth'
import { useSourceStats } from '@/hooks/useSourceStats'
import { useBatches } from '@/hooks/vision/useBatches'
import { getFundCountForSource } from '@/hooks/vaults/useFundBranding'
import { SourceHealthTable, type ActiveBatchInfo } from '@/components/domain/SourceHealthTable'
import { SourceDetailModal } from '@/components/domain/SourceDetailModal'

export function SourcesExplorerSection() {
  const t = useTranslations('pages')
  const { sources, loading, error, refresh } = useSourceHealth()
  const { byId: statsById } = useSourceStats()
  const { data: batches } = useBatches()
  const batchBySource = useMemo(() => {
    const map = new Map<string, ActiveBatchInfo>()
    for (const b of batches ?? []) {
      if (!b.sourceId) continue
      map.set(b.sourceId.toLowerCase(), {
        id: b.id,
        marketCount: b.marketCount,
        playerCount: b.playerCount,
        hasVault: getFundCountForSource(b.sourceId) > 0,
      })
    }
    return map
  }, [batches])
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)

  const healthyCt = sources.filter(s => s.status === 'healthy').length
  const staleCt = sources.filter(s => s.status === 'stale').length
  const deadCt = sources.filter(s => s.status === 'dead').length
  const totalLiveAssets = sources.reduce((sum, s) => sum + Math.max(0, s.activeAssets - s.staleAssets - s.zeroValueAssets), 0)
  const totalAssets = sources.reduce((sum, s) => sum + s.totalAssets, 0)

  return (
    <div>
      {/* Stats grid — apple light */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="explorer-glass-card explorer-light-card rounded-apple-md p-3">
          <p className="text-micro font-semibold tracking-apple-loose uppercase text-[#86868b] mb-1">{t('explorer.sources_section.sources')}</p>
          <p className="text-heading font-display font-semibold tracking-apple-tighter tabular-nums text-[#1d1d1f]">
            {loading ? '--' : sources.length}
          </p>
        </div>
        <div className="explorer-glass-card explorer-light-card rounded-apple-md p-3">
          <p className="text-micro font-semibold tracking-apple-loose uppercase text-[#86868b] mb-1">{t('explorer.sources_section.healthy')}</p>
          <p className="text-heading font-display font-semibold tracking-apple-tighter tabular-nums text-[#1F8F4D]">
            {loading ? '--' : healthyCt}
          </p>
        </div>
        <div className="explorer-glass-card explorer-light-card rounded-apple-md p-3">
          <p className="text-micro font-semibold tracking-apple-loose uppercase text-[#86868b] mb-1">{t('explorer.sources_section.stale')}</p>
          <p className="text-heading font-display font-semibold tracking-apple-tighter tabular-nums text-[#B25600]">
            {loading ? '--' : staleCt}
          </p>
        </div>
        <div className="explorer-glass-card explorer-light-card rounded-apple-md p-3">
          <p className="text-micro font-semibold tracking-apple-loose uppercase text-[#86868b] mb-1">{t('explorer.sources_section.dead')}</p>
          <p className="text-heading font-display font-semibold tracking-apple-tighter tabular-nums text-[#D70015]">
            {loading ? '--' : deadCt}
          </p>
        </div>
        <div className="explorer-glass-card explorer-light-card rounded-apple-md p-3">
          <p className="text-micro font-semibold tracking-apple-loose uppercase text-[#86868b] mb-1">{t('explorer.sources_section.live_assets')}</p>
          <p className="text-heading font-display font-semibold tracking-apple-tighter tabular-nums text-[#1d1d1f]">
            {loading ? '--' : (
              <>{totalLiveAssets.toLocaleString()}<span className="text-caption text-[#86868b] font-semibold"> / {totalAssets.toLocaleString()}</span></>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 border border-[#FF3B30]/25 bg-[#FF3B30]/[0.06] rounded-apple-md px-4 py-3">
          <p className="text-[#D70015] text-caption font-semibold">{t('explorer.sources_section.failed_to_fetch')}</p>
          <p className="text-[#6e6e73] text-caption mt-0.5">{error}</p>
          <button onClick={refresh} className="mt-2 text-caption font-semibold text-[#0071E3] hover:text-[#0066CC] transition-colors">
            {t('explorer.sources_section.retry')}
          </button>
        </div>
      )}

      <SourceHealthTable
        sources={sources}
        statsById={statsById}
        batchBySource={batchBySource}
        loading={loading}
        selectedSourceId={selectedSourceId}
        onSelectSource={setSelectedSourceId}
      />

      <SourceDetailModal
        sourceId={selectedSourceId}
        onClose={() => setSelectedSourceId(null)}
      />
    </div>
  )
}
