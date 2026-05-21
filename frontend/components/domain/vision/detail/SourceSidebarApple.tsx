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
        width: 56,
        borderRight: '1px solid var(--apple-line)',
        background: 'var(--apple-panel)',
        flexShrink: 0,
      }}
      className="hidden md:flex flex-col overflow-y-auto items-center"
    >
      {/* ── Back to home ── */}
      <Link
        href={'/' as never}
        title={t('back_to_home')}
        aria-label={t('back_to_home')}
        className="flex items-center justify-center rounded-apple-sm transition-colors duration-200 ease-apple"
        style={{
          width: 36,
          height: 36,
          marginTop: 12,
          color: 'var(--apple-text-secondary)',
          textDecoration: 'none',
        }}
      >
        <ArrowLeftIcon className="w-[16px] h-[16px]" />
      </Link>

      {/* ── Source identity (logo only) ── */}
      <Link
        href={overviewHref as never}
        title={currentSource?.name ?? sourceId}
        aria-label={currentSource?.name ?? sourceId}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          width: 36,
          height: 36,
          marginTop: 8,
          marginBottom: 8,
        }}
      >
        <LogoImg
          src={currentSource?.logo ? `/source-imgs/icons/${currentSource.sourceId}.png` : undefined}
          alt={currentSource?.name ?? ''}
          size={28}
          radius={6}
        />
      </Link>

      <Divider />

      {/* ── Source nav (icons) ── */}
      <div className="flex flex-col items-center gap-1" style={{ paddingTop: 8 }}>
        <NavIcon href={overviewHref} label={t('nav_overview')} Icon={HomeIcon} pathname={pathname} exact />
        <NavIcon href={marketsHref} label={t('nav_markets')} Icon={BoxesIcon} pathname={pathname} />
        <NavIcon href={activityHref} label={t('nav_activity')} Icon={PulseIcon} pathname={pathname} />
        <NavIcon href={leaderboardHref} label={t('nav_leaderboard')} Icon={TrophyIcon} pathname={pathname} />
      </div>

      <Divider />

      {/* ── Build ── */}
      <div className="flex flex-col items-center gap-1" style={{ paddingTop: 8 }}>
        <NavIcon href="/build-bot" label={t('nav_run_a_bot')} Icon={BotIcon} pathname={pathname} />
      </div>

      {/* ── Category peers (logos only) ── */}
      {peers.length > 0 && (
        <>
          <Divider />
          <div className="flex flex-col items-center gap-1" style={{ paddingTop: 8 }}>
            {peers.map(peer => (
              <Link
                key={peer.sourceId}
                href={`/source/${peer.sourceId}` as never}
                title={peer.name}
                aria-label={peer.name}
                className="flex items-center justify-center rounded-apple-sm transition-colors duration-200 ease-apple source-peer-row"
                style={{
                  width: 36,
                  height: 36,
                  textDecoration: 'none',
                }}
              >
                <LogoImg
                  src={`/source-imgs/icons/${peer.sourceId}.png`}
                  alt={peer.name}
                  size={20}
                  radius={5}
                />
              </Link>
            ))}
          </div>
        </>
      )}

      {/* spacer */}
      <div style={{ flex: 1, minHeight: 16 }} />

      <style jsx>{`
        :global(.source-peer-row:hover) {
          background: rgba(0, 0, 0, 0.04);
        }
      `}</style>
    </aside>
  )
}

function Divider() {
  return (
    <div
      style={{
        width: 24,
        height: 1,
        background: 'var(--apple-line)',
        marginTop: 8,
      }}
    />
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface NavIconProps {
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

function NavIcon({ href, label, Icon, pathname, exact = false }: NavIconProps) {
  const active = isNavActive(pathname, href, exact)
  return (
    <Link
      href={href as never}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="flex items-center justify-center rounded-apple-sm transition-colors duration-200 ease-apple"
      style={{
        width: 36,
        height: 36,
        background: active ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
        color: active ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
        textDecoration: 'none',
      }}
    >
      <Icon className="w-[18px] h-[18px]" />
    </Link>
  )
}
