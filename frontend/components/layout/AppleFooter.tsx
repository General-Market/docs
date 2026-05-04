import { Link } from '@/i18n/routing'

type Col = {
  heading: string
  links: { label: string; href: string; external?: boolean }[]
}

const COLUMNS: Col[] = [
  {
    heading: 'Trade',
    links: [
      { label: 'Markets', href: '/' },
      { label: 'Index Funds', href: '/index' },
      { label: 'Explorer', href: '/explorer' },
      { label: 'Leaderboard', href: '/leaderboard' },
      { label: 'Build a Bot', href: '/build-bot' },
    ],
  },
  {
    heading: 'Sources',
    links: [
      { label: 'Polymarket', href: '/source/polymarket' },
      { label: 'Pumpfun', href: '/source/pumpfun' },
      { label: 'DefiLlama', href: '/source/defillama' },
      { label: 'NYSE', href: '/source/equities' },
      { label: 'ESPN', href: '/source/espn' },
    ],
  },
  {
    heading: 'Anti-Cheat',
    links: [
      { label: 'How it works', href: '/learn/anti-cheat' },
      { label: 'Oracle consensus', href: '/learn/oracles' },
      { label: 'Sealed bets', href: '/learn/sealed-bets' },
      { label: 'Parimutuel', href: '/learn/parimutuel' },
    ],
  },
  {
    heading: 'Build',
    links: [
      { label: 'Docs', href: 'https://docs.generalmarket.io', external: true },
      { label: 'Bots', href: '/build-bot' },
      { label: 'API', href: 'https://docs.generalmarket.io/api', external: true },
      { label: 'GitHub', href: 'https://github.com/General-Market', external: true },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Legal', href: '/legal-index' },
      { label: 'Contact', href: 'mailto:hello@generalmarket.io', external: true },
    ],
  },
]

const BOTTOM_LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Use', href: '/terms' },
  { label: 'Sales and Refunds', href: '/sales-refunds' },
  { label: 'Legal', href: '/legal-index' },
  { label: 'Site Map', href: '/sitemap' },
]

const linkBase: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 14,
  lineHeight: 1.4286,
  color: 'var(--apple-text-secondary)',
  letterSpacing: 'var(--apple-track-loose)',
  textDecoration: 'none',
}

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 12,
  lineHeight: 1.3333,
  letterSpacing: 'var(--apple-track-loose)',
  fontWeight: 600,
  color: 'var(--apple-text)',
  margin: 0,
  marginBottom: 12,
}

const tertiary: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 12,
  lineHeight: 1.4,
  letterSpacing: 'var(--apple-track-loose)',
  color: 'var(--apple-text-tertiary)',
}

function FooterLink({
  label,
  href,
  external,
}: {
  label: string
  href: string
  external?: boolean
}) {
  if (external) {
    const isMail = href.startsWith('mailto:')
    return (
      <a
        href={href}
        {...(!isMail && { target: '_blank', rel: 'noopener noreferrer' })}
        style={linkBase}
        className="apple-footer-link"
      >
        {label}
      </a>
    )
  }
  return (
    <Link href={href as never} style={linkBase} className="apple-footer-link">
      {label}
    </Link>
  )
}

export function AppleFooter() {
  return (
    <footer
      aria-label="Footer"
      style={{
        background: 'var(--apple-page-bg)',
        borderTop: '1px solid var(--apple-line)',
        marginTop: 48,
      }}
    >
      <style>{`
        .apple-footer-link { transition: color 200ms var(--apple-ease-default); }
        .apple-footer-link:hover { color: var(--apple-text); }
        .apple-footer-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 28px 24px;
        }
        @media (min-width: 768px) {
          .apple-footer-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
          .apple-footer-grid { grid-template-columns: repeat(5, 1fr); }
        }
        .apple-footer-bottom {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: flex-start;
          justify-content: space-between;
        }
        @media (min-width: 768px) {
          .apple-footer-bottom { flex-direction: row; align-items: center; }
        }
        .apple-footer-bottom-links {
          display: flex;
          flex-wrap: wrap;
          gap: 0 8px;
          align-items: center;
        }
      `}</style>

      <div
        style={{
          maxWidth: 'var(--apple-content-wide)',
          margin: '0 auto',
          padding: '40px 24px 0',
        }}
      >
        <div className="apple-footer-grid">
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h3 style={headingStyle}>{col.heading}</h3>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {col.links.map((l) => (
                  <li key={l.label}>
                    <FooterLink label={l.label} href={l.href} external={l.external} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div
          style={{
            borderTop: '1px solid var(--apple-line)',
            margin: '28px 0 0',
          }}
        />
      </div>

      <div
        style={{
          maxWidth: 'var(--apple-content-wide)',
          margin: '0 auto',
          padding: '16px 24px 28px',
        }}
      >
        <div className="apple-footer-bottom">
          <span style={tertiary}>
            Copyright &copy; 2026 General Market. All rights reserved.
          </span>
          <div className="apple-footer-bottom-links">
            {BOTTOM_LINKS.map((l, i) => (
              <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {i > 0 && <span style={{ ...tertiary }}>&middot;</span>}
                <FooterLink label={l.label} href={l.href} external={l.external} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
