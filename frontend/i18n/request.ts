import { getRequestConfig } from 'next-intl/server'
import { locales, type Locale } from './config'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !locales.includes(locale as Locale)) {
    locale = 'en'
  }

  // Load all namespace files for this locale
  const namespaces = [
    'common', 'markets', 'portfolio', 'create-itp',
    'buy-modal', 'sell-modal', 'lending', 'p2pool',
    'backtest', 'system', 'seo', 'pages'
  ]

  const messages: Record<string, Record<string, unknown>> = {}
  for (const ns of namespaces) {
    try {
      messages[ns] = (await import(`../messages/${locale}/${ns}.json`)).default
    } catch {
      // Fallback to English if translation file missing
      messages[ns] = (await import(`../messages/en/${ns}.json`)).default
    }
  }

  return { locale, messages }
})
