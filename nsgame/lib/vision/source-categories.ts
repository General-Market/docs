import type { VisionSource } from './sources'

export function getSourcesByCategory(sources: VisionSource[], category: string) {
  if (category === 'all') return sources
  return sources.filter(s => s.category === category)
}

// ── Static category list, used for nav pills while API data loads ────────────
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

/** Source count per category from VISION_SOURCES (always 0, sources come from API) */
export function getCategoryCounts(): Record<string, number> {
  const result: Record<string, number> = { all: 0 }
  for (const cat of SOURCE_CATEGORIES) {
    result[cat.key] = 0
  }
  return result
}

