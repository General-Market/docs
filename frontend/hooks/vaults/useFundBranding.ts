import fundData from '@/data/fund-branding.json'
import sourcesData from '@/data/sources-display.json'

export interface FundBranding {
  symbol: string
  name: string
  tagline: string
  strategy: string
  color: string
  source: string
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
  'Finance',
  'Economic',
  'Geophysical',
  'Transport',
  'Entertainment',
  'Tech',
  'Nature',
  'Academic',
  'Regulatory',
  'Space',
] as const

function resolveSourceLogo(sourceKey: string): string {
  const source = sourcesData.sources.find(
    (s: any) => s.sourceId === sourceKey || s.internalIds?.includes(sourceKey),
  )
  return source?.logo ?? ''
}

function resolveBranding(fund: (typeof fundData.funds)[number]): FundBranding {
  const sourceLogos = [resolveSourceLogo(fund.source)].filter(Boolean)
  return { ...fund, sourceLogos }
}

export function useFundBranding(vaultAddress: string): FundBranding | null {
  if (!vaultAddress) return null
  const fund = fundData.funds.find(
    f => f.vault && f.vault.toLowerCase() === vaultAddress.toLowerCase(),
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

export function getAllFundSources(): SourceDisplay[] {
  const seen = new Set<string>()
  const result: SourceDisplay[] = []
  for (const fund of fundData.funds) {
    if (!fund.source || seen.has(fund.source)) continue
    seen.add(fund.source)
    const display = sourcesData.sources.find(
      (s: any) => s.sourceId === fund.source || s.internalIds?.includes(fund.source),
    )
    result.push({
      sourceId: fund.source,
      name: display?.name ?? fund.source,
      logo: display?.logo ?? '',
    })
  }
  return result
}

export function getFundsBySource(sourceId: string): FundBranding[] {
  return fundData.funds
    .filter(f => f.source === sourceId)
    .map(resolveBranding)
}

export function getFundCountForSource(sourceId: string): number {
  return fundData.funds.filter(f => f.source === sourceId).length
}
