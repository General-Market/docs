'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useWeb3Available } from '@/lib/contexts/Web3Context'
import { HomeIcon, UserIcon } from './apple-icons'

const SECTION_IDS = ['markets', 'portfolio', 'create', 'lend', 'backtest', 'system'] as const
type SectionId = (typeof SECTION_IDS)[number]

const SECTIONS: Array<{ id: SectionId; labelKey: string }> = [
  { id: 'markets', labelKey: 'home.nav_markets' },
  { id: 'portfolio', labelKey: 'home.nav_portfolio' },
  { id: 'create', labelKey: 'home.nav_create_index' },
  { id: 'lend', labelKey: 'home.nav_lending' },
  { id: 'backtest', labelKey: 'home.nav_backtesting' },
  { id: 'system', labelKey: 'home.nav_system' },
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
  const { address } = useAccount()
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
        {hasWeb3 && (
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
        {SECTIONS.slice(0, 3).map((s) => (
          <SectionButton
            key={s.id}
            label={t(s.labelKey)}
            active={active === s.id}
            onClick={() => handleSectionClick(s.id)}
          />
        ))}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <GroupHeader label={t('home.nav_group_tools')} />
        {SECTIONS.slice(3, 5).map((s) => (
          <SectionButton
            key={s.id}
            label={t(s.labelKey)}
            active={active === s.id}
            onClick={() => handleSectionClick(s.id)}
          />
        ))}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <GroupHeader label={t('home.nav_group_monitoring')} />
        {SECTIONS.slice(5, 6).map((s) => (
          <SectionButton
            key={s.id}
            label={t(s.labelKey)}
            active={active === s.id}
            onClick={() => handleSectionClick(s.id)}
          />
        ))}
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
          color: 'var(--apple-text-tertiary)',
          textTransform: 'uppercase',
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
        color: 'var(--apple-text-tertiary)',
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
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'block',
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
      {label}
    </button>
  )
}
