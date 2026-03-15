export function getCategory(marketId: string, prefixes: Map<string, string>): string {
  for (const [prefix, category] of prefixes) {
    if (marketId.startsWith(prefix)) return category
  }
  return 'other'
}

export function formatMarketName(marketId: string, prefixes: string[]): string {
  for (const prefix of prefixes) {
    if (marketId.startsWith(prefix)) return marketId.slice(prefix.length)
  }
  return marketId
}
