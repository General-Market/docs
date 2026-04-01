import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
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
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <ItpBrowserGrid />
      <div className="flex-1" />
      <Footer />
    </main>
  )
}
