import { promises as fs } from 'fs'
import path from 'path'
import matter from 'gray-matter'

const DOCS_ROOT = path.join(process.cwd(), 'content/docs')

export type DocFrontmatter = {
  title?: string
  description?: string
  sidebarTitle?: string
  hidden?: boolean
}

export type LoadedDoc = {
  slug: string
  source: string
  frontmatter: DocFrontmatter
  headings: Heading[]
}

export type Heading = {
  depth: 1 | 2 | 3
  text: string
  id: string
}

async function readFirstExisting(slug: string): Promise<string | null> {
  const candidates = [
    path.join(DOCS_ROOT, `${slug}.mdx`),
    path.join(DOCS_ROOT, `${slug}.md`),
  ]
  for (const p of candidates) {
    try {
      return await fs.readFile(p, 'utf8')
    } catch {}
  }
  return null
}

export async function loadDoc(slug: string): Promise<LoadedDoc | null> {
  const raw = await readFirstExisting(slug)
  if (raw === null) return null
  const { content, data } = matter(raw)
  return {
    slug,
    source: content,
    frontmatter: data as DocFrontmatter,
    headings: extractHeadings(content),
  }
}

export async function loadDocSummary(
  slug: string,
): Promise<{ slug: string; frontmatter: DocFrontmatter; plainText: string } | null> {
  const raw = await readFirstExisting(slug)
  if (raw === null) return null
  const { content, data } = matter(raw)
  return {
    slug,
    frontmatter: data as DocFrontmatter,
    plainText: stripMarkdown(content),
  }
}

export async function loadAllSummaries(slugs: string[]) {
  const out = await Promise.all(slugs.map(loadDocSummary))
  return out.filter((x): x is NonNullable<typeof x> => x !== null && !x.frontmatter.hidden)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function extractHeadings(markdown: string): Heading[] {
  const lines = markdown.split('\n')
  const headings: Heading[] = []
  let inCodeFence = false
  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence) continue
    const m = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    const depth = m[1].length as 1 | 2 | 3
    const text = m[2].replace(/`([^`]+)`/g, '$1').trim()
    headings.push({ depth, text, id: slugify(text) })
  }
  return headings
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_>~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

