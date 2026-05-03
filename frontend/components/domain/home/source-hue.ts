/**
 * Stable hue per source id. Mirrors the bot visualizer's sourceHue helper —
 * ASCII sum modulo 360, deterministic, no overrides.
 * Used for the per-source gradient tile and the sparkline accent color.
 */
export function sourceHue(sourceId: string): number {
  let n = 0
  for (let i = 0; i < sourceId.length; i++) n = (n * 31 + sourceId.charCodeAt(i)) >>> 0
  return n % 360
}

export function sourceGradient(sourceId: string): string {
  const h = sourceHue(sourceId)
  return `linear-gradient(135deg, hsl(${h} 80% 94%), hsl(${(h + 40) % 360} 80% 88%))`
}

export function sourceStroke(sourceId: string): string {
  const h = sourceHue(sourceId)
  return `hsl(${h} 60% 38%)`
}

export function sourceFill(sourceId: string): string {
  const h = sourceHue(sourceId)
  return `hsla(${h}, 70%, 50%, 0.18)`
}

export function sourceAvatar(sourceId: string): string {
  const h = sourceHue(sourceId)
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 45%))`
}
