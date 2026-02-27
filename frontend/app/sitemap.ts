import { MetadataRoute } from 'next'
import { locales, defaultLocale } from '@/i18n/config'
import { getItpSummaries } from '@/lib/api/server-data'
import { getSourceIds } from '@/lib/vision/sources'

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
  let itps: { itpId: string }[] = []
  try {
    itps = await getItpSummaries()
  } catch {
    console.warn('sitemap: failed to fetch ITP summaries')
  }

  const staticRoutes: { path: string; lastModified: string }[] = [
    { path: '', lastModified: '2026-02-27' },
    { path: '/index', lastModified: '2026-02-27' },
    { path: '/sources', lastModified: '2026-02-27' },
    { path: '/points', lastModified: '2026-02-27' },
    { path: '/about', lastModified: '2026-02-27' },
    { path: '/privacy', lastModified: '2026-02-15' },
    { path: '/terms', lastModified: '2026-02-15' },
    { path: '/learn/what-are-itps', lastModified: '2026-02-27' },
    { path: '/fear-and-greed', lastModified: '2026-02-27' },
    { path: '/data', lastModified: '2026-02-27' },
    { path: '/backtest', lastModified: '2026-02-27' },
  ]

  const entries: MetadataRoute.Sitemap = []

  // Static pages — one entry per route with locale alternates
  for (const route of staticRoutes) {
    entries.push({
      url: localeUrl(route.path, defaultLocale),
      lastModified: new Date(route.lastModified),
      alternates: alternatesForPath(route.path),
    })
  }

  // ITP detail pages — one entry per ITP with locale alternates
  for (const itp of itps) {
    const path = `/itp/${itp.itpId}`
    entries.push({
      url: localeUrl(path, defaultLocale),
      lastModified: new Date(),
      alternates: alternatesForPath(path),
    })
  }

  // Source detail pages — one entry per source with locale alternates
  for (const sourceId of getSourceIds()) {
    const path = `/source/${sourceId}`
    entries.push({
      url: localeUrl(path, defaultLocale),
      lastModified: new Date(),
      alternates: alternatesForPath(path),
    })
  }

  return entries
}
