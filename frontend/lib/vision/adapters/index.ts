import type { SourceFeed } from './types'
import { SOURCE_IMAGES } from './types'
import { getDefiLlamaFeed } from './defillama'
import { getNasdaqFeed } from './nasdaq'
import { getSportsFeed } from './sports'
import { getIssFeed } from './iss'
import { getPolymarketFeed } from './polymarket'
import { getPumpfunFeed } from './pumpfun'
import { getTwitchFeed } from './twitch'
import { getSteamFeed } from './steam'
import { getGithubFeed } from './github'

export type { SourceFeed, Coverage } from './types'

const ADAPTERS: Record<string, () => Promise<SourceFeed>> = {
  defillama: getDefiLlamaFeed,
  nasdaq: getNasdaqFeed,
  sports: getSportsFeed,
  iss: getIssFeed,
  polymarket: getPolymarketFeed,
  pumpfun: getPumpfunFeed,
  twitch: getTwitchFeed,
  steam: getSteamFeed,
  github: getGithubFeed,
}

const DISPLAY: Record<string, { displayName: string; meta: string; coverage: 'anticheat' | 'external' | 'soon' }> = {
  defillama: { displayName: 'DefiLlama', meta: 'TVL across 240+ protocols', coverage: 'anticheat' },
  nasdaq: { displayName: 'Nasdaq', meta: 'Nasdaq-listed · pre-market + close', coverage: 'anticheat' },
  sports: { displayName: 'Sports', meta: 'NFL · NBA · MLB · NHL · soccer', coverage: 'anticheat' },
  iss: { displayName: 'ISS', meta: 'Position · pass times', coverage: 'anticheat' },
  polymarket: { displayName: 'Polymarket', meta: 'Prediction markets', coverage: 'external' },
  pumpfun: { displayName: 'Pumpfun', meta: 'Solana memecoin launches', coverage: 'external' },
  twitch: { displayName: 'Twitch', meta: 'Concurrent viewers', coverage: 'anticheat' },
  steam: { displayName: 'Steam', meta: 'Player counts', coverage: 'anticheat' },
  github: { displayName: 'GitHub', meta: 'Stars · activity', coverage: 'anticheat' },
}

export async function getHomeFeeds(): Promise<Record<string, SourceFeed>> {
  const ids = Object.keys(ADAPTERS)
  const results = await Promise.allSettled(ids.map((id) => ADAPTERS[id]()))
  const out: Record<string, SourceFeed> = {}
  results.forEach((r, i) => {
    const id = ids[i]
    if (r.status === 'fulfilled') {
      out[id] = { ...r.value, imageUrl: r.value.imageUrl ?? SOURCE_IMAGES[id] }
    } else {
      const d = DISPLAY[id]
      out[id] = {
        sourceId: id,
        displayName: d.displayName,
        meta: d.meta,
        coverage: d.coverage,
        series: [],
        imageUrl: SOURCE_IMAGES[id],
        external: d.coverage === 'external',
      }
    }
  })
  return out
}

export async function getSingleFeed(id: string): Promise<SourceFeed | null> {
  const fn = ADAPTERS[id]
  if (!fn) return null
  try {
    return await fn()
  } catch {
    const d = DISPLAY[id]
    return {
      sourceId: id,
      displayName: d?.displayName ?? id,
      meta: d?.meta ?? '',
      coverage: d?.coverage ?? 'anticheat',
      series: [],
    }
  }
}
