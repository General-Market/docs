'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { sourcesWithVaults } from '@/lib/vision/sources-vaults'
import {
  ArrowLeftIcon,
  BotIcon,
  BoxesIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  PulseIcon,
  TrophyIcon,
} from '@/components/layout/apple-icons'

const SIDEBAR_EXCLUDED = new Set(['chaturbate', 'fourchan'])
const COLLAPSED_WIDTH = 56
const EXPANDED_WIDTH = 220
const STORAGE_KEY = 'apple-sidebar-expanded'
const EASE_OUT = 'cubic-bezier(0.25, 0.1, 0.3, 1)'

/**
 * Logo that disappears cleanly when the file is missing or fails to load.
 * The placeholder div was rendering a colored square forever — we replace
 * that with nothing. A missing logo should leave silence, not a stub.
 */
function LogoImg({ src, alt, size, radius }: { src: string | undefined; alt: string; size: number; radius: number }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return null
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setBroken(true)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        objectFit: 'contain',
        flexShrink: 0,
        background: 'var(--apple-surface)',
      }}
    />
  )
}

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
  const { sources } = useSourceRegistry()

  // -- Expanded state, persisted across pages via localStorage --
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === '1') setExpanded(true)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, expanded ? '1' : '0')
  }, [expanded])

  const currentSource = findSource(sources, sourceId)
  const effectiveCategory = category ?? currentSource?.category ?? ''

  const peers = useMemo<PeerSource[]>(() => {
    if (!sources.length || !effectiveCategory) return []
    const funded = sourcesWithVaults()
    return sources
      .filter(s =>
        s.sourceId !== sourceId
        && s.category === effectiveCategory
        && !SIDEBAR_EXCLUDED.has(s.sourceId)
        && funded.has(s.sourceId),
      )
      .slice(0, 6)
  }, [sources, sourceId, effectiveCategory])

  const categoryLabel = currentSource ? getCategoryLabel(currentSource.category) : getCategoryLabel(effectiveCategory)

  const overviewHref = `/source/${sourceId}`
  const marketsHref = `/source/${sourceId}/markets`
  const activityHref = `/source/${sourceId}/activity`
  const leaderboardHref = `/source/${sourceId}/leaderboard`

  const width = expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH

  return (
    <aside
      aria-label={t('aria_label')}
      style={{
        width,
        borderRight: '1px solid var(--apple-line)',
        background: 'var(--apple-panel)',
        flexShrink: 0,
        transition: `width 220ms ${EASE_OUT}`,
      }}
      className="hidden md:flex flex-col overflow-y-auto overflow-x-hidden"
    >
      {/* ── Back to home ── */}
      <Link
        href={'/' as never}
        title={t('back_to_home')}
        aria-label={t('back_to_home')}
        className="flex items-center rounded-apple-sm transition-colors duration-200 ease-apple"
        style={{
          height: 36,
          padding: expanded ? '0 12px' : 0,
          margin: expanded ? '12px 8px 0' : '12px auto 0',
          width: expanded ? `calc(${width}px - 16px)` : 36,
          justifyContent: expanded ? 'flex-start' : 'center',
          gap: 10,
          color: 'var(--apple-text-secondary)',
          textDecoration: 'none',
        }}
      >
        <ArrowLeftIcon className="w-[16px] h-[16px] shrink-0" />
        {expanded && (
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              letterSpacing: '-0.016em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {t('back_to_home')}
          </span>
        )}
      </Link>

      {/* ── Source identity ── */}
      <Link
        href={overviewHref as never}
        title={currentSource?.name ?? sourceId}
        aria-label={currentSource?.name ?? sourceId}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: expanded ? 'flex-start' : 'center',
          textDecoration: 'none',
          height: 44,
          padding: expanded ? '0 12px' : 0,
          margin: expanded ? '8px 8px' : '8px auto',
          width: expanded ? `calc(${width}px - 16px)` : 36,
          gap: 10,
        }}
      >
        <LogoImg
          src={currentSource?.logo ? `/source-imgs/icons/${currentSource.sourceId}.png` : undefined}
          alt={currentSource?.name ?? ''}
          size={28}
          radius={6}
        />
        {expanded && (
          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <p
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '-0.016em',
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
                fontSize: 10,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--apple-text-secondary)',
                margin: '2px 0 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {categoryLabel}
            </p>
          </div>
        )}
      </Link>

      <Divider expanded={expanded} />

      {/* ── Source nav ── */}
      <div className="flex flex-col gap-1" style={{ padding: expanded ? '8px 8px 0' : '8px 0 0' }}>
        <NavItem href={overviewHref} label={t('nav_overview')} Icon={HomeIcon} pathname={pathname} expanded={expanded} exact />
        <NavItem href={marketsHref} label={t('nav_markets')} Icon={BoxesIcon} pathname={pathname} expanded={expanded} />
        <NavItem href={activityHref} label={t('nav_activity')} Icon={PulseIcon} pathname={pathname} expanded={expanded} />
        <NavItem href={leaderboardHref} label={t('nav_leaderboard')} Icon={TrophyIcon} pathname={pathname} expanded={expanded} />
      </div>

      <Divider expanded={expanded} />

      {/* ── Build ── */}
      <div className="flex flex-col gap-1" style={{ padding: expanded ? '8px 8px 0' : '8px 0 0' }}>
        <NavItem href="/build-bot" label={t('nav_run_a_bot')} Icon={BotIcon} pathname={pathname} expanded={expanded} />
      </div>

      {/* ── Category peers ── */}
      {peers.length > 0 && (
        <>
          <Divider expanded={expanded} />
          <div className="flex flex-col gap-1" style={{ padding: expanded ? '8px 8px 0' : '8px 0 0' }}>
            {peers.map(peer => (
              <Link
                key={peer.sourceId}
                href={`/source/${peer.sourceId}` as never}
                title={peer.name}
                aria-label={peer.name}
                className="flex items-center rounded-apple-sm transition-colors duration-200 ease-apple source-peer-row"
                style={{
                  height: 36,
                  padding: expanded ? '0 8px' : 0,
                  margin: expanded ? '0' : '0 auto',
                  width: expanded ? '100%' : 36,
                  justifyContent: expanded ? 'flex-start' : 'center',
                  gap: 10,
                  textDecoration: 'none',
                }}
              >
                <LogoImg
                  src={`/source-imgs/icons/${peer.sourceId}.png`}
                  alt={peer.name}
                  size={20}
                  radius={5}
                />
                {expanded && (
                  <span
                    style={{
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 13,
                      fontWeight: 500,
                      letterSpacing: '-0.016em',
                      color: 'var(--apple-text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                    }}
                  >
                    {peer.name}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* spacer */}
      <div style={{ flex: 1, minHeight: 16 }} />

      {/* ── Collapse/expand toggle (Stake-style) ── */}
      <div style={{ padding: expanded ? '8px 8px 14px' : '8px 0 14px', display: 'flex', justifyContent: expanded ? 'flex-end' : 'center' }}>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          title={expanded ? 'Collapse' : 'Expand'}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--apple-text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: `background 180ms ${EASE_OUT}, color 180ms ${EASE_OUT}`,
          }}
          className="sidebar-toggle"
        >
          {expanded ? <ChevronLeftIcon className="w-[16px] h-[16px]" /> : <ChevronRightIcon className="w-[16px] h-[16px]" />}
        </button>
      </div>

      <style jsx>{`
        :global(.source-peer-row:hover) {
          background: rgba(0, 0, 0, 0.04);
        }
        :global(.sidebar-toggle:hover) {
          background: rgba(0, 0, 0, 0.06);
          color: var(--apple-text);
        }
      `}</style>
    </aside>
  )
}

function Divider({ expanded }: { expanded: boolean }) {
  return (
    <div
      style={{
        width: expanded ? 'auto' : 24,
        height: 1,
        margin: expanded ? '8px 12px 0' : '8px auto 0',
        background: 'var(--apple-line)',
      }}
    />
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface NavItemProps {
  href: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  pathname: string
  expanded: boolean
  /** When true, only matches the exact pathname (no prefix match). */
  exact?: boolean
}

function isNavActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href || pathname === `${href}/`
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavItem({ href, label, Icon, pathname, expanded, exact = false }: NavItemProps) {
  const active = isNavActive(pathname, href, exact)
  return (
    <Link
      href={href as never}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="flex items-center rounded-apple-sm transition-colors duration-200 ease-apple"
      style={{
        height: 36,
        padding: expanded ? '0 10px' : 0,
        margin: expanded ? '0' : '0 auto',
        width: expanded ? '100%' : 36,
        justifyContent: expanded ? 'flex-start' : 'center',
        gap: 10,
        background: active ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
        color: active ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
        textDecoration: 'none',
      }}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      {expanded && (
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            letterSpacing: '-0.016em',
            fontWeight: active ? 600 : 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </span>
      )}
    </Link>
  )
}
