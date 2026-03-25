import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
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
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <SourcesPageClient />
      <div className="flex-1" />
      <Footer />
    </main>
  )
}
