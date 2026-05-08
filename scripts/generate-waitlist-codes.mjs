#!/usr/bin/env node
/**
 * Generate cryptographically random invite codes.
 *
 *   node scripts/generate-waitlist-codes.mjs [count]   # default 100
 *
 * Outputs:
 *   - waitlist-codes.txt     (one code per line, gitignored)
 *   - waitlist-codes.sql     (INSERT statements, gitignored)
 *
 * Codes use a Crockford-ish alphabet (no 0/O/1/I/L/U) grouped 4-4-4-4 to
 * keep them legible when read aloud or pasted from chat. Keyspace is
 * 28^16 ≈ 7e22 — a brute-force attempt at the rate-limited 10/hr/IP would
 * reach a single hit, on average, after the heat death of the sun.
 */

import { randomInt } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789' // 30 chars, no 0/O/1/I/L/U
const GROUPS = 4
const PER_GROUP = 4

function makeCode() {
  const groups = []
  for (let g = 0; g < GROUPS; g++) {
    let s = ''
    for (let i = 0; i < PER_GROUP; i++) {
      s += ALPHABET[randomInt(0, ALPHABET.length)]
    }
    groups.push(s)
  }
  return groups.join('-')
}

const count = Number(process.argv[2] || 100)
if (!Number.isFinite(count) || count <= 0 || count > 100_000) {
  console.error('count must be between 1 and 100000')
  process.exit(1)
}

const codes = new Set()
while (codes.size < count) codes.add(makeCode())

const list = [...codes]
const txtPath = resolve(process.cwd(), 'waitlist-codes.txt')
const sqlPath = resolve(process.cwd(), 'waitlist-codes.sql')

writeFileSync(txtPath, list.join('\n') + '\n', 'utf8')

const values = list.map((c) => `('${c}', 1, NULL)`).join(',\n  ')
const sql = `-- ${list.length} invite codes generated ${new Date().toISOString()}
INSERT INTO invite_codes (code, max_uses, notes) VALUES
  ${values}
ON CONFLICT (code) DO NOTHING;
`
writeFileSync(sqlPath, sql, 'utf8')

console.log(`Wrote ${list.length} codes to:`)
console.log(`  ${txtPath}`)
console.log(`  ${sqlPath}`)
console.log()
console.log('First 5:')
for (const c of list.slice(0, 5)) console.log(`  ${c}`)
