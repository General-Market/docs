/**
 * Construct CDN image URLs for Vision assets, loaded directly by the browser.
 * Returns null only for sources with no image API (economic indicators, etc.).
 *
 * Three tiers:
 * 1. Direct CDN, URL constructable from assetId alone
 * 2. Proxy redirect, /api/vision/icon/ resolves URL from upstream API, 302 to CDN
 * 3. null, text badge fallback (no images exist for this source)
 */

export function getAssetImageUrl(
  sourceId: string,
  assetId: string,
  prefixes: string[],
): string | null {
  const suffix = stripPrefix(assetId, prefixes)
  if (!suffix) return null

  switch (sourceId) {
    // ═══════════════════════════════════════════════════════════════════
    // TIER 1, Direct CDN (no API call, no proxy)
    // ═══════════════════════════════════════════════════════════════════

    // ── Stocks, company logos by ticker ──────────────────────────────
    case 'finnhub':
    case 'nasdaq': {
      const ticker = suffix.toUpperCase()
      if (/^[A-Z]{1,5}$/.test(ticker))
        return `https://financialmodelingprep.com/image-stock/${ticker}.png`
      return null
    }

    // ── DeFiLlama, protocol / chain / dex icons ─────────────────────
    case 'defillama': {
      if (suffix.startsWith('protocol_'))
        return `https://icons.llamao.fi/icons/protocols/${suffix.slice(9)}?w=48&h=48`
      if (suffix.startsWith('chain_'))
        return `https://icons.llamao.fi/icons/chains/rsz_${suffix.slice(6)}.jpg`
      if (suffix.startsWith('dex_24h_'))
        return `https://icons.llamao.fi/icons/protocols/${suffix.slice(8)}?w=48&h=48`
      if (suffix.startsWith('dex_30d_'))
        return `https://icons.llamao.fi/icons/protocols/${suffix.slice(8)}?w=48&h=48`
      return null
    }

    // ── Steam, game capsule art ─────────────────────────────────────
    case 'steam': {
      const appid = suffix.replace(/^game_/, '')
      if (/^\d+$/.test(appid))
        return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_184x69.jpg`
      return null
    }

    // ── GitHub, org / user avatar ───────────────────────────────────
    case 'github': {
      const owner = suffix.split('_')[0]
      if (owner) return `https://github.com/${owner}.png?size=48`
      return null
    }

    // ── AniList, anime / manga cover ────────────────────────────────
    case 'anilist': {
      const m = suffix.match(/^(?:anime|manga)_(\d+)/)
      if (m) return `https://img.anili.st/media/${m[1]}`
      return null
    }

    // ── Pump.fun, Solana token via DexScreener ──────────────────────
    case 'pumpfun': {
      if (suffix.length > 20)
        return `https://dd.dexscreener.com/ds-data/tokens/solana/${suffix}.png?size=lg`
      return null
    }

    // ── Polymarket, event images ────────────────────────────────────
    case 'polymarket': {
      // Polymarket condition IDs / slug, their CDN serves market images
      return `/api/vision/icon/polymarket/${encodeURIComponent(suffix)}`
    }

    // ── npm, package avatar ─────────────────────────────────────────
    case 'npm': {
      return `https://www.npmjs.com/npm-avatar/package/${encodeURIComponent(suffix)}`
    }

    // ── Queue Times, theme park logos ────────────────────────────────
    case 'queue_times': {
      // suffix contains park slug, proxy resolves park image
      return `/api/vision/icon/queue_times/${encodeURIComponent(suffix)}`
    }

    // ═══════════════════════════════════════════════════════════════════
    // TIER 2, Proxy redirect (/api/vision/icon/ → upstream API → 302)
    // ═══════════════════════════════════════════════════════════════════

    // ── CoinGecko, coin logos ───────────────────────────────────────
    case 'coingecko': {
      return `/api/vision/icon/crypto/${encodeURIComponent(suffix)}`
    }

    // ── Reddit, subreddit icon ──────────────────────────────────────
    case 'reddit': {
      const sub = suffix.replace(/_(subscribers|active)$/, '')
      if (sub) return `/api/vision/icon/reddit/${encodeURIComponent(sub)}`
      return null
    }

    // ── BGG, board game thumbnail ───────────────────────────────────
    case 'bgg': {
      const gameId = suffix.replace(/_rank$/, '')
      if (/^\d+$/.test(gameId)) return `/api/vision/icon/bgg/${gameId}`
      return null
    }

    // ── Twitch, streamer profile pics + game box art ──────────────────
    case 'twitch': {
      const isStream = suffix.startsWith('stream_')
      const id = suffix.replace(/^(stream_|game_)/, '')
      if (!id) return null
      // Streams → user profile image (Helix API), games → box art (IGDB CDN)
      if (isStream) return `/api/vision/icon/twitch-user/${encodeURIComponent(id)}`
      return `/api/vision/icon/twitch/${encodeURIComponent(id)}`
    }

    // ── Last.fm, artist image ───────────────────────────────────────
    case 'lastfm': {
      const artist = suffix.replace(/_(listeners|playcount)$/, '')
      if (artist) return `/api/vision/icon/lastfm/${encodeURIComponent(artist)}`
      return null
    }

    // ── TMDB, movie / TV poster ─────────────────────────────────────
    case 'tmdb': {
      // tmdb_movie_550 → movie/550, tmdb_tv_1399 → tv/1399
      const m = suffix.match(/^(movie|tv|person)_(\d+)/)
      if (m) return `/api/vision/icon/tmdb/${m[1]}/${m[2]}`
      return null
    }

    // ── Sports, team logos via ESPN ──────────────────────────────────
    case 'sports': {
      // sport_nba_12345_home → nba/12345/home
      const m = suffix.match(/^(\w+)_(\d+)_(home|away|total)$/)
      if (m) return `/api/vision/icon/espn/${m[1]}/${m[2]}/${m[3]}`
      return null
    }

    // ── Backpack.tf, TF2 item images ────────────────────────────────
    case 'backpacktf': {
      const defindex = suffix.replace(/^item_/, '')
      if (/^\d+$/.test(defindex))
        return `/api/vision/icon/backpacktf/${defindex}`
      return null
    }

    // ── Best Buy, product images ────────────────────────────────────
    case 'bestbuy': {
      if (/^\d+$/.test(suffix))
        return `/api/vision/icon/bestbuy/${suffix}`
      return null
    }

    // ═══════════════════════════════════════════════════════════════════
    // No images (aggregate data, no visual identity per asset)
    // ═══════════════════════════════════════════════════════════════════
    // ebird, lichess, mcbroken, aggregate stats
    // Economic/regulatory sources, data points, not entities

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
