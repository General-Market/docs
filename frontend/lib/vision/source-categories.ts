/**
 * Source-level category definitions for the browse grid.
 * These group the 75+ data sources into ~10 high-level categories
 * (distinct from the market-level PREFIX_MAP in market-categories.ts).
 */

import { type SourceCategory, type VisionSource, VISION_SOURCES } from './sources'

export interface SourceCategoryInfo {
  key: SourceCategory
  label: string
}

export const SOURCE_CATEGORIES: SourceCategoryInfo[] = [
  { key: 'finance', label: 'Finance' },
  { key: 'economic', label: 'Economic' },
  { key: 'regulatory', label: 'Regulatory' },
  { key: 'tech', label: 'Tech & Dev' },
  { key: 'academic', label: 'Academic' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'geophysical', label: 'Geophysical' },
  { key: 'transport', label: 'Transport' },
  { key: 'nature', label: 'Nature' },
  { key: 'space', label: 'Space' },
]

/** Get sources filtered by category. Pass 'all' to get everything. */
export function getSourcesByCategory(category: SourceCategory | 'all'): VisionSource[] {
  if (category === 'all') return VISION_SOURCES
  return VISION_SOURCES.filter(s => s.category === category)
}

/** Count sources per category. Returns a record including 'all'. */
export function getCategoryCounts(): Record<SourceCategory | 'all', number> {
  const counts = { all: VISION_SOURCES.length } as Record<SourceCategory | 'all', number>
  for (const cat of SOURCE_CATEGORIES) {
    counts[cat.key] = 0
  }
  for (const source of VISION_SOURCES) {
    counts[source.category] = (counts[source.category] ?? 0) + 1
  }
  return counts
}

/** Get display label for a source category key */
export function getCategoryLabel(key: SourceCategory): string {
  return SOURCE_CATEGORIES.find(c => c.key === key)?.label ?? key
}
