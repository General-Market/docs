'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'

// Slide-up sheet for mobile. The doc surface, organized as four columns
// stacked vertically. The chrome is sparse on purpose — the links are the
// content, not the frame.

interface SheetLink {
  href: string
  label: string
}

interface SheetSection {
  titleKey: string
  links: SheetLink[]
}

const SECTIONS: SheetSection[] = [
  {
    titleKey: 'footer.product',
    links: [
      { href: '/product/how-it-works', label: 'How It Works' },
      { href: '/product/market-rules', label: 'Markets' },
      { href: '/product/round-mechanics', label: 'Round Mechanics' },
      { href: '/product/fee-schedule', label: 'Fee Schedule' },
      { href: '/product/refund-policy', label: 'Refund' },
      { href: '/trust/market-integrity', label: 'Market Integrity' },
    ],
  },
  {
    titleKey: 'footer.trust',
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
    titleKey: 'footer.resources',
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
    titleKey: 'footer.legal',
    links: [
      { href: '/legal/terms-of-use', label: 'Terms' },
      { href: '/legal/privacy-policy', label: 'Privacy' },
      { href: '/legal/cookie-policy', label: 'Cookie Policy' },
      { href: '/legal/disclaimer', label: 'Disclaimer' },
      { href: '/legal/acceptable-use-policy', label: 'Acceptable Use' },
      { href: '/legal/risk-disclosure', label: 'Risk Disclosure' },
      { href: '/legal/restricted-territories', label: 'Restricted Territories' },
      { href: '/legal/dmca-policy', label: 'DMCA' },
      { href: '/legal/age-gate', label: 'Age Verification' },
    ],
  },
]

interface BottomNavMoreSheetProps {
  open: boolean
  onClose: () => void
}

export function BottomNavMoreSheet({ open, onClose }: BottomNavMoreSheetProps) {
  const t = useTranslations('common')

  // Lock body scroll while the sheet is open. Restore on close.
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  // Close on Escape, like every well-mannered modal should.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            aria-hidden
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t('more.title')}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
            transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.9 }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-zinc-800 bg-zinc-950 text-zinc-100 lg:hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <span aria-hidden className="h-1 w-10 rounded-full bg-zinc-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-zinc-900">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                {t('more.title')}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('aria.close')}
                className="-mr-1 inline-flex h-11 w-11 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0)+1.25rem)] pt-4">
              <div className="space-y-7">
                {SECTIONS.map(section => (
                  <div key={section.titleKey}>
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2.5">
                      {t(section.titleKey)}
                    </span>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {section.links.map(link => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={onClose}
                            className="block py-1.5 text-[14px] text-zinc-300 hover:text-zinc-50 transition-colors"
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <p className="pt-4 text-[11px] leading-relaxed text-zinc-600">
                  © 2026 nsgame protocol — DAO in formation
                </p>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
