/**
 * Transit-line colors + auto-generated badges for all Vision sources.
 *
 * Official maps override auto-color for sources with recognizable
 * visual identities (subway lines, tube lines, sports leagues, etc.).
 * Everything else gets a deterministic color from a 24-shade palette.
 */

export interface LineStyle {
  /** Background color */
  bg: string
  /** Foreground (text) color */
  fg: string
  /** Badge label (1–3 chars) */
  label: string
}

export interface SourceLineConfig {
  prefix: string
  lines: Record<string, LineStyle>
  /** 'exact' (default) = suffix must equal key.
   *  'prefix' = suffix must start with key_ (longest match wins). */
  matchMode?: 'exact' | 'prefix'
}

// ── Auto-color ────────────────────────────────────────────────────────
// Deterministic palette: hash the asset suffix → pick shade → short label.

const AUTO_PALETTE: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: '#E53935', fg: '#fff' },
  { bg: '#1E88E5', fg: '#fff' },
  { bg: '#43A047', fg: '#fff' },
  { bg: '#FB8C00', fg: '#fff' },
  { bg: '#8E24AA', fg: '#fff' },
  { bg: '#00ACC1', fg: '#fff' },
  { bg: '#F4511E', fg: '#fff' },
  { bg: '#3949AB', fg: '#fff' },
  { bg: '#7CB342', fg: '#000' },
  { bg: '#D81B60', fg: '#fff' },
  { bg: '#546E7A', fg: '#fff' },
  { bg: '#6D4C41', fg: '#fff' },
  { bg: '#FFB300', fg: '#000' },
  { bg: '#00897B', fg: '#fff' },
  { bg: '#5E35B1', fg: '#fff' },
  { bg: '#C0CA33', fg: '#000' },
  { bg: '#039BE5', fg: '#fff' },
  { bg: '#AD1457', fg: '#fff' },
  { bg: '#00695C', fg: '#fff' },
  { bg: '#EF6C00', fg: '#fff' },
  { bg: '#283593', fg: '#fff' },
  { bg: '#558B2F', fg: '#fff' },
  { bg: '#4527A0', fg: '#fff' },
  { bg: '#C62828', fg: '#fff' },
]

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function makeAutoLabel(suffix: string): string {
  if (!suffix) return '?'
  if (suffix.length <= 3) return suffix.toUpperCase()
  const parts = suffix.split(/[_\-.]/)
  if (parts.length > 1)
    return parts.slice(0, 3).map(p => (p[0] || '')).join('').toUpperCase()
  return suffix.slice(0, 2).toUpperCase()
}

function getAutoLineStyle(suffix: string): LineStyle {
  const idx = hashCode(suffix) % AUTO_PALETTE.length
  const { bg, fg } = AUTO_PALETTE[idx]
  return { bg, fg, label: makeAutoLabel(suffix) }
}

// ── Official maps ─────────────────────────────────────────────────────

// MTA New York City Subway — https://new.mta.info/map
const MTA_LINES: Record<string, LineStyle> = {
  '1':   { bg: '#EE352E', fg: '#fff', label: '1' },
  '2':   { bg: '#EE352E', fg: '#fff', label: '2' },
  '3':   { bg: '#EE352E', fg: '#fff', label: '3' },
  '4':   { bg: '#00933C', fg: '#fff', label: '4' },
  '5':   { bg: '#00933C', fg: '#fff', label: '5' },
  '6':   { bg: '#00933C', fg: '#fff', label: '6' },
  '7':   { bg: '#B933AD', fg: '#fff', label: '7' },
  'a':   { bg: '#0039A6', fg: '#fff', label: 'A' },
  'b':   { bg: '#FF6319', fg: '#fff', label: 'B' },
  'c':   { bg: '#0039A6', fg: '#fff', label: 'C' },
  'd':   { bg: '#FF6319', fg: '#fff', label: 'D' },
  'e':   { bg: '#0039A6', fg: '#fff', label: 'E' },
  'f':   { bg: '#FF6319', fg: '#fff', label: 'F' },
  'g':   { bg: '#6CBE45', fg: '#fff', label: 'G' },
  'j':   { bg: '#996633', fg: '#fff', label: 'J' },
  'l':   { bg: '#A7A9AC', fg: '#fff', label: 'L' },
  'm':   { bg: '#FF6319', fg: '#fff', label: 'M' },
  'n':   { bg: '#FCCC0A', fg: '#000', label: 'N' },
  'q':   { bg: '#FCCC0A', fg: '#000', label: 'Q' },
  'r':   { bg: '#FCCC0A', fg: '#000', label: 'R' },
  's':   { bg: '#808183', fg: '#fff', label: 'S' },
  'w':   { bg: '#FCCC0A', fg: '#000', label: 'W' },
  'z':   { bg: '#996633', fg: '#fff', label: 'Z' },
  'sir': { bg: '#1D2C6B', fg: '#fff', label: 'SIR' },
}

// ── Source registry ───────────────────────────────────────────────────
// Agents add maps here via line-maps/ modules.

const SOURCE_LINES: Record<string, SourceLineConfig> = {
  mta_subway: { prefix: 'mta_subway_', lines: MTA_LINES },
}

/** Register an official line map (called from line-maps/ modules). */
export function registerLineMap(sourceId: string, config: SourceLineConfig): void {
  SOURCE_LINES[sourceId] = config
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Get the line style for a source + assetId.
 * Official map → exact/prefix match → auto-color fallback.
 * Returns null only if no prefix can strip the assetId.
 */
export function getLineStyle(
  sourceId: string,
  assetId: string,
  prefixes?: string[],
): LineStyle | null {
  const entry = SOURCE_LINES[sourceId]
  if (entry) {
    const suffix = assetId.startsWith(entry.prefix)
      ? assetId.slice(entry.prefix.length)
      : null
    if (suffix) {
      if (entry.matchMode === 'prefix') {
        let best: LineStyle | null = null
        let bestLen = 0
        for (const key of Object.keys(entry.lines)) {
          if ((suffix === key || suffix.startsWith(key + '_')) && key.length > bestLen) {
            best = entry.lines[key]
            bestLen = key.length
          }
        }
        if (best) return best
      } else {
        const exact = entry.lines[suffix]
        if (exact) return exact
      }
      return getAutoLineStyle(suffix)
    }
  }

  // Auto-color fallback for sources without official maps
  if (prefixes) {
    for (const pfx of prefixes) {
      if (assetId.startsWith(pfx))
        return getAutoLineStyle(assetId.slice(pfx.length))
    }
  }
  return null
}

/** Check if a source has an official color map (not just auto-color). */
export function hasLineColors(sourceId: string): boolean {
  return sourceId in SOURCE_LINES
}
