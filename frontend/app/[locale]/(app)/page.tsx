import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { HomeDashboard } from '@/components/domain/home/HomeSections'
import { getHomeFeeds } from '@/lib/vision/adapters'
import { getSourceRegistryServer } from '@/lib/vision/sources-server'

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
  const [feeds, registry] = await Promise.all([
    getHomeFeeds(),
    getSourceRegistryServer(),
  ])
  const liveSourceIds = new Set<string>()
  for (const s of registry.sources) {
    liveSourceIds.add(s.sourceId)
    if (s.internalIds) for (const id of s.internalIds) liveSourceIds.add(id)
  }

  return (
    <AppShell search={<SourceSearch />}>
      <h1 className="sr-only">{t('h1')}</h1>
      <HomeDashboard feeds={feeds} liveSourceIds={liveSourceIds} />
    </AppShell>
  )
}
