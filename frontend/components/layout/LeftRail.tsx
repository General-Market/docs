'use client'

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
import { Watchlist } from './Watchlist'

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
}: {
  href: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  active: boolean
}) {
  return (
    <Link
      href={href as never}
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

function PortfolioRow({ active }: { active: boolean }) {
  const { address, isConnected } = useAccount()
  if (!isConnected || !address) return null
  return <Row href={`/profile/${address}`} label="Portfolio" Icon={UserIcon} active={active} />
}

export function LeftRail() {
  const pathname = usePathname()
  const hasWeb3 = useWeb3Available()

  const portfolioActive = pathname.startsWith('/profile')

  return (
    <aside
      className="hidden md:flex flex-col gap-1 row-start-2 col-start-1 border-r overflow-y-auto px-3 py-3"
      style={{
        background: 'var(--apple-panel)',
        borderColor: 'var(--apple-line)',
      }}
      aria-label="Primary"
    >
      <div className="flex flex-col gap-0.5">
        {PRIMARY.map((it) => (
          <Row
            key={it.id}
            href={it.href}
            label={it.label}
            Icon={it.icon}
            active={isActive(pathname, it.href)}
          />
        ))}
        {hasWeb3 && <PortfolioRow active={portfolioActive} />}
      </div>

      <div className="mt-1 flex flex-col gap-0.5">
        {SECONDARY.map((it) => (
          <Row
            key={it.id}
            href={it.href}
            label={it.label}
            Icon={it.icon}
            active={isActive(pathname, it.href)}
          />
        ))}
      </div>

      <Watchlist />

      <div className="flex-1" />

      <div
        className="px-3 py-2 text-[11px] whitespace-nowrap"
        style={{
          color: 'var(--apple-text-secondary)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Anti-Cheat · Beta
      </div>
    </aside>
  )
}
