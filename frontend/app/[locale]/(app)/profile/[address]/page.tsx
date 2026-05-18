'use client'

import { use, useMemo, Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useTranslations } from 'next-intl'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { GeneralLoader } from '@/components/ui/GeneralLoader'
import { ProfileHero } from '@/components/domain/profile/ProfileHero'
import type { PnlTimeRange } from '@/components/domain/profile/PnlChart'
import { ProfileTabs, type ProfileTabId } from '@/components/domain/profile/ProfileTabs'
import { VisionTab } from '@/components/domain/profile/VisionTab'
import { IndexTab } from '@/components/domain/profile/IndexTab'
import { VaultsTab } from '@/components/domain/profile/VaultsTab'
import { usePlayerProfile } from '@/hooks/usePlayerProfile'
import { useVaultsTotals } from '@/hooks/useVaultsTotals'
import {
  useAccountPnlHistory,
  type AccountPnlRange,
} from '@/hooks/vaults/useAccountPnlHistory'
import { formatPnL, formatVolume } from '@/lib/utils/formatters'
import { computeDerivedMetrics, formatJoined } from '@/lib/utils/profile-metrics'

function ProfileContent({ address }: { address: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations('pages.profile')
  const tabParam = searchParams.get('tab')
  const { profile, isLoading } = usePlayerProfile(address)
  const { address: connectedAddress } = useAccount()
  const isSelf =
    !!connectedAddress && connectedAddress.toLowerCase() === address.toLowerCase()
  // Default tab — vaults first when looking at your own profile, vision
  // otherwise (vault positions are private and would render an empty state
  // for visitors).
  const defaultTab: ProfileTabId = isSelf ? 'vaults' : 'vision'
  const tab: ProfileTabId =
    tabParam === 'vaults'
      ? 'vaults'
      : tabParam === 'index'
        ? 'index'
        : tabParam === 'vision'
          ? 'vision'
          : defaultTab
  // Only aggregate vault totals when we're showing the vaults tab for the user's
  // own profile — the SSE streams scope to the connected wallet.
  const vaultTotals = useVaultsTotals(isSelf && tab === 'vaults')

  // The account-level P&L curve is now precomputed by the data-node writer
  // and read in one indexed lookup — no per-vault fanout, no client merge,
  // no "current shares × historical NAV" approximation. The curve covers
  // both vault shares and ITP fills, so it drives the hero on every tab
  // except 'vision' (parimutuel positions have a different shape and stay
  // on the Vision profile feed).
  const [pnlRange, setPnlRange] = useState<PnlTimeRange>('ALL')
  const rangeParam: AccountPnlRange =
    pnlRange === '1D' ? '1d' : pnlRange === '1W' ? '1w' : pnlRange === '1M' ? '1m' : 'all'
  const showingUnifiedCurve = tab !== 'vision'
  const { history: pnlPoints, livePnl: pnlLive } = useAccountPnlHistory(
    showingUnifiedCurve ? address : undefined,
    rangeParam,
  )
  const curveHistory = useMemo(
    () =>
      pnlPoints.map((p) => ({ timestamp: new Date(p.ts).toISOString(), pnl: p.pnl })),
    [pnlPoints],
  )

  const handleTabChange = (newTab: ProfileTabId) => {
    router.replace(`?tab=${newTab}`)
  }

  // The unified curve drives PnL on vaults and index tabs. Vault SSE totals
  // remain a fallback for the brief window after a fresh deposit before the
  // curve writer's 60s sweep catches up. Vision tab keeps its own feed.
  const showingVaults = tab === 'vaults' && isSelf
  const vaultsPriced = !vaultTotals.pricingIncomplete
  const headlinePnl =
    showingUnifiedCurve && pnlLive !== null
      ? pnlLive
      : showingVaults && vaultsPriced
        ? vaultTotals.totalPnl
        : null
  const displayPnl =
    headlinePnl !== null ? headlinePnl : profile?.stats.pnl ?? 0
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
          value: vaultsPriced ? formatVolume(vaultTotals.totalValue) : '—',
        },
        {
          label: t('pnl'),
          value: headlinePnl !== null ? formatPnL(headlinePnl) : '—',
          color: headlinePnl !== null ? pnlColor : undefined,
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
    return <GeneralLoader height="80vh" />
  }

  return (
    <>
      <ProfileHero
        address={address}
        lastActiveAt={profile?.stats.lastActiveAt ?? undefined}
        joined={joinedLabel}
        stats={stats}
        pnlHistory={showingUnifiedCurve ? curveHistory : profile?.pnlHistory ?? []}
        pnlOverride={showingUnifiedCurve && headlinePnl !== null ? headlinePnl : undefined}
        pnlRange={pnlRange}
        onPnlRangeChange={setPnlRange}
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
      <Suspense fallback={<GeneralLoader height="80vh" />}>
        <ProfileContent address={address} />
      </Suspense>
    </AppShell>
  )
}
