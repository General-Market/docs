import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

export interface RoomPageFrontmatter {
  title: string
  order?: number
  description?: string
}

export interface RoomPage {
  slug: string
  pageSlug: string
  frontmatter: RoomPageFrontmatter
  content: string
}

const ROOMS_DIR = path.join(process.cwd(), 'content', 'room')
const DECK_DIR = path.join(process.cwd(), 'content', 'pitchdeck')

export function getRoomDir(slug: string): string {
  return path.join(ROOMS_DIR, slug)
}

export function roomExists(slug: string): boolean {
  return fs.existsSync(getRoomDir(slug))
}

export function listRoomPages(slug: string): RoomPage[] {
  const dir = getRoomDir(slug)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => {
      const pageSlug = f.replace(/\.mdx$/, '')
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
      const { data, content } = matter(raw)
      return {
        slug,
        pageSlug,
        frontmatter: data as RoomPageFrontmatter,
        content,
      }
    })
    .sort((a, b) => {
      if (a.pageSlug === 'index') return -1
      if (b.pageSlug === 'index') return 1
      const ao = a.frontmatter.order ?? 999
      const bo = b.frontmatter.order ?? 999
      if (ao !== bo) return ao - bo
      return a.pageSlug.localeCompare(b.pageSlug)
    })
}

export function getRoomPage(slug: string, pageSlug: string): RoomPage | null {
  const filePath = path.join(getRoomDir(slug), `${pageSlug}.mdx`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)
  return { slug, pageSlug, frontmatter: data as RoomPageFrontmatter, content }
}

export function getPitchdeck(): { content: string; frontmatter: Record<string, unknown> } | null {
  const filePath = path.join(DECK_DIR, 'index.mdx')
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)
  return { content, frontmatter: data }
}
