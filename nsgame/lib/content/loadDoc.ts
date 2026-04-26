import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

export type DocSection = 'legal' | 'product' | 'trust' | 'help' | 'brand' | 'plumbing'

export interface DocFrontmatter {
  title: string
  description: string
  slug: string
  category: string
  date: string
  author: string
  // Optional escape hatches the brief permits
  tldr?: string
  keywords?: string
  readingTime?: string
  image?: string
}

export interface LoadedDoc {
  frontmatter: DocFrontmatter
  body: string
  filePath: string
}

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'nsgame')

function sectionDir(section: DocSection): string {
  return path.join(CONTENT_ROOT, section)
}

export function listDocSlugs(section: DocSection): string[] {
  const dir = sectionDir(section)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace(/\.mdx$/, ''))
}

export function loadDoc(section: DocSection, slug: string): LoadedDoc | null {
  const filePath = path.join(sectionDir(section), `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  return {
    frontmatter: data as DocFrontmatter,
    body: content,
    filePath,
  }
}

export function listDocs(section: DocSection): LoadedDoc[] {
  return listDocSlugs(section)
    .map(slug => loadDoc(section, slug))
    .filter((d): d is LoadedDoc => d !== null)
}
