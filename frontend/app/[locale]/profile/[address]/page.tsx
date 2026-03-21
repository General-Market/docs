'use client'

import { use, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProfileHeader } from '@/components/domain/profile/ProfileHeader'
import { ProfileTabs } from '@/components/domain/profile/ProfileTabs'
import { VisionTab } from '@/components/domain/profile/VisionTab'
import { IndexTab } from '@/components/domain/profile/IndexTab'
import { usePlayerProfile } from '@/hooks/usePlayerProfile'
import { formatPnL, formatROI, formatVolume } from '@/lib/utils/formatters'

function ProfileContent({ address }: { address: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations('pages.profile')
  const tab = (searchParams.get('tab') === 'index' ? 'index' : 'vision') as 'vision' | 'index'
  const { profile, isLoading } = usePlayerProfile(address)

  const handleTabChange = (newTab: 'vision' | 'index') => {
    router.replace(`?tab=${newTab}`)
  }

  const pnl = profile?.stats.pnl ?? 0
  const pnlColor = pnl >= 0 ? 'text-color-up' : 'text-color-down'

  const visionStats = [
    { label: t('pnl'), value: formatPnL(profile?.stats.pnl ?? 0), color: pnlColor },
    { label: t('roi'), value: formatROI(profile?.stats.roi ?? 0) },
    { label: t('win_rate'), value: `${(profile?.stats.winRate ?? 0).toFixed(1)}%` },
    { label: t('volume'), value: formatVolume(profile?.stats.totalDeposited ?? 0) },
    { label: t('batches'), value: String(profile?.stats.totalBatches ?? 0) },
  ]

  const indexStats = [
    { label: t('portfolio_value'), value: '\u2014' },
    { label: t('holdings'), value: '\u2014' },
  ]

  const stats = tab === 'vision' ? visionStats : indexStats

  if (isLoading) {
    return (
      <>
        <div className="border-b border-border-light">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-6">
              <div className="h-12 w-48 bg-surface rounded animate-pulse" />
              <div className="mt-4 flex gap-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-8 w-20 bg-surface rounded animate-pulse" />
                ))}
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
      <ProfileHeader
        address={address}
        lastActiveAt={profile?.stats.lastActiveAt ?? undefined}
        stats={stats}
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
