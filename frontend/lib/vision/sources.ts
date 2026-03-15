// All source metadata now comes from data-node API via useSourceRegistry() hook.
// This file kept for backward compatibility during migration.

export type SourceCategory = string

export interface VisionSource {
  id: string
  name: string
  description: string
  category: string
  logo: string
  brandBg: string
  prefixes: string[]
  valueLabel: string
  valueUnit: string
  isPrice: boolean
}

// Empty — all data comes from API now
export const VISION_SOURCES: VisionSource[] = []
