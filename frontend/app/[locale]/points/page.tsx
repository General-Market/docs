import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import PointsPageClient from './PointsPageClient'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.points' })
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default function PointsPage() {
  return <PointsPageClient />
}
