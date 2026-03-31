'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSourceHealth } from '@/hooks/useSourceHealth'
import { SourceHealthTable } from '@/components/domain/SourceHealthTable'
import { SourceDetailModal } from '@/components/domain/SourceDetailModal'

export function SourcesExplorerSection() {
  const t = useTranslations('pages')
  const { sources, loading, error, lastUpdated, refresh } = useSourceHealth()
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)

  const healthyCt = sources.filter(s => s.status === 'healthy').length
  const staleCt = sources.filter(s => s.status === 'stale').length
  const deadCt = sources.filter(s => s.status === 'dead').length
  const totalLiveAssets = sources.reduce((sum, s) => sum + Math.max(0, s.activeAssets - s.staleAssets - s.zeroValueAssets), 0)
  const totalAssets = sources.reduce((sum, s) => sum + s.totalAssets, 0)

  return (
    <div>
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="glass-surface-dark border border-white/[0.08] rounded-card p-3">
          <p className="text-micro font-semibold tracking-[0.08em] uppercase text-white/40 mb-1">{t('explorer.sources_section.sources')}</p>
          <p className="text-heading font-black tracking-tight font-mono tabular-nums text-white">
            {loading ? '--' : sources.length}
          </p>
        </div>
        <div className="glass-surface-dark border border-white/[0.08] rounded-card p-3">
          <p className="text-micro font-semibold tracking-[0.08em] uppercase text-white/40 mb-1">{t('explorer.sources_section.healthy')}</p>
          <p className="text-heading font-black tracking-tight font-mono tabular-nums text-color-up">
            {loading ? '--' : healthyCt}
          </p>
        </div>
        <div className="glass-surface-dark border border-white/[0.08] rounded-card p-3">
          <p className="text-micro font-semibold tracking-[0.08em] uppercase text-white/40 mb-1">{t('explorer.sources_section.stale')}</p>
          <p className="text-heading font-black tracking-tight font-mono tabular-nums text-color-warning">
            {loading ? '--' : staleCt}
          </p>
        </div>
        <div className="glass-surface-dark border border-white/[0.08] rounded-card p-3">
          <p className="text-micro font-semibold tracking-[0.08em] uppercase text-white/40 mb-1">{t('explorer.sources_section.dead')}</p>
          <p className="text-heading font-black tracking-tight font-mono tabular-nums text-color-down">
            {loading ? '--' : deadCt}
          </p>
        </div>
        <div className="glass-surface-dark border border-white/[0.08] rounded-card p-3">
          <p className="text-micro font-semibold tracking-[0.08em] uppercase text-white/40 mb-1">{t('explorer.sources_section.live_assets')}</p>
          <p className="text-heading font-black tracking-tight font-mono tabular-nums text-white">
            {loading ? '--' : (
              <>{totalLiveAssets.toLocaleString()}<span className="text-caption text-white/40 font-semibold"> / {totalAssets.toLocaleString()}</span></>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 border border-color-down/50 bg-surface-down rounded-card px-4 py-3">
          <p className="text-color-down text-caption font-semibold">{t('explorer.sources_section.failed_to_fetch')}</p>
          <p className="text-text-secondary text-caption mt-0.5">{error}</p>
          <button onClick={refresh} className="mt-2 text-caption font-bold text-color-info underline hover:no-underline">
            {t('explorer.sources_section.retry')}
          </button>
        </div>
      )}

      <SourceHealthTable
        sources={sources}
        loading={loading}
        selectedSourceId={selectedSourceId}
        onSelectSource={setSelectedSourceId}
        dark
      />

      <SourceDetailModal
        sourceId={selectedSourceId}
        onClose={() => setSelectedSourceId(null)}
        dark
      />
    </div>
  )
}
