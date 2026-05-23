'use client'

import Image from 'next/image'
import { useState, type ReactNode } from 'react'
import { Link, usePathname } from '@/i18n/routing'

export type SourceTab = 'overview' | 'markets' | 'activity' | 'leaderboard' | 'compare'

interface Tab {
  id: SourceTab
  label: string
  href: string
}

interface SourceTabNavProps {
  sourceId: string
  /** Active tab. Derived from pathname when omitted. */
  activeTab?: SourceTab
  /**
   * Inline brand block rendered to the left of the tabs. When provided, the
   * tab-nav row absorbs what used to live in a separate hero, saving ~70px
   * of vertical space at the top of the page.
   */
  brand?: {
    name: string
    logo?: string
    brandBg?: string
  }
  /** Right-aligned slot — typically the round-phase chip or aggregate value. */
  trailing?: ReactNode
}

const COMPARE_SOURCES = new Set(['polymarket'])

function buildTabs(sourceId: string): Tab[] {
  const base = `/source/${sourceId}`
  const tabs: Tab[] = [
    { id: 'overview',     label: 'Overview',     href: base },
    { id: 'markets',      label: 'Markets',      href: `${base}/markets` },
    { id: 'activity',     label: 'Activity',     href: `${base}/activity` },
    { id: 'leaderboard',  label: 'Leaderboard',  href: `${base}/leaderboard` },
  ]
  if (COMPARE_SOURCES.has(sourceId)) {
    tabs.push({ id: 'compare', label: 'Compare', href: `${base}/compare` })
  }
  return tabs
}

function deriveActiveTab(pathname: string, sourceId: string): SourceTab {
  const base = `/source/${sourceId}`
  if (pathname === base || pathname === `${base}/`) return 'overview'
  if (pathname.startsWith(`${base}/markets`)) return 'markets'
  if (pathname.startsWith(`${base}/activity`)) return 'activity'
  if (pathname.startsWith(`${base}/leaderboard`)) return 'leaderboard'
  if (pathname.startsWith(`${base}/compare`)) return 'compare'
  return 'overview'
}

export function SourceTabNav({
  sourceId,
  activeTab: activeTabProp,
  brand,
  trailing,
}: SourceTabNavProps) {
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
        {brand && <BrandBadge {...brand} />}
        <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 auto', minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
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
        {trailing && (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
            {trailing}
          </div>
        )}
      </div>

      <style>{`
        .tab-nav-inactive:hover {
          color: var(--apple-text) !important;
        }
      `}</style>
    </nav>
  )
}

function BrandBadge({ name, logo, brandBg }: { name: string; logo?: string; brandBg?: string }) {
  const [broken, setBroken] = useState(false)
  const hasLogo = !!logo && !broken
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        paddingRight: 14,
        marginRight: 6,
        borderRight: '1px solid var(--apple-line)',
        flexShrink: 0,
      }}
    >
      {hasLogo && (
        <div
          style={{
            width: 24,
            height: 24,
            background: brandBg || '#000',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
          aria-hidden
        >
          <Image
            src={logo!}
            alt=""
            width={48}
            height={20}
            className="max-h-[18px] max-w-[80%] object-contain"
            priority
            onError={() => setBroken(true)}
          />
        </div>
      )}
      <span
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 'var(--apple-fs-14)',
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text)',
          whiteSpace: 'nowrap',
          maxWidth: 220,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
      </span>
    </div>
  )
}
