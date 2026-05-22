/**
 * Construct CDN image URLs for Vision assets — loaded directly by the browser.
 * Returns null only for sources with no image API (economic indicators, etc.).
 *
 * Three tiers:
 * 1. Direct CDN — URL constructable from assetId alone
 * 2. Proxy redirect — /api/vision/icon/ resolves URL from upstream API, 302 to CDN
 * 3. null — text badge fallback (no images exist for this source)
 */

import defillamaMetaRaw from '@/data/defillama-meta.json'

type DefiLlamaProtocolMeta = {
  name: string
  logo: string | null
  url: string | null
  twitter: string | null
  description: string | null
  category: string | null
  chain: string | null
}

type DefiLlamaChainMeta = {
  name: string
  logo: string | null
  gecko_id: string | null
  tokenSymbol: string | null
}

const DEFILLAMA_META = defillamaMetaRaw as {
  generatedAt: string
  protocols: Record<string, DefiLlamaProtocolMeta>
  chains: Record<string, DefiLlamaChainMeta>
}

/** Stripped asset identifier classified by its DefiLlama family. */
function defillamaLookup(suffix: string): {
  logo: string | null
  url: string | null
  twitter: string | null
  name: string | null
} {
  // protocol_<slug>, chain_<slug>, and dex_*_<slug> all resolve to protocol
  // logos on DefiLlama's CDN. Bare slugs (curated human pages already strip
  // the prefix) fall through to the protocol lookup too.
  let kind: 'protocol' | 'chain' | null = null
  let slug = suffix
  if (suffix.startsWith('protocol_')) { kind = 'protocol'; slug = suffix.slice(9) }
  else if (suffix.startsWith('chain_')) { kind = 'chain'; slug = suffix.slice(6) }
  else if (suffix.startsWith('dex_24h_')) { kind = 'protocol'; slug = suffix.slice(8) }
  else if (suffix.startsWith('dex_30d_')) { kind = 'protocol'; slug = suffix.slice(8) }
  else { kind = 'protocol' } // curated pages strip the prefix already

  if (kind === 'chain') {
    const meta = DEFILLAMA_META.chains[slug]
    if (meta) return { logo: meta.logo, url: null, twitter: null, name: meta.name }
    return {
      logo: `https://icons.llamao.fi/icons/chains/rsz_${slug.replace(/_/g, '-')}.jpg`,
      url: null,
      twitter: null,
      name: null,
    }
  }

  const meta = DEFILLAMA_META.protocols[slug]
  if (meta) {
    return {
      logo: meta.logo ?? `https://icons.llamao.fi/icons/protocols/${slug}?w=48&h=48`,
      url: meta.url,
      twitter: meta.twitter,
      name: meta.name,
    }
  }
  return {
    logo: `https://icons.llamao.fi/icons/protocols/${slug}?w=48&h=48`,
    url: null,
    twitter: null,
    name: null,
  }
}

/** Returns the image URL plus optional website + Twitter link for a market
 *  card. For non-DefiLlama sources only the logo is populated. */
export function getAssetMeta(
  sourceId: string,
  assetId: string,
  prefixes: string[],
): { logo: string | null; website: string | null; twitter: string | null } {
  // Every defillama-* human page (and the bare `defillama` firehose) goes
  // through the same DefiLlama resolver, so rotating which slugs appear on
  // the page never breaks the logo — the slug itself is the lookup key.
  if (sourceId === 'defillama' || sourceId.startsWith('defillama-')) {
    const suffix = stripPrefix(assetId, prefixes) ?? assetId
    const r = defillamaLookup(suffix)
    return { logo: r.logo, website: r.url, twitter: r.twitter }
  }
  return { logo: getAssetImageUrl(sourceId, assetId, prefixes), website: null, twitter: null }
}

export function getAssetImageUrl(
  sourceId: string,
  assetId: string,
  prefixes: string[],
): string | null {
  // DefiLlama family — protocols, chains, and DEX overviews all share one
  // CDN. Handled before the switch so the 18 curated human pages don't each
  // need an entry.
  if (sourceId === 'defillama' || sourceId.startsWith('defillama-')) {
    const suffix = stripPrefix(assetId, prefixes) ?? assetId
    return defillamaLookup(suffix).logo
  }

  const suffix = stripPrefix(assetId, prefixes)
  if (!suffix) return null

  switch (sourceId) {
    // ═══════════════════════════════════════════════════════════════════
    // TIER 1 — Direct CDN (no API call, no proxy)
    // ═══════════════════════════════════════════════════════════════════

    // ── Stocks — company logos by ticker ──────────────────────────────
    case 'finnhub':
    case 'nasdaq': {
      const ticker = suffix.toUpperCase()
      if (/^[A-Z]{1,5}$/.test(ticker))
        return `https://financialmodelingprep.com/image-stock/${ticker}.png`
      return null
    }

    // ── Steam — game capsule art ─────────────────────────────────────
    case 'steam': {
      const appid = suffix.replace(/^game_/, '')
      if (/^\d+$/.test(appid))
        return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_184x69.jpg`
      return null
    }

    // ── GitHub — org / user avatar ───────────────────────────────────
    case 'github': {
      const owner = suffix.split('_')[0]
      if (owner) return `https://github.com/${owner}.png?size=48`
      return null
    }

    // ── AniList — anime / manga cover ────────────────────────────────
    case 'anilist': {
      const m = suffix.match(/^(?:anime|manga)_(\d+)/)
      if (m) return `https://img.anili.st/media/${m[1]}`
      return null
    }

    // ── Pump.fun — Solana token via DexScreener ──────────────────────
    case 'pumpfun': {
      if (suffix.length > 20)
        return `https://dd.dexscreener.com/ds-data/tokens/solana/${suffix}.png?size=lg`
      return null
    }

    // ── Polymarket — event images ────────────────────────────────────
    case 'polymarket': {
      // Polymarket condition IDs / slug — their CDN serves market images
      return `/api/vision/icon/polymarket/${encodeURIComponent(suffix)}`
    }

    // ── npm — package avatar ─────────────────────────────────────────
    case 'npm': {
      return `https://www.npmjs.com/npm-avatar/package/${encodeURIComponent(suffix)}`
    }

    // ── Queue Times — theme park logos ────────────────────────────────
    case 'queue_times': {
      // suffix contains park slug — proxy resolves park image
      return `/api/vision/icon/queue_times/${encodeURIComponent(suffix)}`
    }

    // ═══════════════════════════════════════════════════════════════════
    // TIER 2 — Proxy redirect (/api/vision/icon/ → upstream API → 302)
    // ═══════════════════════════════════════════════════════════════════

    // ── CoinGecko — coin logos ───────────────────────────────────────
    case 'coingecko': {
      return `/api/vision/icon/crypto/${encodeURIComponent(suffix)}`
    }

    // ── Reddit — subreddit icon ──────────────────────────────────────
    case 'reddit': {
      const sub = suffix.replace(/_(subscribers|active)$/, '')
      if (sub) return `/api/vision/icon/reddit/${encodeURIComponent(sub)}`
      return null
    }

    // ── BGG — board game thumbnail ───────────────────────────────────
    case 'bgg': {
      const gameId = suffix.replace(/_rank$/, '')
      if (/^\d+$/.test(gameId)) return `/api/vision/icon/bgg/${gameId}`
      return null
    }

    // ── Twitch — streamer profile pics + game box art ──────────────────
    case 'twitch': {
      const isStream = suffix.startsWith('stream_')
      const id = suffix.replace(/^(stream_|game_)/, '')
      if (!id) return null
      // Streams → user profile image (Helix API), games → box art (IGDB CDN)
      if (isStream) return `/api/vision/icon/twitch-user/${encodeURIComponent(id)}`
      return `/api/vision/icon/twitch/${encodeURIComponent(id)}`
    }

    // ── Last.fm — artist image ───────────────────────────────────────
    case 'lastfm': {
      const artist = suffix.replace(/_(listeners|playcount)$/, '')
      if (artist) return `/api/vision/icon/lastfm/${encodeURIComponent(artist)}`
      return null
    }

    // ── TMDB — movie / TV poster ─────────────────────────────────────
    case 'tmdb': {
      // tmdb_movie_550 → movie/550, tmdb_tv_1399 → tv/1399
      const m = suffix.match(/^(movie|tv|person)_(\d+)/)
      if (m) return `/api/vision/icon/tmdb/${m[1]}/${m[2]}`
      return null
    }

    // ── Sports — team logos via ESPN ──────────────────────────────────
    case 'sports': {
      // sport_nba_12345_home → nba/12345/home
      const m = suffix.match(/^(\w+)_(\d+)_(home|away|total)$/)
      if (m) return `/api/vision/icon/espn/${m[1]}/${m[2]}/${m[3]}`
      return null
    }

    // ── Backpack.tf — TF2 item images ────────────────────────────────
    case 'backpacktf': {
      const defindex = suffix.replace(/^item_/, '')
      if (/^\d+$/.test(defindex))
        return `/api/vision/icon/backpacktf/${defindex}`
      return null
    }

    // ── Best Buy — product images ────────────────────────────────────
    case 'bestbuy': {
      if (/^\d+$/.test(suffix))
        return `/api/vision/icon/bestbuy/${suffix}`
      return null
    }

    // ═══════════════════════════════════════════════════════════════════
    // No images (aggregate data, no visual identity per asset)
    // ═══════════════════════════════════════════════════════════════════
    // ebird, lichess, mcbroken — aggregate stats
    // Economic/regulatory sources — data points, not entities

    default:
      return null
  }
}

function stripPrefix(assetId: string, prefixes: string[]): string | null {
  for (const pfx of prefixes) {
    if (assetId.startsWith(pfx)) return assetId.slice(pfx.length)
  }
  return null
}
