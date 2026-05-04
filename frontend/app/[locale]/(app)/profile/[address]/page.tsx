'use client'

import { use, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useTranslations } from 'next-intl'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { ProfileHero } from '@/components/domain/profile/ProfileHero'
import { ProfileTabs, type ProfileTabId } from '@/components/domain/profile/ProfileTabs'
import { VisionTab } from '@/components/domain/profile/VisionTab'
import { IndexTab } from '@/components/domain/profile/IndexTab'
import { VaultsTab } from '@/components/domain/profile/VaultsTab'
import { usePlayerProfile } from '@/hooks/usePlayerProfile'
import { useVaultsTotals } from '@/hooks/useVaultsTotals'
import { formatPnL, formatVolume } from '@/lib/utils/formatters'
import { computeDerivedMetrics, formatJoined } from '@/lib/utils/profile-metrics'

function ProfileContent({ address }: { address: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations('pages.profile')
  const tabParam = searchParams.get('tab')
  const { profile, isLoading } = usePlayerProfile(address)
  const tab: ProfileTabId =
    tabParam === 'vaults' ? 'vaults' : tabParam === 'index' ? 'index' : 'vision'
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
  const pnlColor = displayPnl >= 0 ? 'text-color-up' : 'text-color-down'

  // Polymarket-parity derived metrics — positions value, biggest win,
  // predictions count, joined date — all computed from the profile data
  // we already fetch.
  const derived = computeDerivedMetrics(profile)
  const joinedLabel = formatJoined(derived.firstSeenUnixSec)

  const stats = showingVaults
    ? [
        {
          label: t('positions_value'),
          value: formatVolume(vaultTotals.totalValue),
        },
        {
          label: t('pnl'),
          value: formatPnL(vaultTotals.totalPnl),
          color: pnlColor,
        },
        {
          label: t('vaults'),
          value: String(vaultTotals.count),
        },
      ]
    : [
        {
          label: t('positions_value'),
          value: formatVolume(derived.positionsValue),
        },
        {
          label: t('biggest_win'),
          value: formatPnL(derived.biggestWin),
          color: derived.biggestWin > 0 ? 'text-color-up' : undefined,
        },
        {
          label: t('predictions'),
          value: derived.predictions.toLocaleString(),
        },
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
        joined={joinedLabel}
        stats={stats}
        pnlHistory={showingVaults ? [] : profile?.pnlHistory ?? []}
        pnlOverride={showingVaults ? vaultTotals.totalPnl : undefined}
      />
      <ProfileTabs
        activeTab={tab}
        onTabChange={handleTabChange}
        visionCount={profile?.stats.totalBatches ?? 0}
      />
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
    <AppShell search={<SourceSearch />}>
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
    </AppShell>
  )
}
