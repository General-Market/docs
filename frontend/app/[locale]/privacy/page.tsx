import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.privacy' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/privacy',
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.privacy' })

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
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('overview_title')}</h2>
              <p>{t('overview_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('collect_title')}</h2>
              <ul className="space-y-2 ml-4 list-disc">
                <li><span className="text-text-primary">{t('collect_wallets')}</span> — {t('collect_wallets_desc')}</li>
                <li><span className="text-text-primary">{t('collect_txs')}</span> — {t('collect_txs_desc')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('no_collect_title')}</h2>
              <ul className="space-y-2 ml-4 list-disc">
                <li>{t('no_collect_keys')}</li>
                <li>{t('no_collect_identity')}</li>
                <li>{t('no_collect_browsing')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('blockchain_title')}</h2>
              <p>{t('blockchain_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('storage_title')}</h2>
              <p>{t('storage_text')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">{t('third_party_title')}</h2>
              <p>{t('third_party_text')}</p>
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
            <a href="/terms" className="text-text-inverse-muted hover:text-text-inverse">Terms</a>
            <a href="https://x.com/otc_max" target="_blank" rel="noopener noreferrer" className="text-text-inverse-muted hover:text-text-inverse">@otc_max</a>
          </div>
        </section>
      </div>
    </main>
  )
}
