import type { SourceFeed } from './types'
import { pickSourceSeries, formatCount } from './data-node-history'

/**
 * GitHub — stargazer counts per repo, sampled daily by the data-node.
 * Top-by-stars is what people recognize; the curve is the slow drift of
 * a project's mindshare. Real stars, real series.
 */
function repoFromSymbol(sym?: string): string | null {
  if (!sym) return null
  // data-node stores symbols like "GH:owner/repo".
  const m = sym.match(/^GH:(.+)$/)
  return m ? m[1] : sym
}

export async function getGithubFeed(): Promise<SourceFeed> {
  const picked = await pickSourceSeries('github', {
    rankBy: 'value',
    minPoints: 8,
    maxSeriesPoints: 64,
  })

  if (!picked) {
    return {
      sourceId: 'github',
      displayName: 'GitHub',
      meta: 'Stars · activity · releases',
      coverage: 'anticheat',
      series: [],
    }
  }

  const repo = repoFromSymbol(picked.asset.symbol) ?? picked.asset.name ?? 'Top repo'
  const stars = picked.last ?? 0
  return {
    sourceId: 'github',
    displayName: 'GitHub',
    assetName: repo,
    assetValue: stars > 0 ? `${formatCount(stars)}★` : undefined,
    meta: stars > 0 ? `${repo} · ${formatCount(stars)} stars` : 'Stars · activity · releases',
    coverage: 'anticheat',
    series: picked.series,
  }
}
