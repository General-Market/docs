'use client'

import { useQuery } from '@tanstack/react-query'
import { Link, usePathname } from '@/i18n/routing'

export type SourceTab = 'overview' | 'markets' | 'activity' | 'leaderboard' | 'compare'

interface SourceBatchMeta {
  tickDurationSecs?: number
}

function formatTickDuration(secs: number): string {
  if (secs >= 86_400) return `${Math.round(secs / 86_400)} d`
  if (secs >= 3_600) return `${Math.round(secs / 3_600)} h`
  if (secs >= 60) return `${Math.round(secs / 60)} min`
  return `${secs} s`
}

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

export function SourceTabNav({ sourceId, activeTab: activeTabProp }: SourceTabNavProps) {
  const pathname = usePathname()
  const active = activeTabProp ?? deriveActiveTab(pathname, sourceId)
  const tabs = buildTabs(sourceId)

  const { data: meta } = useQuery<SourceBatchMeta>({
    queryKey: ['source-batch-meta', sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/vision/config/${encodeURIComponent(sourceId)}`)
      if (!res.ok) return {}
      return res.json()
    },
    staleTime: 300_000,
    retry: 1,
  })

  const tickLabel =
    meta?.tickDurationSecs && meta.tickDurationSecs > 0
      ? formatTickDuration(meta.tickDurationSecs)
      : null

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

      <div
        style={{
          borderTop: '1px solid var(--apple-line)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 18,
          fontFamily: 'var(--apple-font-text)',
          fontSize: 13,
          lineHeight: 1.3,
          letterSpacing: -0.005,
          color: 'var(--apple-text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: 'rgb(52,199,89)',
              display: 'inline-block',
              boxShadow: '0 0 0 3px rgba(52,199,89,0.15)',
            }}
          />
          <span style={{ fontWeight: 600 }}>
            {tickLabel ? `Settles every ${tickLabel}` : 'Settles in fixed batches'}
          </span>
        </span>
        <span style={{ color: 'var(--apple-text-secondary)' }}>
          Each batch picks its own threshold — calibrated to recent volatility.
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 14,
            marginLeft: 'auto',
            color: 'var(--apple-text)',
            fontWeight: 500,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'rgb(52,199,89)', fontSize: 14 }}>▲</span>
            <span>over band</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'rgb(255,59,48)', fontSize: 14 }}>▼</span>
            <span>under band</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--apple-text-secondary)', fontSize: 14 }}>─</span>
            <span>inside band</span>
          </span>
        </span>
      </div>

      <style>{`
        .tab-nav-inactive:hover {
          color: var(--apple-text) !important;
        }
      `}</style>
    </nav>
  )
}
