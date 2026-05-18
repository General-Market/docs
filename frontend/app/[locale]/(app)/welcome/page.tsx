import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'
import { SourcesGrid } from '@/components/domain/vision/sources/SourcesGrid'
import { WelcomeHero, HeroLeaderboard } from '@/components/domain/vision/WelcomeHero'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.vision' })
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function WelcomeLegacyPage() {
  const t = await getTranslations('seo.sr_only')

  return (
    <AppShell>
      <WelcomeHero />
      <HeroLeaderboard />
      <div className="overflow-x-clip">
        <h1 className="sr-only">{t('h1')}</h1>
        <SourcesGrid />
      </div>
    </AppShell>
  )
}
