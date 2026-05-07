'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { DOCS_NAV, pageHref, type DocTabId } from '@/lib/docs/nav'

function deriveTitle(slug: string): string {
  const last = slug.split('/').pop() ?? slug
  return last
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bApi\b/, 'API')
    .replace(/\bItp\b/, 'ITP')
    .replace(/\bItps\b/, 'ITPs')
    .replace(/\bNav\b/, 'NAV')
}

export function DocsSidebar({ titleMap }: { titleMap?: Record<string, string> }) {
  const pathname = usePathname() ?? ''
  const activeTab: DocTabId = pathname.startsWith('/docs/index') ? 'index' : 'vision'
  const tab = DOCS_NAV.find(t => t.id === activeTab) ?? DOCS_NAV[0]
  const title = (slug: string) => titleMap?.[slug] ?? deriveTitle(slug)

  return (
    <nav className="docs-sidebar-nav" aria-label="Documentation">
      <div className="docs-tab-switcher" role="tablist">
        {DOCS_NAV.map(t => (
          <Link
            key={t.id}
            href={pageHref(t.groups[0].pages[0])}
            data-active={t.id === activeTab}
            className="docs-tab"
            role="tab"
            aria-selected={t.id === activeTab}
          >
            {t.title}
          </Link>
        ))}
      </div>

      {tab.groups.map(group => (
        <div key={group.title} className="docs-group">
          <div className="docs-group-title">{group.title}</div>
          <ul className="docs-group-links">
            {group.pages.map(slug => {
              const href = pageHref(slug)
              const active = pathname === href
              return (
                <li key={slug}>
                  <Link href={href} data-active={active}>
                    {title(slug)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
