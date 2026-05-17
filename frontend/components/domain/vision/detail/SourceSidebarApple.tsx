'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { sourcesWithVaults } from '@/lib/vision/sources-vaults'
import {
  ArrowLeftIcon,
  BotIcon,
  BoxesIcon,
  HomeIcon,
  PulseIcon,
  TrophyIcon,
} from '@/components/layout/apple-icons'

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
  const { sources } = useSourceRegistry()

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

  return (
    <aside
      aria-label={t('aria_label')}
      style={{
        width: 'var(--apple-shell-left)',
        borderRight: '1px solid var(--apple-line)',
        background: 'var(--apple-panel)',
        flexShrink: 0,
      }}
      className="hidden md:flex flex-col overflow-y-auto"
    >
      {/* ── Back to home ── */}
      <div style={{ padding: '12px 12px 0' }}>
        <Link
          href={'/' as never}
          className="flex items-center gap-2 px-3 py-2 rounded-apple-sm transition-colors duration-200 ease-apple"
          style={{
            color: 'var(--apple-text-secondary)',
            textDecoration: 'none',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            letterSpacing: 'var(--apple-track-tight)',
          }}
        >
          <ArrowLeftIcon className="w-[14px] h-[14px]" />
          <span>{t('back_to_home')}</span>
        </Link>
      </div>

      {/* ── Source identity ── */}
      <div
        style={{
          padding: '12px 16px 16px',
          borderBottom: '1px solid var(--apple-line)',
        }}
      >
        <Link
          href={overviewHref as never}
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          <LogoImg
            src={currentSource?.logo ? `/source-imgs/icons/${currentSource.sourceId}.png` : undefined}
            alt={currentSource?.name ?? ''}
            size={36}
            radius={8}
          />
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
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
                fontSize: 12,
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
        </Link>
      </div>

      {/* ── Source nav ── */}
      <div className="flex flex-col gap-0.5" style={{ padding: '12px 12px 0' }}>
        <GroupHeader label={t('group_for_you')} />
        <NavRow href={overviewHref} label={t('nav_overview')} Icon={HomeIcon} pathname={pathname} exact />
        <NavRow href={marketsHref} label={t('nav_markets')} Icon={BoxesIcon} pathname={pathname} />
        <NavRow href={activityHref} label={t('nav_activity')} Icon={PulseIcon} pathname={pathname} />
        <NavRow href={leaderboardHref} label={t('nav_leaderboard')} Icon={TrophyIcon} pathname={pathname} />
      </div>

      {/* ── Build ── */}
      <div className="flex flex-col gap-0.5" style={{ padding: '12px 12px 0' }}>
        <GroupHeader label={t('group_build')} />
        <NavRow href="/build-bot" label={t('nav_run_a_bot')} Icon={BotIcon} pathname={pathname} />
      </div>

      {/* ── Category peers ── */}
      {peers.length > 0 && (
        <div className="flex flex-col gap-0.5" style={{ padding: '12px 12px 0' }}>
          <GroupHeader label={t('group_more_sources')} />
          {peers.map(peer => (
            <Link
              key={peer.sourceId}
              href={`/source/${peer.sourceId}` as never}
              className="flex items-center gap-3 px-3 py-2 rounded-apple-sm transition-colors duration-200 ease-apple source-peer-row"
              style={{ textDecoration: 'none' }}
            >
              <LogoImg
                src={`/source-imgs/icons/${peer.sourceId}.png`}
                alt={peer.name}
                size={18}
                radius={4}
              />
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                }}
              >
                {peer.name}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* spacer */}
      <div style={{ flex: 1, minHeight: 16 }} />

      {/* ── Footer pin ── */}
      <div
        style={{
          padding: '10px 16px 14px',
          borderTop: '1px solid var(--apple-line)',
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--apple-text-secondary)',
        }}
      >
        Anti-Cheat · Beta
      </div>

      <style jsx>{`
        :global(.source-peer-row:hover) {
          background: rgba(0, 0, 0, 0.04);
        }
      `}</style>
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
        letterSpacing: '0.04em',
        color: 'var(--apple-text-secondary)',
        textTransform: 'uppercase',
        margin: '4px 0 6px 12px',
      }}
    >
      {label}
    </p>
  )
}

interface NavRowProps {
  href: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  pathname: string
  /** When true, only matches the exact pathname (no prefix match). */
  exact?: boolean
}

function isNavActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href || pathname === `${href}/`
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavRow({ href, label, Icon, pathname, exact = false }: NavRowProps) {
  const active = isNavActive(pathname, href, exact)
  return (
    <Link
      href={href as never}
      aria-current={active ? 'page' : undefined}
      className="flex items-center gap-3 px-3 py-2 rounded-apple-sm transition-colors duration-200 ease-apple"
      style={{
        background: active ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
        color: active ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
        textDecoration: 'none',
      }}
    >
      <Icon className="w-[18px] h-[18px]" />
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 14,
          letterSpacing: 'var(--apple-track-tight)',
          fontWeight: active ? 600 : 500,
        }}
      >
        {label}
      </span>
    </Link>
  )
}
