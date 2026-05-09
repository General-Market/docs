import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { loadAllSummaries } from '@/lib/docs/mdx'
import { flattenSlugs } from '@/lib/docs/nav'
import './docs.css'

export const metadata: Metadata = {
  title: { default: 'Blocks Documentation · General Market', template: '%s · General Market Docs' },
  description:
    'Blocks: sealed bets across 90+ data sources. Predators excluded by construction. Plus Index, on-chain ETFs.',
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
          <Image src="/logo.svg" alt="" width={26} height={26} priority className="docs-brand-mark-img" />
          <span className="docs-brand-wordmark">General</span>
          <span className="docs-brand-suffix">Docs</span>
        </Link>
        <nav className="docs-tabs" aria-label="Sections">
          <Link href="/docs/blocks/introduction" className="docs-tab">
            Blocks
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
