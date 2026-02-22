import createMiddleware from 'next-intl/middleware'
import { NextRequest } from 'next/server'
import { locales, defaultLocale, COUNTRY_TO_LOCALE, type Locale } from './i18n/config'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed'
})

export default function middleware(request: NextRequest) {
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value

  if (!cookieLocale) {
    const country =
      request.headers.get('cf-ipcountry') ||
      request.geo?.country ||
      ''

    const geoLocale = COUNTRY_TO_LOCALE[country]
    if (geoLocale && geoLocale !== defaultLocale) {
      const response = intlMiddleware(request)
      response.cookies.set('NEXT_LOCALE', geoLocale, {
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
        sameSite: 'lax'
      })
      return response
    }
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}
