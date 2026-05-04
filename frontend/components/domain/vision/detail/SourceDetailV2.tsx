'use client'

import { useMemo, useCallback, useRef } from 'react'
import { useRouter } from '@/i18n/routing'
import { useSourceSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useBatches } from '@/hooks/vision/useBatches'
import { useRounds } from '@/hooks/vision/useRounds'
import { usePlayerPosition } from '@/hooks/vision/usePlayerPosition'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { PendingPositions } from './PendingPositions'
import { SourceSidebarApple } from './SourceSidebarApple'
import { SourceTabNav } from './SourceTabNav'
import { SourceSidebarMobile } from './SourceSidebarMobile'
import { FeaturedVaultHero } from './FeaturedVaultHero'
import { UpNextRail } from './UpNextRail'
import { TrendingBotsRail } from './TrendingBotsRail'
import { VaultShowcase } from './VaultShowcase'
import { WalletSourceStats } from './shared'
import type { SourceDisplayServer } from '@/lib/vision/sources-server'
import { useTranslations } from 'next-intl'
import { SourceDetailSkeleton } from '@/components/ui/VisionLoader'
import { useOnboarding } from '@/hooks/useOnboarding'
import { OnboardingCompass } from './OnboardingCompass'

interface SourceDetailV2Props {
  sourceId: string
  initialSource?: SourceDisplayServer
}

export function SourceDetailV2({ sourceId, initialSource }: SourceDetailV2Props) {
  const t = useTranslations('vision')
  const router = useRouter()

  const { sources, isLoading: isRegistryLoading } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)

  const source = sourceEntry
    ? {
        id: sourceEntry.sourceId,
        name: sourceEntry.name,
        description: sourceEntry.description,
        category: sourceEntry.category,
        logo: sourceEntry.logo,
        brandBg: sourceEntry.brandBg,
        prefixes: sourceEntry.prefixes,
        valueLabel: sourceEntry.valueLabel,
        valueUnit: sourceEntry.valueUnit,
        isPrice: sourceEntry.isPrice,
      }
    : initialSource
      ? {
          id: initialSource.sourceId,
          name: initialSource.name,
          description: initialSource.description,
          category: initialSource.category,
          logo: initialSource.logo,
          brandBg: initialSource.brandBg,
          prefixes: initialSource.prefixes,
          valueLabel: initialSource.valueLabel,
          valueUnit: initialSource.valueUnit,
          isPrice: initialSource.isPrice,
        }
      : null

  // Snapshot + meta still needed by shared sub-components.
  useSourceSnapshot(sourceId)
  useMarketSnapshotMeta()

  const { data: batches } = useBatches()
  const { data: rounds } = useRounds(sourceId)

  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    return batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  usePlayerPosition(activeBatch?.id)

  const onboarding = useOnboarding(sourceId)
  const vaultShowcaseRef = useRef<HTMLDivElement>(null)

  const handleOnboardingVaultDeposit = useCallback(() => {
    if (sourceId === 'twitch') {
      vaultShowcaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    router.push('/source/twitch')
  }, [router, sourceId])

  const handleOnboardingBotDeploy = useCallback(() => {
    router.push('/build-bot')
  }, [router])

  if (isRegistryLoading && !initialSource) {
    return <SourceDetailSkeleton />
  }

  if (!source) {
    return (
      <div className="px-6 lg:px-12 py-12">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-black text-black mb-2">
            {t('source_detail.source_not_found')}
          </h1>
          <p className="text-text-secondary mb-4">
            {t('source_detail.source_not_found_description', { sourceId })}
          </p>
          <button
            onClick={() => router.push('/')}
            className="text-[13px] font-bold text-black underline hover:no-underline"
          >
            {t('common_labels.back_to_sources')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <SourceSidebarApple sourceId={sourceId} category={source.category} />

      <div className="flex-1 min-w-0 flex flex-col">
        <SourceTabNav sourceId={sourceId} activeTab="overview" />

        <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 flex flex-col gap-10 lg:gap-12">
          {/* Hero row: featured vault (2/3) + Up Next rail (1/3) */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <FeaturedVaultHero sourceId={sourceId} />
            </div>
            <div>
              <UpNextRail sourceId={sourceId} />
            </div>
          </section>

          <WalletSourceStats sourceId={sourceId} />

          {rounds && rounds.length > 0 && (
            <PendingPositions
              rounds={rounds}
              activeBatchId={activeBatch?.id}
            />
          )}

          {/* For You — curated vaults. VaultShowcase carries its own visual identity. */}
          <div
            ref={vaultShowcaseRef}
            data-onboarding-target="vault"
            className="[&:has(>div:empty)]:hidden [&:has(>div:first-child:empty)]:hidden"
          >
            <VaultShowcase sourceId={sourceId} />
          </div>

          {/* Trending — bots from the GitHub examples repo. */}
          <SectionWithHeader
            label="trending"
            title="bots"
            sub="from the vision-bot-examples repo"
          >
            <TrendingBotsRail sourceId={sourceId} />
          </SectionWithHeader>

          {/* Mobile-only "more sources" strip — desktop sidebar handles lg+. */}
          <SourceSidebarMobile currentSourceId={sourceId} category={source.category} />
        </div>
      </div>

      <OnboardingCompass
        state={onboarding}
        onVaultDeposit={handleOnboardingVaultDeposit}
        onBotDeploy={handleOnboardingBotDeploy}
      />
    </div>
  )
}

function SectionWithHeader({
  label,
  title,
  sub,
  children,
}: {
  label: string
  title: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <header className="mb-5 flex items-baseline gap-3">
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-loose)',
            color: 'var(--apple-text-tertiary)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <h2
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'var(--apple-fs-28)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tighter)',
            color: 'var(--apple-text)',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {title}
        </h2>
        {sub && (
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-14)',
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text-secondary)',
            }}
          >
            {sub}
          </span>
        )}
      </header>
      {children}
    </section>
  )
}
