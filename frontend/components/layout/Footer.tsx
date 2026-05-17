'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'

const footerBase: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  background: 'var(--apple-page-bg)',
  borderTop: '1px solid var(--apple-line)',
  color: 'var(--apple-text-secondary)',
}

const linkStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.3333,
  letterSpacing: 'var(--apple-track-loose)',
  color: 'var(--apple-text-secondary)',
  textDecoration: 'none',
}

const headingStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.3333,
  letterSpacing: 'var(--apple-track-loose)',
  fontWeight: 600,
  color: 'var(--apple-text)',
  margin: 0,
  marginBottom: 14,
}

const brandStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.3333,
  letterSpacing: 'var(--apple-track-loose)',
  fontWeight: 600,
  color: 'var(--apple-text)',
}

const blurbStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  lineHeight: 1.5,
  letterSpacing: 'var(--apple-track-loose)',
  color: 'var(--apple-text-secondary)',
}

const tertiary: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.3333,
  letterSpacing: 'var(--apple-track-loose)',
  color: 'var(--apple-text-tertiary)',
}

export function Footer() {
  const t = useTranslations('common')

  return (
    <footer style={footerBase}>
      <style>{`
        .gm-footer-shell {
          max-width: var(--apple-content-wide);
          margin: 0 auto;
          padding: 40px 24px 32px;
        }
        @media (min-width: 768px) {
          .gm-footer-shell { padding: 56px 40px 40px; }
        }
        @media (min-width: 1024px) {
          .gm-footer-shell { padding: 64px 56px 48px; }
        }
        .gm-footer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px 24px;
          padding-bottom: 32px;
          border-bottom: 1px solid var(--apple-line);
        }
        @media (min-width: 768px) {
          .gm-footer-grid {
            grid-template-columns: 1.4fr 1fr 1fr 1fr;
            gap: 40px;
            padding-bottom: 40px;
          }
        }
        .gm-footer-link {
          transition: color 200ms var(--apple-ease-default);
        }
        .gm-footer-link:hover { color: var(--apple-text); }
        .gm-footer-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .gm-footer-bottom {
          display: flex;
          flex-direction: column-reverse;
          gap: 16px;
          padding-top: 24px;
        }
        @media (min-width: 768px) {
          .gm-footer-bottom {
            flex-direction: row;
            justify-content: space-between;
            align-items: flex-start;
          }
        }
        .gm-footer-socials {
          display: inline-flex;
          gap: 14px;
          margin-top: 14px;
        }
        .gm-footer-socials a {
          color: var(--apple-text-secondary);
          transition: color 200ms var(--apple-ease-default);
        }
        .gm-footer-socials a:hover { color: var(--apple-text); }
      `}</style>

      <div className="gm-footer-shell">
        <div className="gm-footer-grid">
          <div>
            <span style={brandStyle}>{t('brand.name')}</span>
            <p style={blurbStyle}>{t('brand.description')}</p>
            <a
              href="mailto:contact@indexmaker.global"
              className="gm-footer-link"
              style={{ ...linkStyle, display: 'inline-block', marginTop: 10 }}
            >
              contact@indexmaker.global
            </a>
            <div className="gm-footer-socials">
              <a
                href="https://discord.gg/xsfgzwR6"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('aria.discord')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
              </a>
              <a
                href="https://x.com/otc_max"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('aria.twitter')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          <nav aria-label={t('footer.product')}>
            <h3 style={headingStyle}>{t('footer.product')}</h3>
            <ul className="gm-footer-list">
              <li><Link href="/index" className="gm-footer-link" style={linkStyle}>{t('footer.indexes')}</Link></li>
              <li><Link href="/" className="gm-footer-link" style={linkStyle}>{t('footer.vision')}</Link></li>
              <li><Link href="/sources" className="gm-footer-link" style={linkStyle}>{t('footer.data_sources')}</Link></li>
            </ul>
          </nav>

          <nav aria-label="Explorers">
            <h3 style={headingStyle}>Explorers</h3>
            <ul className="gm-footer-list">
              <li>
                <a
                  href={process.env.NEXT_PUBLIC_L3_EXPLORER_URL || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gm-footer-link"
                  style={linkStyle}
                >
                  GM Chain
                </a>
              </li>
              <li>
                <a
                  href={process.env.NEXT_PUBLIC_SETTLEMENT_EXPLORER_URL || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gm-footer-link"
                  style={linkStyle}
                >
                  Settlement (Sonic)
                </a>
              </li>
              <li><Link href="/explorer" className="gm-footer-link" style={linkStyle}>Transactions</Link></li>
            </ul>
          </nav>

          <nav aria-label={t('footer.resources')}>
            <h3 style={headingStyle}>{t('footer.resources')}</h3>
            <ul className="gm-footer-list">
              <li><Link href="/docs" className="gm-footer-link" style={linkStyle}>{t('footer.docs')}</Link></li>
              <li>
                <a
                  href="https://discord.gg/xsfgzwR6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gm-footer-link"
                  style={linkStyle}
                >
                  {t('footer.discord')}
                </a>
              </li>
              <li><Link href="/about" className="gm-footer-link" style={linkStyle}>{t('footer.about')}</Link></li>
              <li><Link href="/learn" className="gm-footer-link" style={linkStyle}>{t('footer.learn')}</Link></li>
              <li><Link href="/privacy" className="gm-footer-link" style={linkStyle}>{t('footer.privacy_policy')}</Link></li>
              <li><Link href="/terms" className="gm-footer-link" style={linkStyle}>{t('footer.terms_of_service')}</Link></li>
            </ul>
          </nav>
        </div>

        <div className="gm-footer-bottom">
          <span style={tertiary}>{t('footer.copyright')}</span>
          <p style={{ ...tertiary, maxWidth: 560, margin: 0 }}>
            {t('footer.disclaimer')}
          </p>
        </div>
      </div>
    </footer>
  )
}
