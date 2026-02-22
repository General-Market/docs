'use client'

import { useState } from 'react'
import { useSourceHealth } from '@/hooks/useSourceHealth'
import { SourceHealthTable } from '@/components/domain/SourceHealthTable'
import { SourceDetailModal } from '@/components/domain/SourceDetailModal'
import { SectionBar } from '@/components/ui/SectionBar'

function formatLastUpdated(date: Date | null): string {
  if (!date) return '--'
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export default function SourcesPage() {
  const { sources, loading, error, lastUpdated, refresh } = useSourceHealth()
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)

  const healthyCt = sources.filter(s => s.status === 'healthy').length
  const staleCt = sources.filter(s => s.status === 'stale').length
  const deadCt = sources.filter(s => s.status === 'dead').length

  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-site-wide mx-auto px-4 md:px-8">
        {/* Page header */}
        <div className="pt-10 pb-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">
            Admin
          </p>
          <h1 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">
            Source Monitoring
          </h1>
          <p className="text-[14px] text-text-secondary mt-1.5">
            Live health status of all data sources feeding market prices.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 py-5 border-b border-border-light mt-0">
          <div className="py-3 px-4 md:px-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">
              Total Sources
            </p>
            <p className="text-[22px] font-extrabold font-mono tabular-nums text-black">
              {loading ? '--' : sources.length}
            </p>
          </div>
          <div className="py-3 px-4 md:px-6 md:border-l border-border-light">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">
              Healthy
            </p>
            <p className="text-[22px] font-extrabold font-mono tabular-nums text-color-up">
              {loading ? '--' : healthyCt}
            </p>
          </div>
          <div className="py-3 px-4 md:px-6 md:border-l border-border-light border-t md:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">
              Stale
            </p>
            <p className="text-[22px] font-extrabold font-mono tabular-nums text-color-warning">
              {loading ? '--' : staleCt}
            </p>
          </div>
          <div className="py-3 px-4 md:px-6 md:border-l border-border-light border-t md:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">
              Dead
            </p>
            <p className="text-[22px] font-extrabold font-mono tabular-nums text-color-down">
              {loading ? '--' : deadCt}
            </p>
          </div>
          <div className="py-3 px-4 md:px-6 md:border-l border-border-light border-t md:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">
              Last Updated
            </p>
            <div className="flex items-center gap-2">
              <p className="text-[16px] font-extrabold font-mono tabular-nums text-black">
                {formatLastUpdated(lastUpdated)}
              </p>
              {/* Auto-refresh indicator */}
              {!loading && (
                <span
                  className="w-2 h-2 rounded-full bg-color-up animate-pulse"
                  title="Auto-refreshing every 30s"
                />
              )}
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-4 border border-color-down/50 bg-surface-down rounded-card px-4 py-3" role="alert">
            <p className="text-color-down text-[13px] font-semibold">Failed to fetch source data</p>
            <p className="text-text-secondary text-[12px] mt-0.5">{error}</p>
            <button
              onClick={refresh}
              className="mt-2 text-[12px] font-bold text-color-info underline hover:no-underline"
            >
              Retry now
            </button>
          </div>
        )}

        {/* Table section */}
        <div className="py-5 pb-10">
          <SectionBar
            title="Data Sources"
            value={loading ? 'Loading...' : `${sources.length} sources tracked`}
            right={
              <button
                onClick={refresh}
                disabled={loading}
                className="text-[11px] font-bold uppercase tracking-wider text-white/70 hover:text-white transition-colors disabled:opacity-40"
              >
                Refresh
              </button>
            }
          />

          <SourceHealthTable
            sources={sources}
            loading={loading}
            selectedSourceId={selectedSourceId}
            onSelectSource={setSelectedSourceId}
          />
        </div>

        {/* Source detail modal */}
        <SourceDetailModal
          sourceId={selectedSourceId}
          onClose={() => setSelectedSourceId(null)}
        />
      </div>
    </main>
  )
}
