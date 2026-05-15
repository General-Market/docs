// Sources are listed in the registry. Some never attracted a vault.
// We hide those everywhere a human browses — sidebar peers, the home
// grid, the source landing page itself. The data-node still knows
// they exist; the UI just declines to point at them.
//
// Truth lives in `fund-branding.json`. A source counts as "has-vault"
// when at least one fund declares `source === id` and carries a
// 0x-prefixed 42-char vault address.

import fundData from '@/data/fund-branding.json'

const VAULT_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

let cached: Set<string> | null = null

function isFundedVault(value: unknown): value is string {
  return typeof value === 'string' && VAULT_ADDRESS_RE.test(value)
}

/**
 * The set of source IDs for which at least one branded fund has a real
 * vault address. Computed once per process — fund-branding.json is
 * static at build time.
 */
export function sourcesWithVaults(): Set<string> {
  if (cached) return cached
  const result = new Set<string>()
  for (const fund of fundData.funds ?? []) {
    if (typeof fund.source !== 'string') continue
    if (!isFundedVault(fund.vault)) continue
    result.add(fund.source)
  }
  cached = result
  return result
}

export function hasVaultForSource(sourceId: string | undefined | null): boolean {
  if (!sourceId) return false
  return sourcesWithVaults().has(sourceId)
}
