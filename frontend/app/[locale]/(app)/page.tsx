import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { HomeDashboard } from '@/components/domain/home/HomeSections'
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
    <AppShell search={<SourceSearch />}>
      <h1 className="sr-only">{t('h1')}</h1>
      <HomeDashboard feeds={feeds} />
    </AppShell>
  )
}
