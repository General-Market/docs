'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { useAccount } from 'wagmi'
import { useWeb3Available } from '@/lib/contexts/Web3Context'
import {
  HomeIcon,
  LayersIcon,
  BoxesIcon,
  VaultIcon,
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

const NAV: NavItem[] = [
  { id: 'home', href: '/', label: 'Home', icon: HomeIcon },
  { id: 'sources', href: '/sources', label: 'Sources', icon: LayersIcon },
  { id: 'itps', href: '/index', label: 'ITPs', icon: BoxesIcon },
  { id: 'vaults', href: '/vaults', label: 'Vaults', icon: VaultIcon },
  { id: 'explorer', href: '/explorer', label: 'Explorer', icon: CompassIcon },
  { id: 'leaderboard', href: '/leaderboard', label: 'Leaderboard', icon: TrophyIcon },
  { id: 'build-bot', href: '/build-bot', label: 'Build a Bot', icon: BotIcon },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export function LeftRail() {
  const pathname = usePathname()
  const hasWeb3 = useWeb3Available()
  const { address } = useAccount()

  const profileHref = address ? `/profile/${address}` : null

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 border-r"
      style={{
        width: 'var(--apple-shell-left)',
        background: 'var(--apple-bg)',
        borderColor: 'var(--apple-border)',
      }}
      aria-label="Primary"
    >
      <Link
        href="/"
        className="h-14 flex items-center gap-2 px-5 border-b"
        style={{ borderColor: 'var(--apple-border)' }}
      >
        <span
          className="font-semibold"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'var(--apple-fs-19)',
            letterSpacing: 'var(--apple-track-tighter)',
            color: 'var(--apple-text)',
          }}
        >
          General Market
        </span>
      </Link>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-apple-sm transition-colors duration-200 ease-apple"
              style={{
                background: active ? 'var(--apple-surface)' : 'transparent',
                color: active ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
              }}
            >
              <Icon className="w-4 h-4" />
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 'var(--apple-fs-14)',
                  letterSpacing: 'var(--apple-track-tight)',
                  fontWeight: active ? 600 : 500,
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}

        {hasWeb3 && profileHref && (
          <Link
            href={profileHref as never}
            className="flex items-center gap-3 px-3 py-2 rounded-apple-sm transition-colors duration-200 ease-apple mt-1"
            style={{
              color: pathname.startsWith('/profile/')
                ? 'var(--apple-text)'
                : 'var(--apple-text-secondary)',
              background: pathname.startsWith('/profile/')
                ? 'var(--apple-surface)'
                : 'transparent',
            }}
          >
            <UserIcon className="w-4 h-4" />
            <span
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-14)',
                letterSpacing: 'var(--apple-track-tight)',
                fontWeight: 500,
              }}
            >
              Profile
            </span>
          </Link>
        )}
      </nav>

      <div
        className="px-5 py-3 border-t text-[11px]"
        style={{
          borderColor: 'var(--apple-border)',
          color: 'var(--apple-text-tertiary)',
          letterSpacing: 'var(--apple-track-loose)',
        }}
      >
        Anti-Cheat · Testnet v0.93
      </div>
    </aside>
  )
}
