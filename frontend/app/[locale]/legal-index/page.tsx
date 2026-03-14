import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.legal_index' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/legal-index',
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function LegalIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.legal_index' })

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
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('nature_title')}</h2>
              <p>{t('nature_text')}</p>
              <ul className="space-y-2 ml-4 list-disc mt-3">
                <li>{t('nature_not_securities')}</li>
                <li>{t('nature_not_investment')}</li>
                <li>{t('nature_not_fund')}</li>
                <li>{t('nature_experimental')}</li>
                <li>{t('nature_decentralized_issuers')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('protocol_title')}</h2>
              <p>{t('protocol_text')}</p>
              <ul className="space-y-2 ml-4 list-disc mt-3">
                <li>{t('protocol_non_custodial')}</li>
                <li>{t('protocol_immutable')}</li>
                <li>{t('protocol_transparent')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('pricing_title')}</h2>
              <p>{t('pricing_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('risk_title')}</h2>
              <div className="bg-surface-warning border border-color-warning/30 rounded-lg p-4 text-text-primary">
                <p className="font-medium mb-2">{t('risk_bold')}</p>
                <p className="text-text-secondary">{t('risk_text')}</p>
              </div>
              <ul className="space-y-2 ml-4 list-disc mt-3">
                <li>{t('risk_smart_contract')}</li>
                <li>{t('risk_price')}</li>
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
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('responsibilities_title')}</h2>
              <ul className="space-y-2 ml-4 list-disc">
                <li>{t('responsibilities_keys')}</li>
                <li>{t('responsibilities_decisions')}</li>
                <li>{t('responsibilities_laws')}</li>
                <li>{t('responsibilities_tax')}</li>
                <li>{t('responsibilities_research')}</li>
              </ul>
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
            <Link href="/legal-vision" className="text-text-inverse-muted hover:text-text-inverse">Vision Legal</Link>
            <Link href="/terms" className="text-text-inverse-muted hover:text-text-inverse">Terms</Link>
            <Link href="/privacy" className="text-text-inverse-muted hover:text-text-inverse">Privacy</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
