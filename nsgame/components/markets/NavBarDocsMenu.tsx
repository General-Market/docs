'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from '@/i18n/routing'

// Hover mega-menu for the desktop NavBar. The same surface as the
// mobile More sheet — folded down from the top of the page instead of
// rising up from the bottom. The user wanted the docs reachable
// without a scroll. This is the absence of a scroll.

interface MenuLink {
  href: string
  label: string
}

interface MenuSection {
  title: string
  links: MenuLink[]
}

const SECTIONS: MenuSection[] = [
  {
    title: 'Product',
    links: [
      { href: '/product/how-it-works', label: 'How It Works' },
      { href: '/product/market-rules', label: 'Markets' },
      { href: '/product/round-mechanics', label: 'Round Mechanics' },
      { href: '/product/fee-schedule', label: 'Fee Schedule' },
      { href: '/product/refund-policy', label: 'Refund' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { href: '/trust/decentralization-and-dao', label: 'DAO' },
      { href: '/trust/goldilock-oracle-network', label: 'Goldilock' },
      { href: '/trust/data-source-methodology', label: 'Data Sources' },
      { href: '/trust/audit-and-mainnet-roadmap', label: 'Audit Roadmap' },
      { href: '/trust/subject-removal-policy', label: 'Subject Removal' },
      { href: '/trust/listing-posture', label: 'Listing Posture' },
      { href: '/trust/token-status', label: 'Token Status' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/help', label: 'Help Center' },
      { href: '/help/faq', label: 'FAQ' },
      { href: '/help/glossary', label: 'Glossary' },
      { href: '/help/wallet-setup', label: 'Wallet Setup' },
      { href: '/help/contact', label: 'Contact' },
      { href: '/brand/brand-kit', label: 'Brand Kit' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/terms-of-use', label: 'Terms' },
      { href: '/legal/privacy-policy', label: 'Privacy' },
      { href: '/legal/cookie-policy', label: 'Cookie Policy' },
      { href: '/legal/disclaimer', label: 'Disclaimer' },
      { href: '/legal/risk-disclosure', label: 'Risk Disclosure' },
      { href: '/legal/restricted-territories', label: 'Restricted Territories' },
      { href: '/legal/dmca-policy', label: 'DMCA' },
      { href: '/legal/age-gate', label: 'Age Verification' },
    ],
  },
]

const CLOSE_DELAY_MS = 140

export function NavBarDocsMenu() {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }

  useEffect(() => () => cancelClose(), [])

  // Close on Escape, like every menu that respects its visitors.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div
      className="relative hidden sm:inline-flex"
      onMouseEnter={() => {
        cancelClose()
        setOpen(true)
      }}
      onMouseLeave={scheduleClose}
    >
      <Link
        href="/help"
        onClick={() => setOpen(false)}
        onFocus={() => {
          cancelClose()
          setOpen(true)
        }}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex h-9 items-center rounded-md border border-zinc-800 px-3 text-caption font-medium tracking-tight text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100"
      >
        Docs
        <svg
          aria-hidden
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`ml-1.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M2 3.5l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            role="menu"
            aria-label="Documentation"
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[640px] max-w-[calc(100vw-2rem)] origin-top-right rounded-md border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl shadow-black/60"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <div className="px-5 pt-4 pb-3 border-b border-zinc-900">
              <span className="font-mono text-label uppercase tracking-[0.18em] text-zinc-500">
                More
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-5">
              {SECTIONS.map(section => (
                <div key={section.title}>
                  <span className="block font-mono text-label font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2.5">
                    {section.title}
                  </span>
                  <ul className="space-y-1">
                    {section.links.map(link => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={() => setOpen(false)}
                          role="menuitem"
                          className="block py-1 text-body text-zinc-300 transition-colors hover:text-zinc-50"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-zinc-900">
              <p className="font-mono text-label leading-relaxed text-zinc-600">
                © 2026 nsgame protocol — DAO in formation
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
