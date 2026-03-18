import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SourcesGrid } from '@/components/domain/vision/sources/SourcesGrid'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.vision' })
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function VisionPage() {
  const t = await getTranslations('seo.sr_only')

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <section className="px-6 lg:px-12 pt-12 pb-6">
        <h1 className="text-display font-black text-black">
          {t('h1')}
        </h1>
        <p className="text-body text-text-muted mt-3 max-w-xl font-normal leading-relaxed">
          {t('markets.description')}
        </p>
      </section>
      <div className="flex-1 overflow-x-clip">
        <SourcesGrid />
      </div>
      <Footer />
    </main>
  )
}
