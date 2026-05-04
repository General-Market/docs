'use client'

import { useEffect, useRef } from 'react'
import { Link, usePathname } from '@/i18n/routing'
import { useAccount } from 'wagmi'
import { useWeb3Available } from '@/lib/contexts/Web3Context'
import {
  HomeIcon,
  BoxesIcon,
  CompassIcon,
  BotIcon,
  UserIcon,
  TrophyIcon,
} from './apple-icons'

type NavItem = {
  id: string
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const PRIMARY: NavItem[] = [
  { id: 'home', href: '/', label: 'Home', icon: HomeIcon },
  { id: 'index-funds', href: '/index', label: 'Index Funds', icon: BoxesIcon },
]

const SECONDARY: NavItem[] = [
  { id: 'explorer', href: '/explorer', label: 'Explorer', icon: CompassIcon },
  { id: 'leaderboard', href: '/leaderboard', label: 'Leaderboard', icon: TrophyIcon },
  { id: 'build-bot', href: '/build-bot', label: 'Build a Bot', icon: BotIcon },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

function Row({
  href,
  label,
  Icon,
  active,
  onClose,
}: {
  href: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  active: boolean
  onClose: () => void
}) {
  return (
    <Link
      href={href as never}
      onClick={onClose}
      className="flex items-center gap-3 px-3 py-2 rounded-apple-sm transition-colors duration-200 ease-apple"
      style={{
        background: active ? 'rgba(0,0,0,0.05)' : 'transparent',
        color: active ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
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

type Props = {
  open: boolean
  onClose: () => void
}

export function MobileDrawer({ open, onClose }: Props) {
  const pathname = usePathname()
  const hasWeb3 = useWeb3Available()
  const { address } = useAccount()
  const panelRef = useRef<HTMLDivElement>(null)

  const portfolioHref = address ? `/profile/${address}` : '/profile'
  const portfolioActive = pathname.startsWith('/profile')

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="md:hidden fixed inset-0 z-[200] flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(2px)' }}
        aria-hidden
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="relative flex flex-col gap-1 overflow-y-auto px-3 py-3"
        style={{
          width: 280,
          background: 'var(--apple-panel)',
          borderRight: '1px solid var(--apple-line)',
          height: '100%',
        }}
      >
        {/* Close button */}
        <div className="flex items-center justify-between px-1 pb-2 mb-1">
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'var(--apple-text-tertiary)',
              textTransform: 'uppercase',
            }}
          >
            Menu
          </span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-full"
            style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--apple-text-secondary)' }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M2.4 2.4a1 1 0 011.4 0L8 6.6l4.2-4.2a1 1 0 111.4 1.4L9.4 8l4.2 4.2a1 1 0 01-1.4 1.4L8 9.4l-4.2 4.2a1 1 0 01-1.4-1.4L6.6 8 2.4 3.8a1 1 0 010-1.4z" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-0.5">
          {PRIMARY.map((it) => (
            <Row
              key={it.id}
              href={it.href}
              label={it.label}
              Icon={it.icon}
              active={isActive(pathname, it.href)}
              onClose={onClose}
            />
          ))}
          {hasWeb3 && (
            <Row
              href={portfolioHref}
              label="Portfolio"
              Icon={UserIcon}
              active={portfolioActive}
              onClose={onClose}
            />
          )}
        </div>

        <div
          className="my-2 border-t"
          style={{ borderColor: 'var(--apple-line)' }}
        />

        <div className="flex flex-col gap-0.5">
          {SECONDARY.map((it) => (
            <Row
              key={it.id}
              href={it.href}
              label={it.label}
              Icon={it.icon}
              active={isActive(pathname, it.href)}
              onClose={onClose}
            />
          ))}
        </div>

        <div className="flex-1" />

        <div
          className="px-3 py-2 text-[11px]"
          style={{
            color: 'var(--apple-text-tertiary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Anti-Cheat · Beta
        </div>
      </div>
    </div>
  )
}
