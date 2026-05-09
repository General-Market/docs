import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { loadDoc } from '@/lib/docs/mdx'
import { mdxComponents } from '@/components/docs/MdxComponents'
import { adjacentPages, flattenSlugs, pageHref } from '@/lib/docs/nav'

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
      title: 'Blocks Documentation · General Market',
      description:
        'Blocks: sealed bets across 90+ data sources. Predators excluded by construction. Plus Index, on-chain ETFs.',
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
    redirect('/docs/blocks/introduction')
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
