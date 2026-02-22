import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { P2PoolPage } from '@/components/domain/p2pool/P2PoolPage'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.vision' })
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default function VisionPage() {
  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <div className="flex-1 overflow-x-clip">
        <P2PoolPage />
      </div>
      <Footer />
    </main>
  )
}
