import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { LendingPage } from '@/components/lending/LendingPage'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.lending' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/lending',
      languages: {
        en: '/lending',
        ko: '/ko/lending',
        ja: '/ja/lending',
        zh: '/zh/lending',
        'x-default': '/lending',
      },
    },
  }
}

export default function LendingRoute() {
  return (
    <AppShell search={<SourceSearch />}>
      <LendingPage />
    </AppShell>
  )
}
