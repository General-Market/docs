import type { Metadata } from 'next'
import type { DocSection, DocFrontmatter } from './loadDoc'

const SITE_URL = 'https://nsgame.org'

export function buildDocMetadata(
  section: DocSection,
  frontmatter: DocFrontmatter,
): Metadata {
  const path = `/${section}/${frontmatter.slug}`
  const url = `${SITE_URL}${path}`
  const title = `${frontmatter.title} · nsgame`
  return {
    title,
    description: frontmatter.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title,
      description: frontmatter.description,
      siteName: 'nsgame',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: frontmatter.description,
    },
  }
}

export function buildSectionMetadata(
  section: DocSection,
  title: string,
  description: string,
): Metadata {
  const path = `/${section}`
  const url = `${SITE_URL}${path}`
  const fullTitle = `${title} · nsgame`
  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: fullTitle,
      description,
      siteName: 'nsgame',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  }
}
