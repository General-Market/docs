import { getRequestConfig } from 'next-intl/server'
import { headers } from 'next/headers'
import { locales, type Locale } from './config'

export default getRequestConfig(async ({ requestLocale }) => {
  // Prefer the locale set by [locale]/layout.tsx via setRequestLocale.
  // Fall back to the x-locale header set by middleware.ts — this is the path
  // the root layout takes, since it renders before [locale]/layout.tsx runs.
  let locale = await requestLocale
  if (!locale || !locales.includes(locale as Locale)) {
    const headerLocale = (await headers()).get('x-locale')
    if (headerLocale && locales.includes(headerLocale as Locale)) {
      locale = headerLocale
    } else {
      locale = 'en'
    }
  }

  // Load all namespace files for this locale
  const namespaces = [
    'common', 'markets', 'portfolio', 'create-itp',
    'buy-modal', 'sell-modal', 'lending', 'vision',
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
