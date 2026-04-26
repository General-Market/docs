/**
 * Avatar sync. Reads `lib/markets/pairs.ts`, walks every performer slug,
 * and ensures `/public/models/{slug}.jpg` or `.svg` exists. New slugs
 * the bot adds get a face on the next build — no manual fetch run.
 *
 * Resolution order per slug:
 *   1. Already cached on disk → done.
 *   2. sourceId 1 (xvideos): /pornstar-channels/{slug} → og:image / json.
 *   3. Wikipedia summary API for the display name.
 *   4. Wikidata search → P18 → Commons FilePath.
 *   5. Deterministic gradient SVG generated from the slug hash.
 *
 * The file system is the cache. Run on prebuild; commit the result.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PAIRS_PATH = join(ROOT, 'lib', 'markets', 'pairs.ts')
const MODELS_DIR = join(ROOT, 'public', 'models')

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Safari/605.1.15'

interface Performer {
  slug: string
  name: string
  sourceId: 1 | 4
}

// Parse the STARS and CAMS arrays out of pairs.ts. The format is:
//   ['carlacute3', 'Carla Cute', 221_000_000n],
// We never re-parse strings inside; just slug+display.
function readPerformers(): Performer[] {
  const src = readFileSync(PAIRS_PATH, 'utf8')
  const tuple = /\[\s*'([^']+)'\s*,\s*'([^']+)'\s*,/g
  const blockOf = (header: RegExp): Performer[] => {
    const m = src.match(header)
    if (!m || m.index === undefined) return []
    const start = m.index
    const end = src.indexOf('] as const', start)
    if (end === -1) return []
    const body = src.slice(start, end)
    const out: Performer[] = []
    let r: RegExpExecArray | null
    const re = new RegExp(tuple.source, 'g')
    while ((r = re.exec(body)) !== null) {
      out.push({ slug: r[1]!, name: r[2]!, sourceId: 1 })
    }
    return out
  }
  const stars = blockOf(/^const STARS:[\s\S]*?=\s*\[/m)
  const cams = blockOf(/^const CAMS:[\s\S]*?=\s*\[/m).map(p => ({ ...p, sourceId: 4 as const }))
  return [...stars, ...cams]
}

function alreadyCached(slug: string): boolean {
  return (
    existsSync(join(MODELS_DIR, `${slug}.jpg`)) ||
    existsSync(join(MODELS_DIR, `${slug}.svg`)) ||
    existsSync(join(MODELS_DIR, `${slug}.png`))
  )
}

async function fetchBytes(url: string, timeoutMs = 12_000): Promise<Uint8Array | null> {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'image/*,*/*' },
      signal: ctl.signal,
      redirect: 'follow',
    })
    clearTimeout(t)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch { return null }
}

async function fetchText(url: string, timeoutMs = 12_000): Promise<string | null> {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: ctl.signal,
      redirect: 'follow',
    })
    clearTimeout(t)
    if (!res.ok) return null
    return await res.text()
  } catch { return null }
}

// Heuristic — anything below 5KB is likely a placeholder or 1x1 spacer.
function looksLikeImage(bytes: Uint8Array): boolean {
  if (bytes.length < 5_000) return false
  // JPEG magic FF D8 FF, PNG magic 89 50 4E 47.
  const a = bytes[0], b = bytes[1], c = bytes[2], d = bytes[3]
  if (a === 0xFF && b === 0xD8 && c === 0xFF) return true
  if (a === 0x89 && b === 0x50 && c === 0x4E && d === 0x47) return true
  return false
}

async function tryXvideos(slug: string): Promise<Uint8Array | null> {
  const paths = [
    `https://www.xvideos.com/pornstar-channels/${slug}`,
    `https://www.xvideos.com/profiles/${slug}`,
    `https://www.xvideos.com/amateur-channels/${slug}`,
  ]
  for (const url of paths) {
    const html = await fetchText(url)
    if (!html) continue
    // profile_picture inside JSON blob
    let m = html.match(/"profile_picture[^"]*":\s*"([^"]+)"/)
    if (!m) m = html.match(/og:image"\s*content="([^"]+)"/)
    if (!m) m = html.match(/class="profile-pic[^"]*"[\s\S]*?(?:src|background(?:-image)?:\s*url\(['"]?)\s*=?\s*["']?(https?:\/\/[^"')\s]+)/)
    if (!m) continue
    const imgUrl = m[1]!.replace(/\\\//g, '/')
    if (imgUrl.includes('profile_default') || imgUrl.endsWith('default_big.jpg')) continue
    const bytes = await fetchBytes(imgUrl)
    if (bytes && looksLikeImage(bytes)) return bytes
  }
  return null
}

async function tryWikipedia(name: string): Promise<Uint8Array | null> {
  const titleVariants = [
    name.replace(/\s+/g, '_'),
    `${name.replace(/\s+/g, '_')}_(actress)`,
    `${name.replace(/\s+/g, '_')}_(performer)`,
  ]
  for (const title of titleVariants) {
    const json = await fetchText(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    if (!json) continue
    try {
      const d = JSON.parse(json)
      const url: string | undefined =
        d?.thumbnail?.source ?? d?.originalimage?.source
      if (!url) continue
      const bytes = await fetchBytes(url)
      if (bytes && looksLikeImage(bytes)) return bytes
    } catch { /* skip */ }
  }
  return null
}

async function tryWikidata(name: string): Promise<Uint8Array | null> {
  const search = await fetchText(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&limit=1`,
  )
  if (!search) return null
  let qid: string | undefined
  try {
    const d = JSON.parse(search)
    qid = d?.search?.[0]?.id
  } catch { /* skip */ }
  if (!qid) return null
  const entity = await fetchText(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)
  if (!entity) return null
  let fileName: string | undefined
  try {
    const d = JSON.parse(entity)
    const e = d.entities[Object.keys(d.entities)[0]!]
    fileName = e?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
  } catch { /* skip */ }
  if (!fileName) return null
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName.replace(/ /g, '_'))}?width=400`
  const bytes = await fetchBytes(url)
  if (bytes && looksLikeImage(bytes)) return bytes
  return null
}

function hash32(s: string, seed = 0): number {
  let h = seed | 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '··'
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase()
  return (p[0]![0]! + p[1]![0]!).toUpperCase()
}

function generateSvg(slug: string, name: string): string {
  const h1 = hash32(slug, 0) % 360
  const h2 = (h1 + 30 + (hash32(slug, 7) % 60)) % 360
  const c1 = `hsl(${h1},72%,52%)`
  const c2 = `hsl(${h2},78%,38%)`
  const I = initials(name)
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">',
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
    `<stop offset="0%" stop-color="${c1}"/>`,
    `<stop offset="100%" stop-color="${c2}"/>`,
    '</linearGradient></defs>',
    '<rect width="120" height="120" fill="url(#g)"/>',
    `<text x="60" y="60" font-family="-apple-system,BlinkMacSystemFont,Inter,sans-serif" font-size="50" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="rgba(255,255,255,0.95)">${I}</text>`,
    '</svg>',
  ].join('')
}

async function resolveOne(p: Performer): Promise<{ slug: string; via: string }> {
  if (alreadyCached(p.slug)) return { slug: p.slug, via: 'cached' }

  if (p.sourceId === 1) {
    const xv = await tryXvideos(p.slug)
    if (xv) {
      writeFileSync(join(MODELS_DIR, `${p.slug}.jpg`), xv)
      return { slug: p.slug, via: 'xvideos' }
    }
  }
  const wp = await tryWikipedia(p.name)
  if (wp) {
    writeFileSync(join(MODELS_DIR, `${p.slug}.jpg`), wp)
    return { slug: p.slug, via: 'wikipedia' }
  }
  const wd = await tryWikidata(p.name)
  if (wd) {
    writeFileSync(join(MODELS_DIR, `${p.slug}.jpg`), wd)
    return { slug: p.slug, via: 'wikidata' }
  }
  // Last resort — generate a deterministic gradient SVG. Never breaks.
  const svg = generateSvg(p.slug, p.name)
  writeFileSync(join(MODELS_DIR, `${p.slug}.svg`), svg)
  return { slug: p.slug, via: 'svg' }
}

async function main() {
  if (!existsSync(MODELS_DIR)) mkdirSync(MODELS_DIR, { recursive: true })
  const performers = readPerformers()
  const counts: Record<string, number> = { cached: 0, xvideos: 0, wikipedia: 0, wikidata: 0, svg: 0 }
  // Bounded concurrency. Polite to upstream and the local network.
  const CONCURRENCY = 4
  let i = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < performers.length) {
        const p = performers[i++]!
        const r = await resolveOne(p)
        counts[r.via] = (counts[r.via] ?? 0) + 1
        if (r.via !== 'cached') console.log(`[avatar] ${p.slug} via ${r.via}`)
      }
    }),
  )
  const summary = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')
  console.log(`[avatar] ${performers.length} performers — ${summary}`)
}

main().catch((err) => {
  console.error('[avatar] sync failed:', err)
  process.exit(1)
})
