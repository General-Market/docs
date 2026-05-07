import type { Metadata } from 'next'
import Link from 'next/link'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { GeneralMarketWordmark } from '@/components/docs/Schematics'
import { loadAllSummaries } from '@/lib/docs/mdx'
import { flattenSlugs } from '@/lib/docs/nav'
import './docs.css'

export const metadata: Metadata = {
  title: { default: 'Documentation · General Market', template: '%s · General Market Docs' },
  description:
    'Documentation for General Market — on-chain index products, prediction markets, and DeFi lending.',
  alternates: { canonical: '/docs' },
  robots: { index: true, follow: true },
}

async function buildTitleMap(): Promise<Record<string, string>> {
  const summaries = await loadAllSummaries(flattenSlugs())
  const map: Record<string, string> = {}
  for (const s of summaries) {
    if (s.frontmatter.sidebarTitle) map[s.slug] = s.frontmatter.sidebarTitle
    else if (s.frontmatter.title) map[s.slug] = s.frontmatter.title
  }
  return map
}

function DocsTopbar() {
  return (
    <header className="docs-topbar">
      <div className="docs-topbar-inner">
        <Link href="/docs" className="docs-brand-logo" aria-label="General Market — Documentation">
          <GeneralMarketWordmark height={20} />
          <span className="docs-brand-suffix">Docs</span>
        </Link>
        <nav className="docs-tabs" aria-label="Sections">
          <Link href="/docs/vision/introduction" className="docs-tab">
            Vision
          </Link>
          <Link href="/docs/index/introduction" className="docs-tab">
            Index
          </Link>
        </nav>
        <div className="docs-topbar-actions">
          <button type="button" className="docs-search-trigger" aria-label="Search documentation">
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <Link href="/" className="docs-cta">
            Launch app
          </Link>
        </div>
      </div>
    </header>
  )
}

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const titleMap = await buildTitleMap()
  return (
    <div className="docs-root">
      <DocsTopbar />
      <div className="docs-shell">
        <aside className="docs-sidebar">
          <DocsSidebar titleMap={titleMap} />
        </aside>
        <main className="docs-main">{children}</main>
      </div>
    </div>
  )
}
