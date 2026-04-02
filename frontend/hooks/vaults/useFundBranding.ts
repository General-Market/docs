import fundData from '@/data/fund-branding.json'
import sourcesData from '@/data/sources-display.json'

export interface FundBranding {
  symbol: string
  name: string
  tagline: string
  strategy: string
  color: string
  sources: string[]
  category: string
  fee: number
  vault: string
  sourceLogos: string[]
}

export interface SourceDisplay {
  sourceId: string
  name: string
  logo: string
}

const CATEGORY_ORDER = [
  'Crypto',
  'Weather & Geophysical',
  'Transport',
  'Entertainment & Social',
  'Macro & Economic',
  'Tech & Developer',
  'Regulatory & Government',
  'Nature & Academic',
  'Water & Ocean',
  'Niche & Exotic',
] as const

function resolveSourceLogo(sourceKey: string): string {
  // Try direct sourceId match first, then internalIds
  const source = sourcesData.sources.find(
    s => s.sourceId === sourceKey || s.internalIds?.includes(sourceKey)
  )
  return source?.logo ?? ''
}

function resolveBranding(fund: (typeof fundData.funds)[number]): FundBranding {
  const sourceLogos = fund.sources
    .map(resolveSourceLogo)
    .filter(Boolean)

  return { ...fund, sourceLogos }
}

export function useFundBranding(vaultAddress: string): FundBranding | null {
  if (!vaultAddress) return null
  const fund = fundData.funds.find(
    f => f.vault && f.vault.toLowerCase() === vaultAddress.toLowerCase()
  )
  if (!fund) return null
  return resolveBranding(fund)
}

export function useFundBrandingBySymbol(symbol: string): FundBranding | null {
  const fund = fundData.funds.find(f => f.symbol === symbol)
  if (!fund) return null
  return resolveBranding(fund)
}

export function getAllCategories(): string[] {
  return [...CATEGORY_ORDER]
}

export function getAllFundsBranded(): FundBranding[] {
  return fundData.funds.map(resolveBranding)
}

export function getFundsByCategory(category: string): FundBranding[] {
  return fundData.funds
    .filter(f => f.category === category)
    .map(resolveBranding)
}

/** All unique primary sources that have at least one fund, in stable order */
export function getAllFundSources(): SourceDisplay[] {
  const seen = new Set<string>()
  const result: SourceDisplay[] = []
  for (const fund of fundData.funds) {
    const primarySource = fund.sources[0]
    if (!primarySource || seen.has(primarySource)) continue
    seen.add(primarySource)
    const display = sourcesData.sources.find(
      s => s.sourceId === primarySource || (s.internalIds as string[] | undefined)?.includes(primarySource)
    )
    result.push({
      sourceId: primarySource,
      name: display?.name ?? primarySource,
      logo: display?.logo ?? '',
    })
  }
  return result
}

/** Funds whose primary source matches sourceId */
export function getFundsBySource(sourceId: string): FundBranding[] {
  return fundData.funds
    .filter(f => f.sources[0] === sourceId)
    .map(resolveBranding)
}

/** Number of funds for a given primary source — cheap, no branding resolution */
export function getFundCountForSource(sourceId: string): number {
  return fundData.funds.filter(f => f.sources.includes(sourceId)).length
}
