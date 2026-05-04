'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { getCategoryLabel } from '@/lib/vision/source-categories'

const SIDEBAR_EXCLUDED = new Set(['chaturbate', 'fourchan'])

interface SourceSidebarAppleProps {
  sourceId: string
  /** Falls back to the registry entry's category when omitted. */
  category?: string
}

interface PeerSource {
  sourceId: string
  name: string
  logo: string
  category: string
}

export function SourceSidebarApple({ sourceId, category }: SourceSidebarAppleProps) {
  const t = useTranslations('vision.source_sidebar')
  const pathname = usePathname()
  const { sources, isLoading } = useSourceRegistry()

  const currentSource = findSource(sources, sourceId)
  const effectiveCategory = category ?? currentSource?.category ?? ''

  // Category peers: up to 6 sources in the same category, excluding self
  const peers = useMemo<PeerSource[]>(() => {
    if (!sources.length || !effectiveCategory) return []
    return sources
      .filter(s => s.sourceId !== sourceId && s.category === effectiveCategory && !SIDEBAR_EXCLUDED.has(s.sourceId))
      .slice(0, 6)
  }, [sources, sourceId, effectiveCategory])

  const categoryLabel = currentSource ? getCategoryLabel(currentSource.category) : getCategoryLabel(effectiveCategory)

  const overviewHref = `/source/${sourceId}`
  const marketsHref = `/source/${sourceId}/markets`
  const activityHref = `/source/${sourceId}/activity`
  const leaderboardHref = `/source/${sourceId}/leaderboard`

  return (
    <aside
      aria-label={t('aria_label')}
      style={{
        width: 'var(--apple-shell-left)',
        borderRight: '1px solid var(--apple-line)',
        background: 'var(--apple-panel)',
        flexShrink: 0,
        // Display + flex-direction live in className so `hidden` actually wins
        // below the breakpoint. Inline `display:flex` would override Tailwind.
      }}
      className="hidden md:flex flex-col"
    >
      {/* ── Source identity ── */}
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid var(--apple-line)',
        }}
      >
        <Link
          href={overviewHref as never}
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          {currentSource?.logo || isLoading ? (
            <img
              src={
                currentSource?.logo
                  ? `/source-imgs/icons/${currentSource.sourceId}.png`
                  : undefined
              }
              alt={currentSource?.name ?? ''}
              width={36}
              height={36}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                objectFit: 'contain',
                flexShrink: 0,
                background: 'var(--apple-surface)',
              }}
            />
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--apple-surface)',
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ overflow: 'hidden' }}>
            <p
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text)',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentSource?.name ?? sourceId}
            </p>
            <p
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-12)',
                letterSpacing: 'var(--apple-track-loose)',
                color: 'var(--apple-text-secondary)',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {categoryLabel}
            </p>
          </div>
        </Link>
      </div>

      {/* ── "for you" group ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <GroupHeader label={t('group_for_you')} />
        <NavItem href={overviewHref} label={t('nav_overview')} pathname={pathname} exact />
        <NavItem href={marketsHref} label={t('nav_markets')} pathname={pathname} />
        <NavItem href={activityHref} label={t('nav_activity')} pathname={pathname} />
        <NavItem href={leaderboardHref} label={t('nav_leaderboard')} pathname={pathname} />
      </div>

      {/* ── "build" group ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <GroupHeader label={t('group_build')} />
        <NavItem href="/build-bot" label={t('nav_run_a_bot')} pathname={pathname} />
      </div>

      {/* ── Peer sources in the same category ── */}
      {peers.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          <GroupHeader label={t('group_more_sources')} />
          {peers.map(peer => (
            <Link
              key={peer.sourceId}
              href={`/source/${peer.sourceId}` as never}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 8,
                textDecoration: 'none',
                transition: 'background 200ms var(--apple-ease-default)',
              }}
              className="source-sidebar-peer-link"
            >
              <img
                src={`/source-imgs/icons/${peer.sourceId}.png`}
                alt={peer.name}
                width={22}
                height={22}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  objectFit: 'contain',
                  flexShrink: 0,
                  background: 'var(--apple-surface)',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 'var(--apple-fs-14)',
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {peer.name}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* flex spacer */}
      <div style={{ flex: 1 }} />

      {/* ── footer link to all sources ── */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--apple-line)',
        }}
      >
        <Link
          href="/vision"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-12)',
            letterSpacing: 'var(--apple-track-loose)',
            color: 'var(--apple-text-secondary)',
            textDecoration: 'none',
          }}
        >
          {t('footer_all_sources')}
        </Link>
      </div>
    </aside>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GroupHeader({ label }: { label: string }) {
  return (
    <p
      style={{
        fontFamily: 'var(--apple-font-text)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 'var(--apple-track-loose)',
        color: 'var(--apple-text-tertiary)',
        textTransform: 'uppercase',
        margin: '0 0 4px 8px',
      }}
    >
      {label}
    </p>
  )
}

interface NavItemProps {
  href: string
  label: string
  pathname: string
  /** When true, only matches the exact pathname (no prefix match). */
  exact?: boolean
}

function isNavActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href || pathname === `${href}/`
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavItem({ href, label, pathname, exact = false }: NavItemProps) {
  const active = isNavActive(pathname, href, exact)
  return (
    <Link
      href={href as never}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'block',
        padding: '6px 8px',
        borderRadius: 8,
        textDecoration: 'none',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 'var(--apple-fs-14)',
        letterSpacing: 'var(--apple-track-tight)',
        color: active ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
        fontWeight: active ? 600 : 400,
        background: active ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
        transition: 'background 200ms var(--apple-ease-default), color 200ms var(--apple-ease-default)',
      }}
      className="source-sidebar-nav-item"
    >
      {label}
    </Link>
  )
}
