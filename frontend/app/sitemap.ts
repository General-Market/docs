import { MetadataRoute } from 'next'
import { locales, defaultLocale } from '@/i18n/config'
import { getItpSummaries } from '@/lib/api/server-data'
import { getSourceIds } from '@/lib/vision/sources'

const baseUrl = 'https://generalmarket.io'

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
  const itps = await getItpSummaries()

  const staticRoutes: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '', changeFrequency: 'daily', priority: 1 },
    { path: '/index', changeFrequency: 'daily', priority: 0.9 },
    { path: '/sources', changeFrequency: 'daily', priority: 0.5 },
    { path: '/points', changeFrequency: 'daily', priority: 0.5 },
    { path: '/about', changeFrequency: 'monthly' as const, priority: 0.7 },
    { path: '/privacy', changeFrequency: 'monthly', priority: 0.3 },
    { path: '/terms', changeFrequency: 'monthly', priority: 0.3 },
    { path: '/learn/what-are-itps', changeFrequency: 'monthly' as const, priority: 0.8 },
  ]

  const entries: MetadataRoute.Sitemap = []

  // Static pages — one entry per route with locale alternates
  for (const route of staticRoutes) {
    entries.push({
      url: localeUrl(route.path, defaultLocale),
      lastModified: new Date('2026-02-27'),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: alternatesForPath(route.path),
    })
  }

  // ITP detail pages — one entry per ITP with locale alternates
  for (const itp of itps) {
    const path = `/itp/${itp.itpId}`
    entries.push({
      url: localeUrl(path, defaultLocale),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
      alternates: alternatesForPath(path),
    })
  }

  // Source detail pages — one entry per source with locale alternates
  for (const sourceId of getSourceIds()) {
    const path = `/source/${sourceId}`
    entries.push({
      url: localeUrl(path, defaultLocale),
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
      alternates: alternatesForPath(path),
    })
  }

  return entries
}
