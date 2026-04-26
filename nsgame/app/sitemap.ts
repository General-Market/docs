import { MetadataRoute } from 'next'
import { locales, defaultLocale } from '@/i18n/config'
import { listDocSlugs, type DocSection } from '@/lib/content/loadDoc'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nsgame.org'

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

const DOC_SECTIONS: DocSection[] = ['legal', 'product', 'trust', 'help', 'brand']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const homeEntry: MetadataRoute.Sitemap[number] = {
    url: localeUrl('', defaultLocale),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 1,
    alternates: alternatesForPath(''),
  }

  const sectionIndexEntries: MetadataRoute.Sitemap = DOC_SECTIONS.map(section => ({
    url: localeUrl(`/${section}`, defaultLocale),
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
    alternates: alternatesForPath(`/${section}`),
  }))

  const docEntries: MetadataRoute.Sitemap = DOC_SECTIONS.flatMap(section => {
    const slugs = listDocSlugs(section)
    return slugs
      // /help index renders help-center-home.mdx — skip it as a /help/[slug]
      .filter(slug => !(section === 'help' && slug === 'help-center-home'))
      .map(slug => ({
        url: localeUrl(`/${section}/${slug}`, defaultLocale),
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
        alternates: alternatesForPath(`/${section}/${slug}`),
      }))
  })

  return [homeEntry, ...sectionIndexEntries, ...docEntries]
}
