import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

export interface RoomPageFrontmatter {
  title: string
  order?: number
  description?: string
}

export interface RoomPage {
  pageSlug: string
  frontmatter: RoomPageFrontmatter
  content: string
}

const ROOM_DIR = path.join(process.cwd(), 'content', 'room')
const DECK_DIR = path.join(process.cwd(), 'content', 'pitchdeck')

export function roomDir(): string {
  return ROOM_DIR
}

export function roomExists(): boolean {
  return fs.existsSync(ROOM_DIR)
}

export function listRoomPages(): RoomPage[] {
  if (!fs.existsSync(ROOM_DIR)) return []
  return fs
    .readdirSync(ROOM_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => {
      const pageSlug = f.replace(/\.mdx$/, '')
      const raw = fs.readFileSync(path.join(ROOM_DIR, f), 'utf-8')
      const { data, content } = matter(raw)
      return {
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

export function getRoomPage(pageSlug: string): RoomPage | null {
  const filePath = path.join(ROOM_DIR, `${pageSlug}.mdx`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)
  return { pageSlug, frontmatter: data as RoomPageFrontmatter, content }
}

export function getPitchdeck(): { content: string; frontmatter: Record<string, unknown> } | null {
  const filePath = path.join(DECK_DIR, 'index.mdx')
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)
  return { content, frontmatter: data }
}
