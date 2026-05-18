import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { ItpBrowserGrid } from '@/components/domain/itp-browser/ItpBrowserGrid'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.itps' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/itps',
      languages: {
        en: '/itps',
        ko: '/ko/itps',
        ja: '/ja/itps',
        zh: '/zh/itps',
        'x-default': '/itps',
      },
    },
  }
}

export default function ItpsPage() {
  return (
    <AppShell search={<SourceSearch />}>
      <ItpBrowserGrid />
    </AppShell>
  )
}
