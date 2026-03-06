import { NextRequest, NextResponse } from 'next/server'

const LOCALES = ['en', 'ko', 'ja', 'zh']
const DEFAULT_LOCALE = 'en'

const COUNTRY_TO_LOCALE: Record<string, string> = {
  KR: 'ko',
  JP: 'ja',
  CN: 'zh',
  SG: 'zh',
  MY: 'zh',
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Already has locale prefix — pass through
  if (LOCALES.some(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) {
    return NextResponse.next()
  }

  // Detect locale from cookie
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value
  let locale = DEFAULT_LOCALE

  if (cookieLocale && LOCALES.includes(cookieLocale)) {
    locale = cookieLocale
  } else {
    // Try geo detection
    const country =
      request.headers.get('cf-ipcountry') ||
      (request as NextRequest & { geo?: { country?: string } }).geo?.country ||
      ''
    const geoLocale = COUNTRY_TO_LOCALE[country]
    if (geoLocale) {
      locale = geoLocale
    }
  }

  // Rewrite to /[locale]/path
  const url = request.nextUrl.clone()
  url.pathname = `/${locale}${pathname}`
  const response = NextResponse.rewrite(url)

  // Set cookie for future visits (if detected from geo)
  if (!cookieLocale && locale !== DEFAULT_LOCALE) {
    response.cookies.set('NEXT_LOCALE', locale, {
      maxAge: 365 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!api|dn|rpc|_next|_vercel|docs|health|.*\\..*).*)',],
}
