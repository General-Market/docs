/**
 * Stable hue per source id — Apple-restrained palette.
 * The visualizer used loud HSL gradients (80% saturation). Apple's product
 * cards use much subtler tints — soft pastels with high luminance, never
 * fighting the foreground. We mirror that here.
 */
export function sourceHue(sourceId: string): number {
  let n = 0
  for (let i = 0; i < sourceId.length; i++) n = (n * 31 + sourceId.charCodeAt(i)) >>> 0
  return n % 360
}

/** Tile background — single hue, low saturation, gentle vertical fade. */
export function sourceGradient(sourceId: string): string {
  const h = sourceHue(sourceId)
  return `linear-gradient(180deg, hsl(${h} 32% 96%), hsl(${h} 28% 91%))`
}

/** Sparkline stroke — readable, single hue at print-ink saturation. */
export function sourceStroke(sourceId: string): string {
  const h = sourceHue(sourceId)
  return `hsl(${h} 48% 36%)`
}

/** Sparkline area fill — same hue at chart-ghost opacity. */
export function sourceFill(sourceId: string): string {
  const h = sourceHue(sourceId)
  return `hsl(${h} 50% 45%)`
}

/** Avatar background — neutral apple surface, monochrome. */
export const avatarBackground = '#f5f5f7'

/** Avatar text/icon color — apple primary text. */
export const avatarForeground = '#1d1d1f'
