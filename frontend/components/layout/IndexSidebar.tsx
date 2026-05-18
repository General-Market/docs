'use client'

import { useEffect, useState, useCallback, type SVGProps } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useWeb3Available } from '@/lib/contexts/Web3Context'
import { HomeIcon, UserIcon } from './apple-icons'
import { Watchlist } from './Watchlist'

const SECTION_IDS = ['markets', 'portfolio', 'create', 'lend', 'backtest', 'system'] as const
type SectionId = (typeof SECTION_IDS)[number]

const SECTIONS: Array<{ id: SectionId; labelKey: string; Icon: React.ComponentType<SVGProps<SVGSVGElement>> }> = [
  { id: 'markets', labelKey: 'home.nav_markets', Icon: MarketsIcon },
  { id: 'portfolio', labelKey: 'home.nav_portfolio', Icon: PortfolioIcon },
  { id: 'create', labelKey: 'home.nav_create_index', Icon: CreateIcon },
  { id: 'lend', labelKey: 'home.nav_lending', Icon: LendIcon },
  { id: 'backtest', labelKey: 'home.nav_backtesting', Icon: BacktestIcon },
  { id: 'system', labelKey: 'home.nav_system', Icon: SystemIcon },
]

function readHash(): SectionId {
  if (typeof window === 'undefined') return 'markets'
  const raw = window.location.hash.slice(1) as SectionId
  return SECTION_IDS.includes(raw) ? raw : 'markets'
}

/**
 * Apple-styled sidebar contextual to /index. Replaces the global LeftRail on
 * that route. Two-way bound to window.location.hash so HomeClient can mirror.
 */
export function IndexSidebar() {
  const t = useTranslations('pages')
  const router = useRouter()
  const pathname = usePathname()
  const hasWeb3 = useWeb3Available()
  const { address, isConnected } = useAccount()
  const [active, setActive] = useState<SectionId>('markets')

  useEffect(() => {
    setActive(readHash())
    const onHash = () => setActive(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const handleSectionClick = useCallback(
    (id: SectionId) => {
      if (id === 'system') {
        router.push('/explorer')
        return
      }
      if (id === active) return
      // replaceState + manual hashchange avoids the implicit anchor-scroll the
      // browser would do if we assigned window.location.hash directly.
      history.replaceState(null, '', `#${id}`)
      window.dispatchEvent(new Event('hashchange'))
      setActive(id)
      window.scrollTo({ top: 0 })
    },
    [active, router],
  )

  const portfolioHref = address ? `/profile/${address}` : '/profile'
  const portfolioActive = pathname.startsWith('/profile')
  // Profile is personal — hide it from the rail until a wallet is actually
  // connected. The link without an address routes to a stub page.
  const showProfile = hasWeb3 && isConnected && !!address

  const sectionRow = (s: (typeof SECTIONS)[number]) => (
    <SectionButton
      key={s.id}
      label={t(s.labelKey)}
      active={active === s.id}
      onClick={() => handleSectionClick(s.id)}
      icon={<s.Icon width={18} height={18} />}
    />
  )

  return (
    <aside
      aria-label="Index navigation"
      style={{
        width: 'var(--apple-shell-left)',
        borderRight: '1px solid var(--apple-line)',
        background: 'var(--apple-panel)',
        flexShrink: 0,
      }}
      className="hidden md:flex flex-col row-start-2 col-start-1 overflow-y-auto"
    >
      <div style={{ padding: '20px 16px 0' }}>
        <NavLink
          href="/"
          label="Home"
          active={pathname === '/'}
          icon={<HomeIcon className="w-[18px] h-[18px]" />}
        />
        {showProfile && (
          <NavLink
            href={portfolioHref}
            label="Profile"
            active={portfolioActive}
            icon={<UserIcon className="w-[18px] h-[18px]" />}
          />
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <GroupHeader label={t('home.nav_group_core')} />
        {SECTIONS.slice(0, 3).map(sectionRow)}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <GroupHeader label={t('home.nav_group_tools')} />
        {SECTIONS.slice(3, 5).map(sectionRow)}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <GroupHeader label={t('home.nav_group_monitoring')} />
        {SECTIONS.slice(5, 6).map(sectionRow)}
      </div>

      <div style={{ padding: '0 16px' }}>
        <Watchlist />
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--apple-line)',
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          color: 'var(--apple-text-secondary)',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        Anti-Cheat · Beta
      </div>
    </aside>
  )
}

function GroupHeader({ label }: { label: string }) {
  return (
    <p
      style={{
        fontFamily: 'var(--apple-font-text)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 'var(--apple-track-loose)',
        color: 'var(--apple-text-secondary)',
        textTransform: 'uppercase',
        margin: '0 0 4px 8px',
      }}
    >
      {label}
    </p>
  )
}

function NavLink({
  href,
  label,
  active,
  icon,
}: {
  href: string
  label: string
  active: boolean
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href as never}
      aria-current={active ? 'page' : undefined}
      className="flex items-center gap-3 px-2 py-2 rounded-[8px] transition-colors duration-200"
      style={{
        background: active ? 'rgba(0,0,0,0.05)' : 'transparent',
        color: active ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 'var(--apple-fs-14)',
        letterSpacing: 'var(--apple-track-tight)',
        fontWeight: active ? 600 : 500,
        textDecoration: 'none',
        transitionTimingFunction: 'var(--apple-ease-default)',
      }}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}

function SectionButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '6px 8px',
        borderRadius: 8,
        background: active ? 'rgba(0,0,0,0.05)' : 'transparent',
        color: active ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 'var(--apple-fs-14)',
        letterSpacing: 'var(--apple-track-tight)',
        fontWeight: active ? 600 : 400,
        transition: 'background 200ms var(--apple-ease-default), color 200ms var(--apple-ease-default)',
        cursor: 'pointer',
        border: 'none',
      }}
    >
      <span style={{ flexShrink: 0, display: 'inline-flex' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// ── Section icons — 18px monoline, currentColor ──────────────────────────────

const iconBase = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
}

function MarketsIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase} {...p}>
      <path d="M4 18V12" />
      <path d="M9 18V6" />
      <path d="M14 18v-8" />
      <path d="M19 18V4" />
    </svg>
  )
}

function PortfolioIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase} {...p}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function CreateIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase} {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  )
}

function LendIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase} {...p}>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M7 9V6a5 5 0 0 1 10 0v3" />
      <circle cx="12" cy="15" r="1.5" />
    </svg>
  )
}

function BacktestIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase} {...p}>
      <path d="M3 4v5h5" />
      <path d="M3.5 9A8.5 8.5 0 1 1 4 14" />
    </svg>
  )
}

function SystemIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase} {...p}>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
      <circle cx="15" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
