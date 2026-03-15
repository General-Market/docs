// Build-time script: extracts minimal founder data from the full 7MB JSON
// Run: npx tsx scripts/build-founders-lookup.ts
// Output: data/founders-lookup.json (~200KB)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'

const SOURCE = path.join(__dirname, '../../_bmad-output/youtube/video/top100cryptoage/crypto_founders_complete.json')
const OUTPUT = path.join(__dirname, '../data/founders-lookup.json')

// Skip if source doesn't exist (e.g. Vercel build) — use pre-built lookup
if (!existsSync(SOURCE)) {
  if (existsSync(OUTPUT)) {
    console.log(`Source not found, using existing ${OUTPUT}`)
  } else {
    console.log(`Source not found and no pre-built lookup — skipping founders build`)
  }
  process.exit(0)
}

const raw = JSON.parse(readFileSync(SOURCE, 'utf-8'))
const lookup: Record<string, { age?: number; gender: string; nationality: string; university?: string }[]> = {}

for (const company of raw.companies || []) {
  if (!company.coingecko_id || !company.founders?.length) continue
  lookup[company.coingecko_id] = company.founders.map((f: any) => ({
    age: f.age_value || undefined,
    gender: f.gender || 'unknown',
    nationality: f.nationality || 'Unknown',
    university: f.university || undefined,
  }))
}

mkdirSync(path.dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, JSON.stringify(lookup))
console.log(`Wrote ${Object.keys(lookup).length} entries to ${OUTPUT}`)
