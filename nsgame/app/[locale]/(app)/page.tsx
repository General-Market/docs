import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

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
      <div className="flex-1 overflow-x-clip">
        <h1 className="sr-only">{t('h1')}</h1>
        <div className="px-6 lg:px-12 py-24">
          <div className="max-w-site mx-auto text-center text-text-muted">
            {/* Solana UI lands here. The EVM frontend was stripped;
                this placeholder waits for the integration agent. */}
            Vision is moving to Solana.
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}
