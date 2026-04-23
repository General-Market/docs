import { readFile } from 'node:fs/promises'
import path from 'node:path'

type FontWeight = 400 | 500 | 600 | 700 | 800

interface SatoriFont {
  name: string
  data: ArrayBuffer
  weight: FontWeight
  style: 'normal' | 'italic'
}

const GEIST_ROOT = 'node_modules/geist/dist/fonts/geist-sans'

const FACES: Array<{ file: string; weight: FontWeight }> = [
  { file: 'Geist-Regular.ttf', weight: 400 },
  { file: 'Geist-Medium.ttf', weight: 500 },
  { file: 'Geist-SemiBold.ttf', weight: 600 },
  { file: 'Geist-Bold.ttf', weight: 700 },
  { file: 'Geist-Black.ttf', weight: 800 },
]

let cached: SatoriFont[] | null = null

export async function geistFonts(): Promise<SatoriFont[]> {
  if (cached) return cached
  const fonts = await Promise.all(
    FACES.map(async ({ file, weight }): Promise<SatoriFont | null> => {
      try {
        const buf = await readFile(path.join(process.cwd(), GEIST_ROOT, file))
        return {
          name: 'Geist',
          data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
          weight,
          style: 'normal',
        }
      } catch {
        return null
      }
    }),
  )
  cached = fonts.filter((f): f is SatoriFont => f !== null)
  return cached
}
