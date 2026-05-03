import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import {
  FeaturedHero,
  FeaturedRow,
  TopMarketsStrip,
  SidebarFeatured,
} from '@/components/domain/home/HomeSections'
import { HomeOnboardingCompass } from '@/components/domain/vision/HomeOnboardingCompass'
import { getHomeFeeds } from '@/lib/vision/adapters'

export const revalidate = 600

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.vision' })
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function HomePage() {
  const t = await getTranslations('seo.sr_only')
  const feeds = await getHomeFeeds()

  return (
    <>
      <AppShell
        search={<SourceSearch />}
        rightRail={<SidebarFeatured feeds={feeds} />}
      >
        <h1 className="sr-only">{t('h1')}</h1>

        <section className="mb-10">
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-12)',
              letterSpacing: 'var(--apple-track-loose)',
              color: 'var(--apple-accent)',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
            className="mb-3"
          >
            Anti-Cheat
          </p>
          <h2 className="apple-hero-line">
            Trading is easy with an Anti-Cheat.
          </h2>
          <p className="apple-hero-sub mt-4 max-w-apple">
            Sealed bets. Parimutuel pools. Oracle consensus you can verify.
            The market can&apos;t see your hand and neither can the house.
          </p>
        </section>

        <section className="mb-10">
          <FeaturedHero feeds={feeds} />
        </section>

        <section className="mb-12">
          <FeaturedRow feeds={feeds} />
        </section>

        <section className="mb-12">
          <TopMarketsStrip feeds={feeds} />
        </section>
      </AppShell>
      <HomeOnboardingCompass />
    </>
  )
}
