import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SourcesGrid } from '@/components/domain/vision/sources/SourcesGrid'
import { WelcomeHero, HeroLeaderboard } from '@/components/domain/vision/WelcomeHero'
import { HomeOnboardingCompass } from '@/components/domain/vision/HomeOnboardingCompass'

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
    <main className="min-h-screen bg-page flex flex-col overflow-x-clip">
      <Header />
      <WelcomeHero />
      <HeroLeaderboard />
      <div className="flex-1 overflow-x-clip">
        <h1 className="sr-only">{t('h1')}</h1>
        <SourcesGrid />
      </div>
      <Footer />
      <HomeOnboardingCompass />
    </main>
  )
}
