import type { SourceFeed } from './types'
import { DEFAULT_RESOLUTION, fallbackSeries, fetchJsonWithTimeout } from './types'

/**
 * GitHub — public REST API for trending stars on a watched repo. We sample
 * the bitcoin/bitcoin star count as a proxy stat; the curve is the value
 * smeared along a deterministic baseline so the card has a stationary shape.
 */

type RepoMeta = {
  stargazers_count?: number
  full_name?: string
}

const PROXY_REPO = 'bitcoin/bitcoin'

export async function getGithubFeed(): Promise<SourceFeed> {
  const data = await fetchJsonWithTimeout<RepoMeta>(
    `https://api.github.com/repos/${PROXY_REPO}`,
    4000,
    { headers: { Accept: 'application/vnd.github+json' } },
  )

  let series: number[]
  let meta = 'Stars · activity · releases'

  const stars = data?.stargazers_count
  if (typeof stars === 'number' && stars > 0) {
    const base = fallbackSeries('github', DEFAULT_RESOLUTION, stars, stars * 0.002, 4)
    base[base.length - 1] = stars
    series = base
    meta = `${PROXY_REPO} · ${stars.toLocaleString()} stars`
  } else {
    series = fallbackSeries('github', DEFAULT_RESOLUTION, 0.58, 7, 4)
  }

  return {
    sourceId: 'github',
    displayName: 'GitHub',
    assetName: PROXY_REPO,
    assetValue: typeof stars === 'number' ? `${stars.toLocaleString()}★` : undefined,
    meta,
    coverage: 'anticheat',
    series,
  }
}
