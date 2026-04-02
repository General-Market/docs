'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useVaults } from '@/hooks/vaults/useVaults'
import {
  getAllFundsBranded,
  getAllFundSources,
  getFundsBySource,
} from '@/hooks/vaults/useFundBranding'
import { VaultCard } from './VaultCard'
import { VaultActions } from './VaultActions'
import { CreateVaultModal } from './CreateVaultModal'
import { EmptyState } from '@/components/ui/EmptyState'
import type { VaultInfo } from '@/hooks/vaults/useVaults'

function VaultsSkeleton() {
  return (
    <div className="space-y-10">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-5 w-40 bg-black/[0.06] rounded animate-pulse" />
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3].map((j) => (
              <div
                key={j}
                className="shrink-0 w-[240px] border border-border-light rounded-md bg-card p-3.5 space-y-2.5 animate-pulse"
              >
                <div className="h-4 w-28 bg-black/[0.06] rounded" />
                <div className="h-3 w-full bg-black/[0.06] rounded" />
                <div className="flex gap-3">
                  <div className="h-3 w-12 bg-black/[0.06] rounded" />
                  <div className="h-3 w-12 bg-black/[0.06] rounded" />
                  <div className="h-3 w-12 bg-black/[0.06] rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

interface SourceSectionProps {
  sourceId: string
  sourceName: string
  sourceLogo: string
  vaults: VaultInfo[]
  onSelect: (v: VaultInfo) => void
}

function SourceSection({ sourceId, sourceName, sourceLogo, vaults, onSelect }: SourceSectionProps) {
  const brandedFunds = getFundsBySource(sourceId)

  // Build ordered list: branded funds first (in catalog order), then unbranded vaults
  const allBranded = getAllFundsBranded()
  const ordered = useMemo(() => {
    const byAddr = new Map(vaults.map(v => [v.address.toLowerCase(), v]))
    const result: VaultInfo[] = []

    // Branded order
    for (const fund of brandedFunds) {
      if (!fund.vault) continue
      const vault = byAddr.get(fund.vault.toLowerCase())
      if (vault) result.push(vault)
    }

    // Unbranded remainder
    for (const vault of vaults) {
      const hasBranding = allBranded.some(
        f => f.vault && f.vault.toLowerCase() === vault.address.toLowerCase()
      )
      if (!hasBranding) result.push(vault)
    }

    return result
  }, [vaults, brandedFunds, allBranded])

  if (ordered.length === 0) return null

  return (
    <section id={`source-${sourceId}`}>
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-3">
        {sourceLogo && (
          <Image
            src={sourceLogo}
            alt={sourceName}
            width={20}
            height={20}
            className="rounded-full object-contain"
          />
        )}
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
          {sourceName}
        </h3>
        <span className="text-[10px] text-text-muted font-mono tabular-nums bg-black/[0.04] px-1.5 py-0.5 rounded">
          {ordered.length}
        </span>
      </div>

      {/* Horizontal scroll row */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {ordered.map((vault) => (
          <div key={vault.address} className="shrink-0 w-[240px]">
            <VaultCard vault={vault} onClick={() => onSelect(vault)} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function VaultsPage() {
  const { vaults, totalTvlFormatted, isLoading, refetch } = useVaults()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedVault, setSelectedVault] = useState<VaultInfo | null>(null)

  const allSources = getAllFundSources()
  const allBranded = getAllFundsBranded()

  // Map vault address → primary source
  const vaultsBySource = useMemo(() => {
    const map = new Map<string, VaultInfo[]>()

    for (const vault of vaults) {
      const fund = allBranded.find(
        f => f.vault && f.vault.toLowerCase() === vault.address.toLowerCase()
      )
      const primarySource = fund?.source ?? '__other__'
      if (!map.has(primarySource)) map.set(primarySource, [])
      map.get(primarySource)!.push(vault)
    }

    return map
  }, [vaults, allBranded])

  // Sources that have at least one deployed vault, in catalog order
  const activeSources = allSources.filter(s => {
    const count = vaultsBySource.get(s.sourceId)?.length ?? 0
    return count > 0
  })

  // Vaults with no branding / unknown source
  const otherVaults = vaultsBySource.get('__other__') ?? []

  const hasAnyVault = vaults.length > 0

  return (
    <div className="flex-1">
      <section className="px-6 lg:px-12 py-12">
        <div className="max-w-site mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
            <div>
              <p className="text-label font-semibold tracking-[0.08em] uppercase text-brand mb-1.5">
                Managed Vaults
              </p>
              <h2 className="text-display font-black tracking-tight text-black leading-[1.1]">
                Vaults
              </h2>
              <p className="text-body text-text-secondary mt-1.5">
                {vaults.length} vault{vaults.length !== 1 ? 's' : ''} &middot; ${totalTvlFormatted} TVL
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-brand text-white px-4 py-2 rounded-card text-sm font-bold
                         hover:bg-brand-dark transition-colors shrink-0 self-start sm:self-auto fluid-press"
            >
              Create Vault
            </button>
          </div>

          {/* Content */}
          {isLoading ? (
            <VaultsSkeleton />
          ) : hasAnyVault ? (
            <div className="space-y-10">
              {activeSources.map(source => (
                <SourceSection
                  key={source.sourceId}
                  sourceId={source.sourceId}
                  sourceName={source.name}
                  sourceLogo={source.logo}
                  vaults={vaultsBySource.get(source.sourceId) ?? []}
                  onSelect={setSelectedVault}
                />
              ))}

              {/* Unbranded vaults */}
              {otherVaults.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
                      Other
                    </h3>
                    <span className="text-[10px] text-text-muted font-mono tabular-nums bg-black/[0.04] px-1.5 py-0.5 rounded">
                      {otherVaults.length}
                    </span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                    {otherVaults.map(vault => (
                      <div key={vault.address} className="shrink-0 w-[240px]">
                        <VaultCard vault={vault} onClick={() => setSelectedVault(vault)} />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <EmptyState
              title="No vaults yet"
              description="Create the first managed vault to get started."
              action={
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-brand text-white px-4 py-2 rounded-card text-sm font-bold hover:bg-brand-dark transition-colors fluid-press"
                >
                  Create Vault
                </button>
              }
            />
          )}
        </div>
      </section>

      {selectedVault && (
        <VaultActions
          vault={selectedVault}
          onClose={() => { setSelectedVault(null); refetch() }}
        />
      )}

      {showCreateModal && (
        <CreateVaultModal onClose={() => { setShowCreateModal(false); refetch() }} />
      )}
    </div>
  )
}
