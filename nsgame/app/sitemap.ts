import { MetadataRoute } from 'next'
import { locales, defaultLocale } from '@/i18n/config'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nsgame.io'

function localeUrl(path: string, locale: string): string {
  if (locale === defaultLocale) return `${baseUrl}${path}`
  return `${baseUrl}/${locale}${path}`
}

function alternatesForPath(path: string) {
  return {
    languages: {
      ...Object.fromEntries(
        locales.map((l) => [l, localeUrl(path, l)])
      ),
      'x-default': localeUrl(path, defaultLocale),
    },
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    {
      url: localeUrl('', defaultLocale),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
      alternates: alternatesForPath(''),
    },
  ]
}
