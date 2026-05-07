'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'

/**
 * Logo that disappears cleanly when the source is missing or fails to load.
 * Mirrors SourceSidebarApple — no stub squares, only silence.
 */
function LogoFallback({
  letter,
  size,
  radius,
  fontSize,
}: {
  letter: string
  size: number
  radius: number
  fontSize: number
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: 'var(--apple-surface, #f5f5f7)',
        color: 'var(--apple-text)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: 'var(--apple-font-display)',
        fontSize,
        fontWeight: 600,
        letterSpacing: 'var(--apple-track-tight)',
      }}
      aria-hidden
    >
      {letter}
    </span>
  )
}

function LogoImg({
  src,
  alt,
  size,
  radius,
  fallbackLetter,
}: {
  src?: string
  alt: string
  size: number
  radius: number
  fallbackLetter: string
}) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <LogoFallback
        letter={fallbackLetter}
        size={size}
        radius={radius}
        fontSize={Math.round(size * 0.42)}
      />
    )
  }
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
        background: 'var(--apple-surface, #f5f5f7)',
      }}
    />
  )
}

export interface ItpSidebarPeer {
  itpId: string
  name: string
  symbol: string
}

interface ItpSidebarAppleProps {
  itpId: string
  name: string
  symbol: string
  peerItps?: ItpSidebarPeer[]
}

export function ItpSidebarApple({
  itpId,
  name,
  symbol,
  peerItps = [],
}: ItpSidebarAppleProps) {
  const t = useTranslations('markets.itp_sidebar')
  const pathname = usePathname()

  const overviewHref = `/itp/${itpId}`
  const firstLetter = (name?.charAt(0) ?? symbol?.charAt(0) ?? '?').toUpperCase()

  return (
    <aside
      aria-label={t('aria_label')}
      style={{
        width: 'var(--apple-shell-left)',
        borderRight: '1px solid var(--apple-line)',
        background: 'var(--apple-panel)',
        flexShrink: 0,
      }}
      className="hidden md:flex flex-col"
    >
      {/* ── ITP identity ── */}
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
          <LogoImg
            alt={name}
            size={36}
            radius={8}
            fallbackLetter={firstLetter}
          />
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
              {name}
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
              {symbol}
            </p>
          </div>
        </Link>
      </div>

      {/* ── Overview group ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <GroupHeader label={t('group_overview')} />
        <NavItem href={overviewHref} label={t('nav_overview')} pathname={pathname} exact />
      </div>

      {/* ── Discover group ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <GroupHeader label={t('group_discover')} />
        <NavItem href="/index" label={t('nav_all_indexes')} pathname={pathname} />
      </div>

      {/* ── Peer ITPs ── */}
      {peerItps.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          <GroupHeader label={t('group_more_indexes')} />
          {peerItps.map((peer) => {
            const peerLetter = (peer.name?.charAt(0) ?? peer.symbol?.charAt(0) ?? '?').toUpperCase()
            return (
              <Link
                key={peer.itpId}
                href={`/itp/${peer.itpId}` as never}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  transition: 'background 200ms var(--apple-ease-default)',
                }}
                className="itp-sidebar-peer-link"
              >
                <LogoImg
                  alt={peer.name}
                  size={22}
                  radius={5}
                  fallbackLetter={peerLetter}
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
            )
          })}
        </div>
      )}

      {/* flex spacer */}
      <div style={{ flex: 1 }} />

      {/* ── footer link to all indexes ── */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--apple-line)',
        }}
      >
        <Link
          href="/index"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-12)',
            letterSpacing: 'var(--apple-track-loose)',
            color: 'var(--apple-text-secondary)',
            textDecoration: 'none',
          }}
        >
          {t('footer_all_indexes')}
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
      className="itp-sidebar-nav-item"
    >
      {label}
    </Link>
  )
}
