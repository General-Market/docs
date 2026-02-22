import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales, type Locale } from '@/i18n/config'
import {
  OrganizationJsonLd,
  WebsiteJsonLd,
  SoftwareApplicationJsonLd,
  FAQJsonLd,
} from '@/components/seo/JsonLd'

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
    },
    alternates: {
      languages: Object.fromEntries(
        locales.map((l) => [l, l === 'en' ? '/' : `/${l}`])
      ),
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

  const faqItems = [
    { question: tJsonLd('faq.q1'), answer: tJsonLd('faq.a1') },
    { question: tJsonLd('faq.q2'), answer: tJsonLd('faq.a2') },
    { question: tJsonLd('faq.q3'), answer: tJsonLd('faq.a3') },
    { question: tJsonLd('faq.q4'), answer: tJsonLd('faq.a4') },
  ]

  return (
    <NextIntlClientProvider messages={messages}>
      <OrganizationJsonLd description={tJsonLd('org_description')} />
      <WebsiteJsonLd description={tJsonLd('website_description')} />
      <SoftwareApplicationJsonLd description={tJsonLd('app_description')} />
      <FAQJsonLd items={faqItems} />
      {children}
    </NextIntlClientProvider>
  )
}
