// Mark-to-market NAV reads occasionally print a lone-tick spike that survives
// in `vault_snapshots` forever. The Sparkline auto-scales Y to [min, max], so
// a single outlier pancakes every other point into a flat line. Median-of-3
// strips the spike from the chart line without rewriting any historical row.
// Display only — the API and the database still return the raw series.
export function medianFilter(values: number[]): number[] {
  if (values.length < 3) return values.slice()
  const out = [values[0]!]
  for (let i = 1; i < values.length - 1; i++) {
    const a = values[i - 1]!
    const b = values[i]!
    const c = values[i + 1]!
    out.push([a, b, c].sort((x, y) => x - y)[1]!)
  }
  out.push(values[values.length - 1]!)
  return out
}
