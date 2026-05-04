'use client'

import { Link, usePathname } from '@/i18n/routing'

export type SourceTab = 'overview' | 'markets' | 'activity' | 'leaderboard'

interface Tab {
  id: SourceTab
  label: string
  href: string
}

interface SourceTabNavProps {
  sourceId: string
  /** Active tab. Derived from pathname when omitted. */
  activeTab?: SourceTab
}

function buildTabs(sourceId: string): Tab[] {
  const base = `/source/${sourceId}`
  return [
    { id: 'overview',     label: 'Overview',     href: base },
    { id: 'markets',      label: 'Markets',      href: `${base}/markets` },
    { id: 'activity',     label: 'Activity',     href: `${base}/activity` },
    { id: 'leaderboard',  label: 'Leaderboard',  href: `${base}/leaderboard` },
  ]
}

function deriveActiveTab(pathname: string, sourceId: string): SourceTab {
  const base = `/source/${sourceId}`
  if (pathname === base || pathname === `${base}/`) return 'overview'
  if (pathname.startsWith(`${base}/markets`)) return 'markets'
  if (pathname.startsWith(`${base}/activity`)) return 'activity'
  if (pathname.startsWith(`${base}/leaderboard`)) return 'leaderboard'
  return 'overview'
}

export function SourceTabNav({ sourceId, activeTab: activeTabProp }: SourceTabNavProps) {
  const pathname = usePathname()
  const active = activeTabProp ?? deriveActiveTab(pathname, sourceId)
  const tabs = buildTabs(sourceId)

  return (
    <nav
      aria-label="Source sections"
      style={{
        borderBottom: '1px solid var(--apple-line)',
        background: 'var(--apple-panel)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          padding: '0 16px',
        }}
      >
        {tabs.map(tab => {
          const isActive = tab.id === active
          return (
            <Link
              key={tab.id}
              href={tab.href as never}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '12px 14px 11px',
                textDecoration: 'none',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-14)',
                fontWeight: isActive ? 500 : 400,
                letterSpacing: 'var(--apple-track-tight)',
                color: isActive ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
                borderBottom: isActive ? '1px solid var(--apple-text)' : '1px solid transparent',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'color 200ms var(--apple-ease-default)',
              }}
              className={isActive ? '' : 'tab-nav-inactive'}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <style>{`
        .tab-nav-inactive:hover {
          color: var(--apple-text) !important;
        }
      `}</style>
    </nav>
  )
}
