import { NextResponse } from 'next/server'

// ── Twitch App Token (client_credentials) ─────────────────────────
let cachedTwitchToken: { token: string; expiresAt: number } | null = null

async function getTwitchAppToken(): Promise<string | null> {
  if (cachedTwitchToken && Date.now() < cachedTwitchToken.expiresAt) {
    return cachedTwitchToken.token
  }
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  try {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    cachedTwitchToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000,
    }
    return data.access_token
  } catch {
    return null
  }
}

const REDIRECT_HEADERS = {
  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
}

const NOT_FOUND = () => new NextResponse(null, { status: 404, headers: REDIRECT_HEADERS })
const BAD_GATEWAY = () => new NextResponse(null, { status: 502, headers: REDIRECT_HEADERS })

// ESPN league code → API sport/league path
const ESPN_PATHS: Record<string, string> = {
  nba: 'basketball/nba', nfl: 'football/nfl', mlb: 'baseball/mlb',
  nhl: 'hockey/nhl', wnba: 'basketball/wnba', mls: 'soccer/usa.1',
  epl: 'soccer/eng.1', laliga: 'soccer/esp.1', bundesliga: 'soccer/ger.1',
  seriea: 'soccer/ita.1', ligue1: 'soccer/fra.1', ucl: 'soccer/uefa.champions',
}

export async function resolveIcon(pathParts: string[]): Promise<NextResponse> {
  const [source, ...rest] = pathParts
  if (!source || rest.length === 0) return NOT_FOUND()
  const identifier = rest.join('/')
  try {
    const imageUrl = await resolveImageUrl(source, identifier)
    if (!imageUrl) return NOT_FOUND()
    return NextResponse.redirect(imageUrl, { status: 302, headers: REDIRECT_HEADERS })
  } catch {
    return BAD_GATEWAY()
  }
}

async function resolveImageUrl(source: string, id: string): Promise<string | null> {
  switch (source) {
    case 'crypto': {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
        { next: { revalidate: 604800 } },
      )
      if (!res.ok) return null
      const data = await res.json()
      return data?.image?.small ?? data?.image?.thumb ?? null
    }

    case 'reddit': {
      const res = await fetch(
        `https://www.reddit.com/r/${encodeURIComponent(id)}/about.json`,
        { next: { revalidate: 86400 }, headers: { 'User-Agent': 'Vision/1.0' } },
      )
      if (!res.ok) return null
      const data = await res.json()
      const icon: string = data?.data?.icon_img || data?.data?.community_icon || ''
      return icon ? icon.split('?')[0] : null
    }

    case 'bgg': {
      const res = await fetch(
        `https://boardgamegeek.com/xmlapi2/thing?id=${encodeURIComponent(id)}`,
        { next: { revalidate: 604800 } },
      )
      if (!res.ok) return null
      const xml = await res.text()
      const m = xml.match(/<thumbnail>(.*?)<\/thumbnail>/)
      return m?.[1] ?? null
    }

    case 'twitch':
      return `https://static-cdn.jtvnw.net/ttv-boxart/${encodeURIComponent(id)}_IGDB-48x64.jpg`

    case 'twitch-user': {
      const token = await getTwitchAppToken()
      if (!token) return null
      const res = await fetch(
        `https://api.twitch.tv/helix/users?login=${encodeURIComponent(id)}`,
        {
          headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID || '',
            'Authorization': `Bearer ${token}`,
          },
          next: { revalidate: 86400 },
        },
      )
      if (!res.ok) return null
      const data = await res.json()
      return data?.data?.[0]?.profile_image_url ?? null
    }

    case 'lastfm': {
      const res = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=artist.search&artist=${encodeURIComponent(id)}&limit=1&format=json`,
        { next: { revalidate: 604800 } },
      )
      if (!res.ok) return null
      const data = await res.json()
      const images = data?.results?.artistmatches?.artist?.[0]?.image
      if (!Array.isArray(images)) return null
      const img = images.find((i: { size: string }) => i.size === 'medium') ??
                  images.find((i: { size: string }) => i.size === 'large')
      const url = img?.['#text']
      return url && url.length > 0 ? url : null
    }

    case 'tmdb': {
      const res = await fetch(
        `https://api.themoviedb.org/3/${id}?api_key=${process.env.TMDB_API_KEY || ''}`,
        { next: { revalidate: 604800 } },
      )
      if (!res.ok) return null
      const data = await res.json()
      const path = data?.poster_path ?? data?.profile_path
      return path ? `https://image.tmdb.org/t/p/w200${path}` : null
    }

    case 'espn': {
      const [league, gameId, side] = id.split('/')
      const espnPath = ESPN_PATHS[league]
      if (!espnPath || !gameId) return null

      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/summary?event=${gameId}`,
        { next: { revalidate: 3600 } },
      )
      if (!res.ok) return null
      const data = await res.json()
      const competitors = data?.header?.competitions?.[0]?.competitors
      if (!Array.isArray(competitors)) return null
      const teamIdx = side === 'away'
        ? competitors.findIndex((c: { homeAway: string }) => c.homeAway === 'away')
        : competitors.findIndex((c: { homeAway: string }) => c.homeAway === 'home')
      const team = competitors[teamIdx >= 0 ? teamIdx : 0]
      return team?.team?.logos?.[0]?.href ?? null
    }

    case 'polymarket': {
      const res = await fetch(
        `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(id)}`,
        { next: { revalidate: 86400 } },
      )
      if (!res.ok) return null
      const markets = await res.json()
      const market = Array.isArray(markets) ? markets[0] : markets
      return market?.image ?? market?.icon ?? null
    }

    case 'backpacktf': {
      return `https://backpack.tf/images/440/items/${encodeURIComponent(id)}.png`
    }

    case 'bestbuy': {
      const res = await fetch(
        `https://api.bestbuy.com/v1/products/${encodeURIComponent(id)}.json?apiKey=${process.env.BESTBUY_API_KEY || ''}&show=image&format=json`,
        { next: { revalidate: 604800 } },
      )
      if (!res.ok) return null
      const data = await res.json()
      return data?.image ?? null
    }

    case 'queue_times': {
      const res = await fetch(
        `https://queue-times.com/parks/${encodeURIComponent(id)}.json`,
        { next: { revalidate: 604800 } },
      )
      if (!res.ok) return null
      const data = await res.json()
      return data?.image_url ?? null
    }

    default:
      return null
  }
}
