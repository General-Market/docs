import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { HeroBand } from '@/components/ui/HeroBand'
import { SectionBar } from '@/components/ui/SectionBar'
import { Link } from '@/i18n/routing'
import { getAllArticles } from '@/lib/learn/articles'

export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.learn' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/learn',
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function LearnPage() {
  const articles = getAllArticles()

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Learn — AI Prediction Markets, Bots & Trading Guides',
    description:
      'Tutorials and guides for AI prediction market trading. Build bots, compare platforms, understand sealed parimutuel markets.',
    url: 'https://www.generalmarket.io/learn',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: articles.map((article, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://www.generalmarket.io/learn/${article.frontmatter.slug}`,
        name: article.frontmatter.title,
      })),
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.generalmarket.io' },
      { '@type': 'ListItem', position: 2, name: 'Learn' },
    ],
  }

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <HeroBand
        eyebrow="General Market"
        title="Learn"
        subtitle="Tutorials and guides for AI prediction market trading. Build bots, compare platforms, understand sealed parimutuel markets."
      />

      <div className="max-w-site mx-auto w-full px-6 lg:px-12 pb-16">
        <SectionBar title="Articles" value={String(articles.length)} />

        {articles.length === 0 ? (
          <p className="text-[14px] text-text-secondary mt-8">
            No articles yet. Check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border border-border-light mt-6">
            {articles.map((article) => (
              <Link
                key={article.frontmatter.slug}
                href={`/learn/${article.frontmatter.slug}`}
                className="border-r border-b border-border-light p-6 hover:border-black transition-colors group flex flex-col"
              >
                <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-text-muted mb-3">
                  {article.frontmatter.category}
                </div>
                <div className="text-[16px] font-extrabold tracking-[-0.01em] text-black leading-snug mb-2">
                  {article.frontmatter.title}
                </div>
                <div className="text-[14px] text-text-secondary leading-relaxed mb-4 flex-1">
                  {article.frontmatter.description}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[12px] text-text-muted">
                    {article.frontmatter.readingTime}
                  </div>
                  <div className="text-[12px] font-bold uppercase tracking-[0.04em] text-black group-hover:underline">
                    Read
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />
      <Footer />
    </main>
  )
}
