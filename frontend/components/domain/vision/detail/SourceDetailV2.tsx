'use client'

import { useMemo, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from '@/i18n/routing'
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
import { GeneralLoader } from '@/components/ui/GeneralLoader'

interface SourceDetailV2Props {
  sourceId: string
  initialSource?: SourceDisplayServer
  /**
   * When true, SourceDetailV2 omits its own SourceSidebarApple and flex
   * wrapper. Use this when the parent page already slots the sidebar into
   * AppShell — the shell's 240px column IS the sidebar, and this component
   * renders as a straight content column inside the grid's right cell.
   */
  hideSidebar?: boolean
}

export function SourceDetailV2({ sourceId, initialSource, hideSidebar }: SourceDetailV2Props) {
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

  const { data: batches } = useBatches()
  const { data: rounds } = useRounds(sourceId)

  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    return batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  usePlayerPosition(activeBatch?.id)

  const vaultShowcaseRef = useRef<HTMLDivElement>(null)

  if (isRegistryLoading && !initialSource) {
    return <GeneralLoader height="70vh" />
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

  const contentColumn = (
    <div className="flex-1 min-w-0 flex flex-col">
      <SourceTabNav sourceId={sourceId} activeTab="overview" />

      <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 flex flex-col gap-10 lg:gap-12">
        {/* Identity — renders synchronously from initialSource so the brand greets you before any data. */}
        <SourceIdentityCard
          name={source.name}
          description={source.description}
          category={source.category}
          logo={source.logo}
          brandBg={source.brandBg}
        />

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
  )

  if (hideSidebar) return contentColumn

  return (
    <div className="flex">
      <SourceSidebarApple sourceId={sourceId} category={source.category} />
      {contentColumn}
    </div>
  )
}

/**
 * Identity card. Mirrors the home page Featured surface — eyebrow, display name,
 * description, meta pill — and renders synchronously from props. The brand
 * introduces itself before the SSE has the courtesy to arrive.
 */
function SourceIdentityCard({
  name,
  description,
  category,
  logo,
  brandBg,
}: {
  name: string
  description: string
  category: string
  logo: string
  brandBg: string
}) {
  return (
    <section
      className="flex items-center gap-5 sm:gap-6 border p-5 sm:p-6"
      style={{
        background: 'var(--apple-panel)',
        borderColor: 'var(--apple-line)',
        borderRadius: 'var(--apple-r-card)',
      }}
    >
      <div
        className="relative shrink-0 flex items-center justify-center overflow-hidden"
        style={{
          width: 64,
          height: 64,
          background: brandBg || '#000',
          borderRadius: 'var(--apple-r-md)',
        }}
        aria-hidden
      >
        {logo ? (
          <Image
            src={logo}
            alt=""
            width={96}
            height={48}
            className="max-h-[48px] max-w-[80%] object-contain"
            priority
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-loose)',
            color: 'var(--apple-text-tertiary)',
            textTransform: 'uppercase',
          }}
        >
          source
        </div>
        <h2
          className="mt-1 font-semibold"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 28,
            letterSpacing: 'var(--apple-track-tight)',
            lineHeight: 1.1,
            color: 'var(--apple-text)',
            margin: 0,
          }}
        >
          {name}
        </h2>
        {description && (
          <p
            className="mt-2"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 14,
              lineHeight: 1.45,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text-secondary)',
              margin: 0,
            }}
          >
            {description}
          </p>
        )}
        {category && (
          <div className="mt-3">
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-1 font-medium"
              style={{
                color: 'var(--apple-text-secondary)',
                borderColor: 'var(--apple-line)',
                background: 'transparent',
                fontSize: 11,
                letterSpacing: '0.04em',
              }}
            >
              {category}
            </span>
          </div>
        )}
      </div>
    </section>
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
