import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.terms' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/terms',
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.terms' })

  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <a href="/" className="text-text-inverse-muted text-sm hover:text-text-inverse">{t('back')}</a>
          <h1 className="text-3xl font-bold text-text-inverse mt-4">{t('title')}</h1>
          <p className="text-text-inverse-muted mt-2">{t('last_updated')}</p>
        </div>

        <div className="bg-card rounded-xl shadow-card border border-border-light p-8">
          <div className="space-y-8 text-text-secondary text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('acceptance_title')}</h2>
              <p>{t('acceptance_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('what_is_title')}</h2>
              <p>{t('what_is_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('risk_title')}</h2>
              <div className="bg-surface-warning border border-color-warning/30 rounded-lg p-4 text-text-primary">
                <p className="font-medium mb-2">{t('risk_bold')}</p>
                <p className="text-text-secondary">{t('risk_text')}</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('experimental_title')}</h2>
              <p>{t('experimental_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('responsibilities_title')}</h2>
              <ul className="space-y-2 ml-4 list-disc">
                <li>{t('responsibilities_keys')}</li>
                <li>{t('responsibilities_decisions')}</li>
                <li>{t('responsibilities_laws')}</li>
                <li>{t('responsibilities_tax')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('no_advice_title')}</h2>
              <p>{t('no_advice_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('prohibited_title')}</h2>
              <ul className="space-y-2 ml-4 list-disc">
                <li>{t('prohibited_manipulation')}</li>
                <li>{t('prohibited_exploits')}</li>
                <li>{t('prohibited_interfere')}</li>
                <li>{t('prohibited_illegal')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('liability_title')}</h2>
              <p>{t('liability_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('changes_title')}</h2>
              <p>{t('changes_text')}</p>
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
            <a href="/privacy" className="text-text-inverse-muted hover:text-text-inverse">Privacy</a>
            <a href="https://x.com/otc_max" target="_blank" rel="noopener noreferrer" className="text-text-inverse-muted hover:text-text-inverse">@otc_max</a>
          </div>
        </section>
      </div>
    </main>
  )
}
