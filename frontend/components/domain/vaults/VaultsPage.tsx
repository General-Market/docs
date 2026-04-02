'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useVaults } from '@/hooks/vaults/useVaults'
import { getAllCategories, getAllFundsBranded, getFundsByCategory } from '@/hooks/vaults/useFundBranding'
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[0, 1, 2].map((j) => (
              <div key={j} className="border border-border-light rounded-md bg-card p-5 space-y-3 animate-pulse">
                <div className="h-5 w-32 bg-black/[0.06] rounded" />
                <div className="h-4 w-24 bg-black/[0.06] rounded" />
                <div className="h-8 w-20 bg-black/[0.06] rounded" />
                <div className="flex gap-4">
                  <div className="h-4 w-16 bg-black/[0.06] rounded" />
                  <div className="h-4 w-16 bg-black/[0.06] rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Collect unique source logos for a category */
function CategorySourceLogos({ category }: { category: string }) {
  const funds = getFundsByCategory(category)
  const logos = [...new Set(funds.flatMap(f => f.sourceLogos))]
  if (logos.length === 0) return null

  return (
    <div className="flex items-center gap-1 ml-3">
      {logos.slice(0, 6).map((logo, i) => (
        <Image
          key={i}
          src={logo}
          alt=""
          width={18}
          height={18}
          className="rounded-full opacity-60"
        />
      ))}
      {logos.length > 6 && (
        <span className="text-[10px] text-text-muted font-mono ml-0.5">
          +{logos.length - 6}
        </span>
      )}
    </div>
  )
}

export function VaultsPage() {
  const { vaults, totalTvlFormatted, isLoading, refetch } = useVaults()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedVault, setSelectedVault] = useState<VaultInfo | null>(null)

  const categories = getAllCategories()
  const allBranded = getAllFundsBranded()

  // Map vaults to categories. Vaults with branding go into their category,
  // vaults without branding go into "Other".
  const grouped = useMemo(() => {
    const map = new Map<string, VaultInfo[]>()

    for (const cat of categories) {
      map.set(cat, [])
    }

    for (const vault of vaults) {
      const fund = allBranded.find(
        f => f.vault && f.vault.toLowerCase() === vault.address.toLowerCase()
      )
      const cat = fund?.category ?? 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(vault)
    }

    // Also show branded categories that have no deployed vaults yet,
    // using placeholder cards (just the branding data)
    return map
  }, [vaults, categories, allBranded])

  // Categories that have at least one vault
  const activeCategories = categories.filter(cat => {
    const catVaults = grouped.get(cat)
    return catVaults && catVaults.length > 0
  })

  // Uncategorized vaults
  const otherVaults = grouped.get('Other') ?? []

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
            <div className="space-y-12">
              {/* Categorized vaults */}
              {activeCategories.map(cat => (
                <section key={cat}>
                  <div className="flex items-center mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
                      {cat}
                    </h3>
                    <CategorySourceLogos category={cat} />
                    <span className="ml-2 text-[10px] text-text-muted font-mono tabular-nums">
                      {grouped.get(cat)!.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {grouped.get(cat)!.map(vault => (
                      <VaultCard
                        key={vault.address}
                        vault={vault}
                        onClick={() => setSelectedVault(vault)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {/* Uncategorized */}
              {otherVaults.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted mb-4">
                    Other
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {otherVaults.map(vault => (
                      <VaultCard
                        key={vault.address}
                        vault={vault}
                        onClick={() => setSelectedVault(vault)}
                      />
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

      {/* Vault detail / actions */}
      {selectedVault && (
        <VaultActions
          vault={selectedVault}
          onClose={() => { setSelectedVault(null); refetch() }}
        />
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateVaultModal onClose={() => { setShowCreateModal(false); refetch() }} />
      )}
    </div>
  )
}
