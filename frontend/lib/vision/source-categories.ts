import type { VisionSource } from './sources'

export function getSourcesByCategory(sources: VisionSource[], category: string) {
  if (category === 'all') return sources
  return sources.filter(s => s.category === category)
}

// ── Static category list — used for nav pills while API data loads ────────────
// These are stable display names. Counts come from the API (useSourceRegistry).

export interface CategoryInfo {
  key: string
  label: string
}

export const SOURCE_CATEGORIES: CategoryInfo[] = [
  { key: 'finance',       label: 'Finance' },
  { key: 'economic',      label: 'Economic' },
  { key: 'regulatory',    label: 'Regulatory' },
  { key: 'tech',          label: 'Tech' },
  { key: 'academic',      label: 'Academic' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'geophysical',   label: 'Geophysical' },
  { key: 'transport',     label: 'Transport' },
  { key: 'nature',        label: 'Nature' },
  { key: 'space',         label: 'Space' },
]

/** Human-readable label for a category key */
export function getCategoryLabel(key: string): string {
  const cat = SOURCE_CATEGORIES.find(c => c.key === key)
  return cat?.label ?? key.charAt(0).toUpperCase() + key.slice(1)
}

/** Source count per category from VISION_SOURCES (always 0 — sources come from API) */
export function getCategoryCounts(): Record<string, number> {
  const result: Record<string, number> = { all: 0 }
  for (const cat of SOURCE_CATEGORIES) {
    result[cat.key] = 0
  }
  return result
}

// ── Legacy CATEGORY_GROUPS used by VisionMarketsGrid ──────────────────────────
// Each entry groups data-node source IDs by display category.

export interface CategoryGroup {
  id: string
  label: string
  sources: string[]
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { id: 'finance',       label: 'Finance',       sources: ['crypto', 'stocks', 'defi', 'finnhub'] },
  { id: 'economic',      label: 'Economic',       sources: ['rates', 'bls', 'eia', 'ecb', 'bonds', 'bchain'] },
  { id: 'regulatory',    label: 'Regulatory',     sources: ['congress', 'finra_short_vol'] },
  { id: 'tech',          label: 'Tech',           sources: ['github', 'npm', 'pypi', 'crates_io', 'cloudflare'] },
  { id: 'academic',      label: 'Academic',       sources: ['openalex', 'crossref'] },
  { id: 'entertainment', label: 'Entertainment',  sources: ['twitch', 'anilist', 'steam', 'tmdb', 'lastfm', 'polymarket', 'backpacktf', 'fourchan'] },
  { id: 'geophysical',   label: 'Geophysical',    sources: ['weather', 'earthquake', 'spaceweather', 'wildfire'] },
  { id: 'transport',     label: 'Transport',      sources: ['flights', 'ships', 'transit', 'traffic', 'mil_aircraft'] },
  { id: 'nature',        label: 'Nature',         sources: ['ebird', 'airquality', 'shelters'] },
  { id: 'space',         label: 'Space',          sources: ['iss'] },
]

// ── SOURCE_DISPLAY_OVERRIDES — cosmetic display name overrides ─────────────────
// Overrides the raw sourceId when displaying source names in the markets grid.

export const SOURCE_DISPLAY_OVERRIDES: Record<string, string> = {
  'finra_short_vol': 'FINRA Short Vol',
  'spaceweather':    'Space Weather',
  'mil_aircraft':    'Mil Aircraft',
  'crates_io':       'Crates.io',
  'backpacktf':      'Backpack.tf',
  'fourchan':        '4chan',
  'bchain':          'BChain',
}
