'use client'

import { use, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAccount } from '@/lib/wallet-shim'
import { useTranslations } from 'next-intl'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProfileHero } from '@/components/domain/profile/ProfileHero'
import { ProfileTabs, type ProfileTabId } from '@/components/domain/profile/ProfileTabs'
import { VisionTab } from '@/components/domain/profile/VisionTab'
import { IndexTab } from '@/components/domain/profile/IndexTab'
import { VaultsTab } from '@/components/domain/profile/VaultsTab'
import { usePlayerProfile } from '@/hooks/usePlayerProfile'
import { usePoints } from '@/hooks/usePoints'
import { useVaultsTotals } from '@/hooks/useVaultsTotals'
import { formatPnL, formatROI, formatVolume } from '@/lib/utils/formatters'

function formatPoints(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  if (n >= 1) return Math.floor(n).toLocaleString()
  return '0'
}

function ProfileContent({ address }: { address: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations('pages.profile')
  const tabParam = searchParams.get('tab')
  // Vaults is the primary surface — default to it when no tab query is set.
  const tab: ProfileTabId =
    tabParam === 'vision' ? 'vision' : tabParam === 'index' ? 'index' : 'vaults'
  const { profile, isLoading } = usePlayerProfile(address)
  const { points } = usePoints(address)
  const { address: connectedAddress } = useAccount()
  const isSelf =
    !!connectedAddress && connectedAddress.toLowerCase() === address.toLowerCase()
  // Only aggregate vault totals when we're showing the vaults tab for the user's
  // own profile — the SSE streams scope to the connected wallet.
  const vaultTotals = useVaultsTotals(isSelf && tab === 'vaults')

  const handleTabChange = (newTab: ProfileTabId) => {
    router.replace(`?tab=${newTab}`)
  }

  // On the vaults tab we show the vault aggregate instead of the player's
  // vision P&L — different accounting, same hero slot.
  const showingVaults = tab === 'vaults' && isSelf
  const displayPnl = showingVaults ? vaultTotals.totalPnl : profile?.stats.pnl ?? 0
  const displayVolume = showingVaults
    ? vaultTotals.totalValue
    : profile?.stats.totalDeposited ?? 0
  const displayRoi = showingVaults
    ? vaultTotals.totalValue > 0
      ? (vaultTotals.totalPnl / vaultTotals.totalValue) * 100
      : 0
    : profile?.stats.roi ?? 0
  const displayCount = showingVaults
    ? vaultTotals.count
    : profile?.stats.totalBatches ?? 0
  const pnlColor = displayPnl >= 0 ? 'text-color-up' : 'text-color-down'

  const stats = [
    { label: t('pnl'), value: formatPnL(displayPnl), color: pnlColor },
    { label: t('roi'), value: formatROI(displayRoi) },
    {
      label: showingVaults ? t('vaults') : t('rounds'),
      value: String(displayCount),
    },
    { label: t('volume'), value: formatVolume(displayVolume) },
    { label: t('points'), value: formatPoints(points.total), color: 'text-color-up' },
  ]

  if (isLoading) {
    return (
      <>
        <div className="border-b border-border-light">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-border-light rounded-xl p-5">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-full bg-surface animate-pulse" />
                    <div>
                      <div className="h-6 w-36 bg-surface rounded animate-pulse" />
                      <div className="h-3 w-24 bg-surface rounded animate-pulse mt-2" />
                    </div>
                  </div>
                  <div className="flex gap-6">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-8 w-16 bg-surface rounded animate-pulse" />
                    ))}
                  </div>
                </div>
                <div className="bg-white border border-border-light rounded-xl h-[200px] animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        <ProfileTabs activeTab={tab} onTabChange={handleTabChange} />
        <div className="px-6 lg:px-12">
          <div className="max-w-site mx-auto py-8">
            <div className="h-[140px] bg-surface rounded animate-pulse" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <ProfileHero
        address={address}
        lastActiveAt={profile?.stats.lastActiveAt ?? undefined}
        stats={stats}
        pnlHistory={showingVaults ? [] : profile?.pnlHistory ?? []}
        pnlOverride={showingVaults ? vaultTotals.totalPnl : undefined}
      />
      <ProfileTabs activeTab={tab} onTabChange={handleTabChange} />
      <div className="px-6 lg:px-12">
        <div className="max-w-site mx-auto py-8">
          {tab === 'vision' && profile ? (
            <VisionTab profile={profile} />
          ) : tab === 'vision' ? (
            <div className="py-16 text-center text-caption text-text-muted">
              {t('no_profile')}
            </div>
          ) : tab === 'vaults' ? (
            <VaultsTab address={address} />
          ) : (
            <IndexTab address={address} />
          )}
        </div>
      </div>
    </>
  )
}

export default function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params)

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <Suspense
        fallback={
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-12">
              <div className="h-8 w-32 bg-surface rounded animate-pulse" />
            </div>
          </div>
        }
      >
        <ProfileContent address={address} />
      </Suspense>
      <div className="flex-1" />
      <Footer />
    </main>
  )
}
