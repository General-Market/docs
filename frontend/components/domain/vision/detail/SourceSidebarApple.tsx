'use client'

import { useMemo } from 'react'
import { Link } from '@/i18n/routing'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { getCategoryLabel } from '@/lib/vision/source-categories'

const SIDEBAR_EXCLUDED = new Set(['chaturbate', 'fourchan'])

interface SourceSidebarAppleProps {
  sourceId: string
  category: string
}

interface PeerSource {
  sourceId: string
  name: string
  logo: string
  category: string
}

export function SourceSidebarApple({ sourceId, category }: SourceSidebarAppleProps) {
  const { sources, isLoading } = useSourceRegistry()

  const currentSource = findSource(sources, sourceId)

  // Category peers: up to 6 sources in the same category, excluding self
  const peers = useMemo<PeerSource[]>(() => {
    if (!sources.length) return []
    return sources
      .filter(s => s.sourceId !== sourceId && s.category === category && !SIDEBAR_EXCLUDED.has(s.sourceId))
      .slice(0, 6)
  }, [sources, sourceId, category])

  const categoryLabel = currentSource ? getCategoryLabel(currentSource.category) : getCategoryLabel(category)

  return (
    <aside
      aria-label="Source navigation"
      style={{
        width: 'var(--apple-shell-left)',
        borderRight: '1px solid var(--apple-line)',
        background: 'var(--apple-panel)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        flexShrink: 0,
        // hidden below lg — the mobile sidebar handles narrow viewports
      }}
      className="hidden lg:flex"
    >
      {/* ── Source identity ── */}
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid var(--apple-line)',
        }}
      >
        <Link
          href={`/source/${sourceId}` as never}
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
                fontSize: 12,
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

      {/* ── "for you" group — wallet-aware data (bets / vaults / bots) ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <GroupHeader label="for you" />
        <NavItem href={`/source/${sourceId}` as never} label="overview" />
        <NavItem href={`/source/${sourceId}/vault` as never} label="vaults" />
        <NavItem href={`/source/${sourceId}/bots` as never} label="bots" />
      </div>

      {/* ── "build" group ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <GroupHeader label="build" />
        <NavItem href={`/source/${sourceId}/bots` as never} label="run a bot" />
        <NavItem href={`/source/${sourceId}/vault` as never} label="deploy a vault" />
      </div>

      {/* ── Peer sources in the same category ── */}
      {peers.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          <GroupHeader label="more sources" />
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
              className="sidebar-peer-link"
            >
              <img
                src={`/source-imgs/icons/${peer.sourceId}.png`}
                alt={peer.name}
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
          href={"/vision" as never}
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-12)',
            letterSpacing: 'var(--apple-track-loose)',
            color: 'var(--apple-text-secondary)',
            textDecoration: 'none',
          }}
        >
          all sources →
        </Link>
      </div>

      <style>{`
        .sidebar-peer-link:hover {
          background: var(--apple-surface);
        }
        .sidebar-peer-link:hover span {
          color: var(--apple-text);
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

function NavItem({ href, label }: { href: never; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '6px 8px',
        borderRadius: 8,
        textDecoration: 'none',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 'var(--apple-fs-14)',
        letterSpacing: 'var(--apple-track-tight)',
        color: 'var(--apple-text-secondary)',
        transition: 'background 200ms var(--apple-ease-default), color 200ms var(--apple-ease-default)',
      }}
      className="sidebar-nav-item"
    >
      {label}
    </Link>
  )
}
