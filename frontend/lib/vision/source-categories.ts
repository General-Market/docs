import type { VisionSource } from './sources'

export function getSourcesByCategory(sources: VisionSource[], category: string) {
  return sources.filter(s => s.category === category)
}
