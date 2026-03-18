import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales, type Locale } from '@/i18n/config'
import {
  OrganizationJsonLd,
  WebsiteJsonLd,
  SoftwareApplicationJsonLd,
} from '@/components/seo/JsonLd'
import { HowItWorksButton } from '@/components/ui/HowItWorksButton'

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

  return {
    title: {
      default: t('title'),
      template: t('title_template'),
    },
    description: t('description'),
    keywords: t('keywords').split(', '),
    openGraph: {
      locale,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'General Market' }],
    },
    twitter: {
      card: 'summary_large_image',
      images: ['/og-image.png'],
    },
    alternates: {
      canonical: locale === 'en' ? '/' : `/${locale}`,
      languages: {
        ...Object.fromEntries(
          locales.map((l) => [l, l === 'en' ? '/' : `/${l}`])
        ),
        'x-default': '/',
      },
    },
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  if (!locales.includes(locale as Locale)) {
    notFound()
  }

  const [messages, tJsonLd] = await Promise.all([
    getMessages(),
    getTranslations({ locale, namespace: 'seo.json_ld' }),
  ])

  return (
    <NextIntlClientProvider messages={messages}>
      <OrganizationJsonLd description={tJsonLd('org_description')} />
      <WebsiteJsonLd description={tJsonLd('website_description')} />
      <SoftwareApplicationJsonLd description={tJsonLd('app_description')} />
      {children}
      <HowItWorksButton />
    </NextIntlClientProvider>
  )
}
