// Popularity ranking for human-source pages that have no curated allowlist.
// Each source carries the best signal it has — market cap for token sources,
// 24h volume for the rest, raw value as the floor — so we rank by the first
// one that actually parses to a positive number.

function parseFinitePositive(raw: string | null): number | null {
  if (!raw) return null
  const n = parseFloat(raw.replace(/,/g, ''))
  if (!isFinite(n) || n <= 0) return null
  return n
}

export function popularityScore(m: {
  marketCap: string | null
  volume24h: string | null
  value: string
}): number {
  return (
    parseFinitePositive(m.marketCap) ??
    parseFinitePositive(m.volume24h) ??
    parseFinitePositive(m.value) ??
    0
  )
}

export function rankByPopularity<
  T extends { marketCap: string | null; volume24h: string | null; value: string; assetId: string },
>(items: T[], n: number): T[] {
  return [...items]
    .sort((a, b) => {
      const diff = popularityScore(b) - popularityScore(a)
      if (diff !== 0) return diff
      return a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0
    })
    .slice(0, n)
}
