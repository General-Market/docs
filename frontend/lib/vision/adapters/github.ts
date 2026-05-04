import type { SourceFeed } from './types'
import { fetchJsonWithTimeout } from './types'

/**
 * GitHub — public REST API gives a current star count for a repo. One number
 * is not a time-series; we carry it as a value chip and render no curve.
 * The data-node has historical stargazer history if you want a real chart
 * later — wire it through `/market/prices/github/{repo}/history` then.
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

  let meta = 'Stars · activity · releases'
  const stars = data?.stargazers_count
  if (typeof stars === 'number' && stars > 0) {
    meta = `${PROXY_REPO} · ${stars.toLocaleString()} stars`
  }

  return {
    sourceId: 'github',
    displayName: 'GitHub',
    assetName: PROXY_REPO,
    assetValue: typeof stars === 'number' ? `${stars.toLocaleString()}★` : undefined,
    meta,
    coverage: 'anticheat',
    series: [],
  }
}
