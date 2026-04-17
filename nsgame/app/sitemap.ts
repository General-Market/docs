import { MetadataRoute } from 'next'
import { locales, defaultLocale } from '@/i18n/config'
import { getSourceIdsServer } from '@/lib/vision/sources-server'

const baseUrl = 'https://www.generalmarket.io'

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
  const entries: MetadataRoute.Sitemap = []

  entries.push({
    url: localeUrl('', defaultLocale),
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1,
    alternates: alternatesForPath(''),
  })

  for (const sourceId of await getSourceIdsServer()) {
    const path = `/source/${sourceId}`
    entries.push({
      url: localeUrl(path, defaultLocale),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
      alternates: alternatesForPath(path),
    })
  }

  return entries
}
