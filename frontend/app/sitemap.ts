import { MetadataRoute } from 'next'
import { locales, defaultLocale } from '@/i18n/config'
import { getItpSummaries } from '@/lib/api/server-data'

const baseUrl = 'https://generalmarket.io'

function localeUrl(path: string, locale: string): string {
  if (locale === defaultLocale) return `${baseUrl}${path}`
  return `${baseUrl}/${locale}${path}`
}

function alternatesForPath(path: string) {
  return {
    languages: Object.fromEntries(
      locales.map((l) => [l, localeUrl(path, l)])
    ),
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const itps = await getItpSummaries()

  const staticRoutes: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '', changeFrequency: 'daily', priority: 1 },
    { path: '/docs', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/vision', changeFrequency: 'daily', priority: 0.7 },
    { path: '/privacy', changeFrequency: 'monthly', priority: 0.3 },
    { path: '/terms', changeFrequency: 'monthly', priority: 0.3 },
  ]

  const entries: MetadataRoute.Sitemap = []

  // Static pages — one entry per locale
  for (const route of staticRoutes) {
    for (const locale of locales) {
      entries.push({
        url: localeUrl(route.path, locale),
        lastModified: new Date(),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: alternatesForPath(route.path),
      })
    }
  }

  // ITP detail pages — one entry per locale per ITP
  for (const itp of itps) {
    const path = `/itp/${itp.itpId}`
    for (const locale of locales) {
      entries.push({
        url: localeUrl(path, locale),
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
        alternates: alternatesForPath(path),
      })
    }
  }

  return entries
}
