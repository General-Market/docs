import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
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
    <>
      <Header />
      <ExplorerPageClient />
      <Footer />
    </>
  )
}
