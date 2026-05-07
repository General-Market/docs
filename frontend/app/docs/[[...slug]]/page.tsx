import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { loadDoc } from '@/lib/docs/mdx'
import { mdxComponents } from '@/components/docs/MdxComponents'
import { DOCS_NAV, adjacentPages, flattenSlugs, pageHref } from '@/lib/docs/nav'

type Params = { slug?: string[] }

export function generateStaticParams(): Params[] {
  const all = flattenSlugs()
  return [{ slug: undefined }, ...all.map(s => ({ slug: s.split('/') }))]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const slugStr = (slug ?? []).join('/')
  if (!slugStr) {
    return {
      title: 'Documentation',
      description:
        'Documentation for General Market — on-chain index products, prediction markets, and DeFi lending.',
      alternates: { canonical: '/docs' },
    }
  }
  const doc = await loadDoc(slugStr)
  if (!doc) return {}
  return {
    title: doc.frontmatter.title ?? slugStr,
    description: doc.frontmatter.description,
    alternates: { canonical: pageHref(slugStr) },
  }
}

export default async function DocsPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const slugStr = (slug ?? []).join('/')

  if (!slugStr) {
    return <DocsLanding />
  }

  const doc = await loadDoc(slugStr)
  if (!doc) notFound()

  const { prev, next } = adjacentPages(slugStr)

  return (
    <article className="docs-article">
      <header className="docs-article-header">
        {doc.frontmatter.title ? <h1>{doc.frontmatter.title}</h1> : null}
        {doc.frontmatter.description ? (
          <p className="docs-lede">{doc.frontmatter.description}</p>
        ) : null}
      </header>

      <div className="docs-prose">
        <MDXRemote
          source={doc.source}
          components={mdxComponents}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [[rehypeHighlight, { detect: true, ignoreMissing: true }]],
            },
          }}
        />
      </div>

      {(prev || next) && (
        <nav className="docs-pager" aria-label="Page navigation">
          {prev ? (
            <Link href={pageHref(prev)} className="docs-pager-link prev">
              <span className="docs-pager-label">Previous</span>
              <span className="docs-pager-title">{prettyTitle(prev)}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={pageHref(next)} className="docs-pager-link next">
              <span className="docs-pager-label">Next</span>
              <span className="docs-pager-title">{prettyTitle(next)}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </article>
  )
}

function prettyTitle(slug: string): string {
  const last = slug.split('/').pop() ?? slug
  return last
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bApi\b/, 'API')
    .replace(/\bItp\b/, 'ITP')
    .replace(/\bItps\b/, 'ITPs')
    .replace(/\bNav\b/, 'NAV')
}

function DocsLanding() {
  return (
    <div className="docs-landing">
      <p className="docs-landing-eyebrow">Documentation</p>
      <h1>Two protocols. One docs.</h1>
      <p className="docs-landing-lede">
        Index covers on-chain ETF mechanics, NAV pricing, oracle consensus, and lending.
        Vision covers sealed-bet prediction markets across 90+ real-world data sources. Both
        run on a custom Arbitrum Orbit L3.
      </p>
      <div className="docs-landing-cards">
        {DOCS_NAV.map(tab => (
          <Link key={tab.id} href={pageHref(tab.groups[0].pages[0])} className="docs-landing-card">
            <h2>{tab.title}</h2>
            <p>{tab.description}</p>
            <span className="docs-landing-card-arrow">Read the docs →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
