'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { ReactNode, useState, useEffect } from 'react'
import { Link } from '@/i18n/routing'
import { MobileDrawer } from './MobileDrawer'

const WalletControls = dynamic(
  () => import('./WalletControls').then((m) => ({ default: m.WalletControls })),
  {
    ssr: false,
    loading: () => (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-apple-pill border text-[12px]"
        style={{
          borderColor: 'var(--apple-line)',
          color: 'var(--apple-text-tertiary)',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--apple-text-tertiary)' }}
        />
        ...
      </span>
    ),
  },
)

type TopBarProps = {
  search?: ReactNode
}

export function TopBar({ search }: TopBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  return (
    <>
      <header
        className="relative col-span-1 md:col-span-2 flex items-center gap-2 md:gap-3 border-b py-3 px-4 md:pl-0 md:pr-4"
        style={{
          background: 'var(--apple-panel)',
          borderColor: 'var(--apple-line)',
        }}
      >
        {/* Logo region — content-width on mobile, 240px on md+ to align with the sidebar column */}
        <div
          className="shrink-0 flex items-center md:w-[240px] md:px-4"
        >
          {/* Burger — mobile only */}
          <button
            type="button"
            aria-label="menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="md:hidden flex flex-col justify-center gap-[5px] w-8 h-8 mr-1 shrink-0"
          >
            <span
              className="block h-px w-5 rounded-full"
              style={{ background: 'var(--apple-text)' }}
            />
            <span
              className="block h-px w-5 rounded-full"
              style={{ background: 'var(--apple-text)' }}
            />
            <span
              className="block h-px w-5 rounded-full"
              style={{ background: 'var(--apple-text)' }}
            />
          </button>

          <Brand />
        </div>

        {/* Spacer pushes mobile search + wallet to the right edge */}
        <div className="flex-1 md:hidden" />

        {/* Search — hidden on mobile, centered on md+ */}
        <div className="hidden md:flex flex-1 justify-center">
          <div className="w-full max-w-[520px]">{search}</div>
        </div>

        {/* Mobile: compact search icon expanding to input. Sits beside the wallet. */}
        {search && (
          <div className="flex md:hidden items-center justify-end min-w-0">
            <MobileSearch>{search}</MobileSearch>
          </div>
        )}

        <div className="shrink-0">
          <WalletControls isDark={false} />
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}

/**
 * On mobile, wraps the search node behind a magnifying-glass toggle.
 * Tapping the icon swaps the bar for a full-width search input. Apple pattern.
 */
function MobileSearch({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)

  if (!expanded) {
    return (
      <button
        type="button"
        aria-label="Search"
        onClick={() => setExpanded(true)}
        className="flex items-center justify-center w-9 h-9 -mr-1"
        style={{ color: 'var(--apple-text-secondary)' }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
      </button>
    )
  }

  return (
    <div
      className="absolute inset-0 flex items-center gap-2 px-4 z-10"
      style={{ background: 'var(--apple-panel)' }}
    >
      <div className="flex-1 min-w-0">{children}</div>
      <button
        type="button"
        aria-label="Close search"
        onClick={() => setExpanded(false)}
        className="shrink-0 text-[14px] px-1"
        style={{ color: 'var(--apple-text-secondary)' }}
      >
        Cancel
      </button>
    </div>
  )
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image
        src="/logo.svg"
        alt="General"
        width={26}
        height={26}
        style={{ borderRadius: 6 }}
        priority
      />
      <span
        className="hidden sm:inline font-semibold"
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 19,
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text)',
        }}
      >
        General
      </span>
      <span
        className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
        style={{
          fontSize: 10,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          background: '#0071e3',
          color: '#ffffff',
        }}
      >
        <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M6 1L2 3v3.2c0 2.4 1.7 4.4 4 4.8 2.3-.4 4-2.4 4-4.8V3L6 1z"
            fill="currentColor"
          />
          <path
            d="M4.4 6l1.2 1.2L8 4.8"
            stroke="#0071e3"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Anti-Cheat
      </span>
    </Link>
  )
}
