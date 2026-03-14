import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.legal_vision' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/legal-vision',
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function LegalVisionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.legal_vision' })

  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-text-inverse-muted text-sm hover:text-text-inverse">{t('back')}</Link>
          <h1 className="text-3xl font-bold text-text-inverse mt-4">{t('title')}</h1>
          <p className="text-text-inverse-muted mt-2">{t('last_updated')}</p>
          <p className="text-text-inverse-muted text-xs mt-1">{t('entity')}</p>
        </div>

        <div className="bg-card rounded-xl shadow-card border border-border-light p-8">
          <div className="space-y-8 text-text-secondary text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('overview_title')}</h2>
              <p>{t('overview_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('p2p_title')}</h2>
              <p>{t('p2p_text')}</p>
              <ul className="space-y-2 ml-4 list-disc mt-3">
                <li>{t('p2p_no_house')}</li>
                <li>{t('p2p_no_counterparty')}</li>
                <li>{t('p2p_smart_contract')}</li>
                <li>{t('p2p_no_custodial')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('data_title')}</h2>
              <p>{t('data_text')}</p>
              <p className="mt-3">{t('data_nominative')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('delisting_title')}</h2>
              <p>{t('delisting_text')}</p>
              <div className="bg-surface-info border border-color-info/30 rounded-lg p-4 mt-3">
                <p className="text-text-primary text-xs">{t('delisting_contact')}</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('ip_title')}</h2>
              <p>{t('ip_text')}</p>
              <ul className="space-y-2 ml-4 list-disc mt-3">
                <li>{t('ip_no_endorsement')}</li>
                <li>{t('ip_no_affiliation')}</li>
                <li>{t('ip_referential')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('risk_title')}</h2>
              <div className="bg-surface-warning border border-color-warning/30 rounded-lg p-4 text-text-primary">
                <p className="font-medium mb-2">{t('risk_bold')}</p>
                <p className="text-text-secondary">{t('risk_text')}</p>
              </div>
              <ul className="space-y-2 ml-4 list-disc mt-3">
                <li>{t('risk_smart_contract')}</li>
                <li>{t('risk_oracle')}</li>
                <li>{t('risk_liquidity')}</li>
                <li>{t('risk_regulatory')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('no_advice_title')}</h2>
              <p>{t('no_advice_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('disclaimer_title')}</h2>
              <p>{t('disclaimer_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('liability_title')}</h2>
              <p>{t('liability_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('indemnification_title')}</h2>
              <p>{t('indemnification_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('governing_title')}</h2>
              <p>{t('governing_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('contact_title')}</h2>
              <p>
                {t('contact_text')} <a href="https://x.com/otc_max" target="_blank" rel="noopener noreferrer" className="text-zinc-900 font-medium hover:underline">@otc_max</a>
              </p>
            </section>
          </div>
        </div>

        {/* Links */}
        <section className="pt-8 mt-12 border-t border-border-dark">
          <div className="flex items-center gap-6 text-sm">
            <Link href="/legal-index" className="text-text-inverse-muted hover:text-text-inverse">Index Legal</Link>
            <Link href="/terms" className="text-text-inverse-muted hover:text-text-inverse">Terms</Link>
            <Link href="/privacy" className="text-text-inverse-muted hover:text-text-inverse">Privacy</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
