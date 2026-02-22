export const locales = ['en', 'ko', 'ja', 'zh'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  KR: 'ko',
  JP: 'ja',
  CN: 'zh',
  SG: 'zh',
  MY: 'zh',
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  zh: '中文',
}
