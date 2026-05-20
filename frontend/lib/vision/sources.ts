// Source metadata comes from the data-node API.
//
// Client components  → useSourceRegistry()   from @/hooks/vision/useSourceRegistry
// Server components  → getSourceRegistryServer() from @/lib/vision/sources-server
//
// This file keeps shared types only.
// ID translation lives in source-ids.ts.

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
  audience?: 'human' | 'bot' | 'redirect'
  redirectTo?: string
}
