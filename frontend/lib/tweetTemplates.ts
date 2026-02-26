interface SimStats {
  topN: number
  category: string
  totalReturn: string
  sharpe: string
  totalSimsRun: number
  bestStrategy?: string
  bestReturn?: string
  uniqueStrategies?: number
  uniqueCategories?: number
}

export function getTweetText(tier: number, stats: SimStats): string {
  switch (tier) {
    case 1:
      return [
        'Should I tokenize this index?',
        '',
        `${stats.topN} ${stats.category} assets. ${stats.totalReturn}% since Jan 2020. ${stats.sharpe} Sharpe.`,
      ].join('\n')

    case 2:
      return [
        'Should I tokenize this one too?',
        '',
        `${stats.totalSimsRun} backtests deep. Best so far: ${stats.bestStrategy ?? 'N/A'} at ${stats.bestReturn ?? '0'}%.`,
      ].join('\n')

    case 3:
      return [
        `${stats.totalSimsRun} backtests. Still looking for the one to tokenize.`,
      ].join('\n')

    default:
      return ''
  }
}

export function buildTweetIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
}
