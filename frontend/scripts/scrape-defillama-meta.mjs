#!/usr/bin/env node
// Scrapes DefiLlama once and writes frontend/data/defillama-meta.json.
// One JSON object — `protocols[slug]` and `chains[slug]` — used by the
// human-trading pages to resolve logos, website, and Twitter per market.
//
// Run from the frontend directory:
//   node scripts/scrape-defillama-meta.mjs
//
// The output is committed to the repo. Re-run whenever curated.json gains
// new slugs or the upstream changes a logo URL.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(here, '..', 'data')
const CURATED_PATH = resolve(DATA_DIR, 'defillama-curated.json')
const OUT_PATH = resolve(DATA_DIR, 'defillama-meta.json')

const PROTOCOLS_URL = 'https://api.llama.fi/protocols'
const CHAINS_URL = 'https://api.llama.fi/v2/chains'

async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'gm-defillama-meta-scraper' } })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

function chainSlug(name) {
  return String(name).toLowerCase().replace(/\s+/g, '-')
}

function trim(v) {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s : null
}

async function main() {
  const curated = JSON.parse(await readFile(CURATED_PATH, 'utf8'))

  // Collect every slug we actually care about across the 17 curated pages.
  const protocolSlugs = new Set()
  const chainSlugs = new Set()
  for (const [, slugs] of Object.entries(curated)) {
    for (const s of slugs) {
      if (s.startsWith('chain_')) chainSlugs.add(s.slice(6))
      else protocolSlugs.add(s)
    }
  }
  console.log(`curated: ${protocolSlugs.size} protocols, ${chainSlugs.size} chains`)

  const [protocols, chains] = await Promise.all([
    getJson(PROTOCOLS_URL),
    getJson(CHAINS_URL),
  ])

  const protoOut = {}
  const seenProtoSlugs = new Set()
  for (const p of protocols) {
    const slug = trim(p.slug)
    if (!slug || !protocolSlugs.has(slug)) continue
    seenProtoSlugs.add(slug)
    protoOut[slug] = {
      name: trim(p.name) ?? slug,
      logo: trim(p.logo),
      url: trim(p.url),
      twitter: trim(p.twitter),
      description: trim(p.description),
      category: trim(p.category),
      chain: trim(p.chain),
    }
  }

  const missingProto = [...protocolSlugs].filter(s => !seenProtoSlugs.has(s))
  if (missingProto.length) {
    console.warn(`missing protocols (${missingProto.length}): ${missingProto.join(', ')}`)
  }

  // The curated list uses snake_case slugs (`hyperliquid_l1`) but DefiLlama
  // exposes them as kebab-case (`hyperliquid-l1`). Match in both directions
  // and emit each chain under the curated slug — the rest of the system
  // already keys off that form.
  const chainOut = {}
  const seenChainSlugs = new Set()
  const chainByKebab = new Map()
  for (const c of chains) {
    const kebab = chainSlug(c.name)
    chainByKebab.set(kebab, c)
  }
  for (const wanted of chainSlugs) {
    const candidates = [wanted, wanted.replace(/_/g, '-')]
    const c = candidates.map(k => chainByKebab.get(k)).find(Boolean)
    if (!c) continue
    seenChainSlugs.add(wanted)
    const kebab = chainSlug(c.name)
    chainOut[wanted] = {
      name: trim(c.name) ?? wanted,
      logo: `https://icons.llamao.fi/icons/chains/rsz_${kebab}.jpg`,
      gecko_id: trim(c.gecko_id),
      tokenSymbol: trim(c.tokenSymbol),
    }
  }
  const missingChains = [...chainSlugs].filter(s => !seenChainSlugs.has(s))
  if (missingChains.length) {
    console.warn(`missing chains (${missingChains.length}): ${missingChains.join(', ')}`)
  }

  const out = {
    generatedAt: new Date().toISOString(),
    protocols: protoOut,
    chains: chainOut,
  }

  await writeFile(OUT_PATH, JSON.stringify(out, null, 2) + '\n')
  console.log(`wrote ${OUT_PATH} — ${Object.keys(protoOut).length} protocols, ${Object.keys(chainOut).length} chains`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
