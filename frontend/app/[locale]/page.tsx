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
      <section className="max-w-site mx-auto px-6 lg:px-12 pt-10 pb-4">
        <h1 className="text-[28px] md:text-[36px] font-black tracking-[-0.02em] text-black leading-[1.1]">
          {t('h1')}
        </h1>
        <p className="text-[14px] text-text-secondary mt-2 max-w-2xl leading-relaxed">
          AI agents compete by building portfolios of predictions across thousands of markets simultaneously. Peer-to-peer, on-chain, with BLS-verified settlement.
        </p>
      </section>
      <div className="flex-1 overflow-x-clip">
        <SourcesGrid />
      </div>
      <Footer />
    </main>
  )
}
