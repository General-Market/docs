import type { SourceFeed } from './types'
import { pickSourceSeries, formatBigNumber } from './data-node-history'

/**
 * Pumpfun — Solana memecoin prices the data-node samples by the minute.
 * Top by USD price (a market-cap proxy); the chart is the violent honesty
 * of a coin that exists for sixteen hours and dies. The card stays
 * `external` because pump.fun is not Anti-Cheat.
 */

function shortName(name?: string): string {
  if (!name) return 'Newest coin'
  // Names look like "Trollina (CqsE..pump)" — strip the parenthetical.
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name
}

export async function getPumpfunFeed(): Promise<SourceFeed> {
  const picked = await pickSourceSeries('pumpfun', {
    rankBy: 'value',
    minPoints: 12,
    maxSeriesPoints: 64,
  })

  if (!picked) {
    return {
      sourceId: 'pumpfun',
      displayName: 'Pumpfun',
      meta: 'Solana memecoin launches',
      coverage: 'external',
      series: [],
      external: true,
    }
  }

  const label = shortName(picked.asset.name)
  const price = picked.last ?? 0
  const priceLabel =
    price > 0
      ? price < 0.001
        ? `$${price.toExponential(2)}`
        : `$${price.toFixed(price < 1 ? 4 : 2)}`
      : undefined
  return {
    sourceId: 'pumpfun',
    displayName: 'Pumpfun',
    assetName: `$${label}`,
    assetValue: priceLabel,
    meta: priceLabel ? `$${label} · ${priceLabel}` : 'Solana memecoin launches',
    coverage: 'external',
    series: picked.series,
    external: true,
  }
}
