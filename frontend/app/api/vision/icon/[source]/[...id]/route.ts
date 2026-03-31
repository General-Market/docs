import { NextResponse } from 'next/server'

/**
 * Icon proxy — resolves asset image URLs from upstream APIs.
 * Returns 302 redirect to the actual CDN image.
 * Cached 24h at edge, 7d stale-while-revalidate.
 *
 * Uses only public, keyless APIs. Each upstream response is cached
 * via Next.js data cache (revalidate), so repeated requests for the
 * same asset don't hit the upstream API.
 */

const REDIRECT_HEADERS = {
  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
}

const NOT_FOUND = () => new NextResponse(null, { status: 404, headers: REDIRECT_HEADERS })
const BAD_GATEWAY = () => new NextResponse(null, { status: 502, headers: REDIRECT_HEADERS })

/**
 * Called from the catch-all /api/vision/[...path] when path starts with "icon".
 * path = ["crypto", "bitcoin"] → source="crypto", identifier="bitcoin"
 */
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ source: string; id: string[] }> },
) {
  const { source, id } = await params
  return resolveIcon([source, ...id])
}

// ESPN league code → API sport/league path
const ESPN_PATHS: Record<string, string> = {
  nba: 'basketball/nba', nfl: 'football/nfl', mlb: 'baseball/mlb',
  nhl: 'hockey/nhl', wnba: 'basketball/wnba', mls: 'soccer/usa.1',
  epl: 'soccer/eng.1', laliga: 'soccer/esp.1', bundesliga: 'soccer/ger.1',
  seriea: 'soccer/ita.1', ligue1: 'soccer/fra.1', ucl: 'soccer/uefa.champions',
}

async function resolveImageUrl(source: string, id: string): Promise<string | null> {
  switch (source) {
    // ── CoinGecko — coin image by slug ───────────────────────────────
    case 'crypto': {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
        { next: { revalidate: 604800 } },
      )
      if (!res.ok) return null
      const data = await res.json()
      return data?.image?.small ?? data?.image?.thumb ?? null
    }

    // ── Reddit — subreddit icon ──────────────────────────────────────
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

    // ── BoardGameGeek — game thumbnail from XML API ──────────────────
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

    // ── Twitch — game box art via IGDB CDN ───────────────────────────
    case 'twitch':
      return `https://static-cdn.jtvnw.net/ttv-boxart/${encodeURIComponent(id)}_IGDB-48x64.jpg`

    // ── Last.fm — artist image (public search, no key) ───────────────
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

    // ── TMDB — movie/TV poster or person profile ─────────────────────
    case 'tmdb': {
      // id = "movie/550" or "tv/1399" or "person/287"
      const res = await fetch(
        `https://api.themoviedb.org/3/${id}?api_key=${process.env.TMDB_API_KEY || ''}`,
        { next: { revalidate: 604800 } },
      )
      if (!res.ok) return null
      const data = await res.json()
      const path = data?.poster_path ?? data?.profile_path
      return path ? `https://image.tmdb.org/t/p/w200${path}` : null
    }

    // ── ESPN Sports — team logo by game + side ───────────────────────
    case 'espn': {
      // id = "nba/12345/home" or "epl/67890/away"
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
      // home team has homeAway === 'home'
      const teamIdx = side === 'away'
        ? competitors.findIndex((c: { homeAway: string }) => c.homeAway === 'away')
        : competitors.findIndex((c: { homeAway: string }) => c.homeAway === 'home')
      const team = competitors[teamIdx >= 0 ? teamIdx : 0]
      return team?.team?.logos?.[0]?.href ?? null
    }

    // ── Polymarket — market event image ──────────────────────────────
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

    // ── Backpack.tf — TF2 item image via schema ──────────────────────
    case 'backpacktf': {
      // Try backpack.tf's image CDN with defindex
      return `https://backpack.tf/images/440/items/${encodeURIComponent(id)}.png`
    }

    // ── Best Buy — product image ─────────────────────────────────────
    case 'bestbuy': {
      // Best Buy product thumbnails via their public API
      const res = await fetch(
        `https://api.bestbuy.com/v1/products/${encodeURIComponent(id)}.json?apiKey=${process.env.BESTBUY_API_KEY || ''}&show=image&format=json`,
        { next: { revalidate: 604800 } },
      )
      if (!res.ok) return null
      const data = await res.json()
      return data?.image ?? null
    }

    // ── Queue Times — theme park image ───────────────────────────────
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
