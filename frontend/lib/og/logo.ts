import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const cache = new Map<string, string>()

function resolveLocal(logoPath: string): string | null {
  if (logoPath.startsWith('http')) return null
  const rel = logoPath.replace(/^\//, '')
  return path.join(process.cwd(), 'public', rel)
}

export async function logoAsDataUrl(logoPath: string, maxDim = 540): Promise<string | null> {
  const key = `${logoPath}|${maxDim}`
  const hit = cache.get(key)
  if (hit) return hit

  try {
    let input: Buffer
    const local = resolveLocal(logoPath)
    if (local) {
      input = await readFile(local)
    } else {
      const res = await fetch(logoPath, { signal: AbortSignal.timeout(6_000) })
      if (!res.ok) return null
      input = Buffer.from(await res.arrayBuffer())
    }

    const png = await sharp(input, { density: 384 })
      .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: false })
      .png({ compressionLevel: 9 })
      .toBuffer()

    const url = `data:image/png;base64,${png.toString('base64')}`
    cache.set(key, url)
    return url
  } catch {
    return null
  }
}
