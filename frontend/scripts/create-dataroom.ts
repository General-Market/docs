#!/usr/bin/env tsx
/**
 * (Re-)issue the data room — sets the title and access code for the
 * single room served at /room.
 *
 * Usage:
 *   npx tsx scripts/create-dataroom.ts "Title" [--ttl-days=N] [--notes="..."] [--code=EXPLICIT]
 *
 * Example:
 *   npx tsx scripts/create-dataroom.ts "Pre-Seed Data Room" --ttl-days=120
 */

import { hashCode, generateCode } from '@/lib/dataroom/codes'
import { insertRoom } from '@/lib/dataroom/db'
import { ROOM_SLUG } from '@/lib/dataroom/config'

function parseArgs() {
  const argv = process.argv.slice(2)
  const positional: string[] = []
  const flags: Record<string, string> = {}
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1)
      else flags[a.slice(2)] = 'true'
    } else {
      positional.push(a)
    }
  }
  return { positional, flags }
}

async function main() {
  const { positional, flags } = parseArgs()
  const title = positional[0]
  if (!title) {
    console.error('Usage: create-dataroom "Title" [--ttl-days=N] [--notes="..."] [--code=...]')
    process.exit(1)
  }

  const ttlDays = flags['ttl-days'] ? Number(flags['ttl-days']) : 90
  const expires_at =
    Number.isFinite(ttlDays) && ttlDays > 0
      ? new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
      : null

  const code = flags.code ?? generateCode()
  const { hash, salt } = await hashCode(code)

  await insertRoom({
    slug: ROOM_SLUG,
    title,
    code_hash: hash,
    code_salt: salt,
    expires_at,
    notes: flags.notes,
  })

  const base = process.env.SITE_URL || 'https://www.generalmarket.io'
  const magicLink = `${base}/room?k=${encodeURIComponent(code)}`
  console.log('')
  console.log('  Data room (re-)issued.')
  console.log('')
  console.log(`  Title:        ${title}`)
  console.log(`  Magic link:   ${magicLink}`)
  console.log('')
  console.log('  Or send URL + code separately (more secure — code not in URL):')
  console.log(`  URL:          ${base}/room`)
  console.log(`  Code:         ${code}`)
  if (expires_at) {
    console.log('')
    console.log(`  Expires:      ${expires_at.toISOString()}`)
  }
  console.log('')
  console.log('  The code is shown only once. Save it somewhere if you want both options.')
  console.log('')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
