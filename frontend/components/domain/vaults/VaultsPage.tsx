'use client'

import { useState } from 'react'
import { formatUnits } from 'viem'
import { useVaults } from '@/hooks/vaults/useVaults'
import { VaultCard } from './VaultCard'
import { VaultActions } from './VaultActions'
import { CreateVaultModal } from './CreateVaultModal'
import { EmptyState } from '@/components/ui/EmptyState'
import type { VaultInfo } from '@/hooks/vaults/useVaults'

function VaultsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border border-border-light rounded-md bg-card p-5 space-y-3 animate-pulse">
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
  )
}

export function VaultsPage() {
  const { vaults, totalTvlFormatted, isLoading, refetch } = useVaults()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedVault, setSelectedVault] = useState<VaultInfo | null>(null)

  return (
    <div className="flex-1">
      <section className="px-6 lg:px-12 py-12">
        <div className="max-w-site mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
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

          {/* Grid */}
          {isLoading ? (
            <VaultsSkeleton />
          ) : vaults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vaults.map((vault) => (
                <VaultCard
                  key={vault.address}
                  vault={vault}
                  onClick={() => setSelectedVault(vault)}
                />
              ))}
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
