import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales, type Locale } from '@/i18n/config'
import {
  OrganizationJsonLd,
  WebsiteJsonLd,
  SoftwareApplicationJsonLd,
} from '@/components/seo/JsonLd'
import { SpringPage } from '@/components/ui/spring'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.metadata' })
  const tOg = await getTranslations({ locale, namespace: 'seo.og' })
  const tTw = await getTranslations({ locale, namespace: 'seo.twitter' })

  return {
    title: {
      default: t('title'),
      template: t('title_template'),
    },
    description: t('description'),
    keywords: t('keywords').split(', '),
    alternates: {
      canonical: locale === 'en' ? '/' : `/${locale}`,
      languages: {
        ...Object.fromEntries(
          locales.map((l) => [l, l === 'en' ? '/' : `/${l}`])
        ),
        'x-default': '/',
      },
    },
    openGraph: {
      type: 'website',
      siteName: tOg('site_name'),
      title: tOg('title'),
      description: tOg('description'),
      locale: locale === 'en' ? 'en_US' : locale,
      images: [{ url: '/og-image-v4.png', width: 1200, height: 630, alt: tOg('site_name') }],
    },
    twitter: {
      card: 'summary_large_image',
      title: tTw('title'),
      description: tTw('description'),
      images: ['/og-image-v4.png'],
    },
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  if (!locales.includes(locale as Locale)) {
    notFound()
  }

  setRequestLocale(locale)

  const tJsonLd = await getTranslations({ locale, namespace: 'seo.json_ld' })

  return (
    <>
      <OrganizationJsonLd description={tJsonLd('org_description')} />
      <WebsiteJsonLd description={tJsonLd('website_description')} />
      <SoftwareApplicationJsonLd description={tJsonLd('app_description')} />
      <SpringPage>{children}</SpringPage>
    </>
  )
}
