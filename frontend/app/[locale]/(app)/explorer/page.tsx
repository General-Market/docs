import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import ExplorerPageClient from './ExplorerPageClient'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.explorer' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/explorer',
      languages: {
        en: '/explorer',
        ko: '/ko/explorer',
        ja: '/ja/explorer',
        zh: '/zh/explorer',
        'x-default': '/explorer',
      },
    },
  }
}

export default function ExplorerPage() {
  return (
    <AppShell search={<SourceSearch />}>
      <ExplorerPageClient />
    </AppShell>
  )
}
