import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import SourcesPageClient from './SourcesPageClient'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.sources_monitoring' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/sources',
      languages: {
        en: '/sources',
        ko: '/ko/sources',
        ja: '/ja/sources',
        zh: '/zh/sources',
        'x-default': '/sources',
      },
    },
  }
}

export default function SourcesPage() {
  return (
    <AppShell search={<SourceSearch />}>
      <SourcesPageClient />
    </AppShell>
  )
}
