'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'

// Polymarket posture, our doc surface. Four columns plus a thin legal
// strip. The copy is terse on purpose — the footer is not the place to
// argue, it is the place to admit what exists.

interface FooterLink {
  href: string
  label: string
  external?: boolean
}

const PRODUCT_LINKS: FooterLink[] = [
  { href: '/product/how-it-works', label: 'How It Works' },
  { href: '/product/market-rules', label: 'Markets' },
  { href: '/product/round-mechanics', label: 'Round Mechanics' },
  { href: '/product/fee-schedule', label: 'Fee Schedule' },
  { href: '/product/refund-policy', label: 'Refund Policy' },
  { href: '/trust/market-integrity', label: 'Market Integrity' },
]

const TRUST_LINKS: FooterLink[] = [
  { href: '/trust/decentralization-and-dao', label: 'Decentralization & DAO' },
  { href: '/trust/goldilock-oracle-network', label: 'Goldilock' },
  { href: '/trust/data-source-methodology', label: 'Data Sources' },
  { href: '/trust/audit-and-mainnet-roadmap', label: 'Audit Roadmap' },
  { href: '/trust/subject-removal-policy', label: 'Subject Removal' },
  { href: '/trust/token-status', label: 'Token Status' },
]

const RESOURCE_LINKS: FooterLink[] = [
  { href: '/help', label: 'Help Center' },
  { href: '/help/faq', label: 'FAQ' },
  { href: '/help/glossary', label: 'Glossary' },
  { href: '/help/wallet-setup', label: 'Wallet Setup' },
  { href: '/help/contact', label: 'Contact' },
  { href: '/brand/brand-kit', label: 'Brand Kit' },
]

const LEGAL_LINKS: FooterLink[] = [
  { href: '/legal/terms-of-use', label: 'Terms' },
  { href: '/legal/privacy-policy', label: 'Privacy' },
  { href: '/legal/cookie-policy', label: 'Cookie Policy' },
  { href: '/legal/disclaimer', label: 'Disclaimer' },
  { href: '/legal/acceptable-use-policy', label: 'Acceptable Use' },
  { href: '/legal/risk-disclosure', label: 'Risk Disclosure' },
  { href: '/legal/dmca-policy', label: 'DMCA' },
  { href: '/legal/restricted-territories', label: 'Restricted Territories' },
  { href: '/legal/age-gate', label: 'Age Verification' },
]

const CONTACT_EMAIL = '[FACT TBD: contact email]'
const DISCORD_URL = '[FACT TBD: Discord URL]'

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: FooterLink[]
}) {
  return (
    <div>
      <span className="text-zinc-200 font-semibold text-[11px] uppercase tracking-[0.12em] block mb-4">
        {title}
      </span>
      <ul className="space-y-2.5">
        {links.map(link => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-zinc-500 hover:text-zinc-100 transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-[13px] text-zinc-500 hover:text-zinc-100 transition-colors"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Footer() {
  const t = useTranslations('common')

  return (
    <footer className="bg-zinc-950 border-t border-zinc-900 text-zinc-400 pt-14 pb-8 px-6 sm:px-10 lg:px-14">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 sm:gap-8 pb-12 border-b border-zinc-900">
          {/* Col 1 — brand block */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="inline-block">
              <span className="text-zinc-50 font-black text-[18px] tracking-tight">
                nsgame
              </span>
            </Link>
            <p className="mt-3 text-[13px] text-zinc-500 leading-relaxed max-w-[18rem]">
              A DAO-governed parimutuel prediction market on Solana. The
              chain is the disclosure.
            </p>
            <div className="mt-4 space-y-1.5">
              <a
                href={CONTACT_EMAIL.startsWith('[FACT') ? '#' : `mailto:${CONTACT_EMAIL}`}
                className="block text-[12px] text-zinc-500 hover:text-zinc-100 transition-colors font-mono"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
            <div className="flex gap-3 mt-4">
              <a
                href={DISCORD_URL.startsWith('[FACT') ? '#' : DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-zinc-100 transition-colors"
                aria-label={t('aria.discord')}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
              </a>
            </div>
          </div>

          <FooterColumn title={t('footer.product')} links={PRODUCT_LINKS} />
          <FooterColumn title={t('footer.trust')} links={TRUST_LINKS} />
          <FooterColumn title={t('footer.resources')} links={RESOURCE_LINKS} />
        </div>

        {/* Legal strip — all the binding links inline */}
        <div className="pt-8 flex flex-wrap gap-x-5 gap-y-2 items-center">
          <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-600 font-semibold">
            {t('footer.legal')}
          </span>
          {LEGAL_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[12px] text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-zinc-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <span className="text-[11px] text-zinc-600 font-mono">
            © 2026 nsgame protocol — DAO in formation
          </span>
          <p className="text-[11px] text-zinc-600 max-w-2xl leading-relaxed">
            nsgame.org is a website. The protocol is a Solana program. The
            website may delist a market; the protocol cannot. The chain is
            the ledger. Read the{' '}
            <Link href="/legal/disclaimer" className="underline hover:text-zinc-300">
              Disclaimer
            </Link>{' '}
            and the{' '}
            <Link href="/legal/risk-disclosure" className="underline hover:text-zinc-300">
              Risk Disclosure
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  )
}
