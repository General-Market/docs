import { NextRequest, NextResponse } from 'next/server'
import { loadAllSummaries } from '@/lib/docs/mdx'
import { flattenSlugs, pageHref } from '@/lib/docs/nav'

type RankedDoc = {
  slug: string
  title: string
  href: string
  plainText: string
  score: number
}

type OpenAIResponse = {
  output_text?: string
  output?: Array<{
    type?: string
    content?: Array<{ type?: string; text?: string }>
  }>
  error?: { message?: string }
}

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'and',
  'are',
  'ask',
  'can',
  'docs',
  'does',
  'for',
  'from',
  'general',
  'have',
  'how',
  'into',
  'market',
  'the',
  'this',
  'what',
  'when',
  'where',
  'which',
  'with',
  'you',
])

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  let body: { question?: unknown; path?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const question = typeof body.question === 'string' ? body.question.trim() : ''
  const path = typeof body.path === 'string' ? body.path : ''

  if (question.length < 2) {
    return NextResponse.json({ error: 'Ask a longer question.' }, { status: 400 })
  }

  if (question.length > 600) {
    return NextResponse.json({ error: 'Keep the question under 600 characters.' }, { status: 400 })
  }

  const rankedDocs = await findRelevantDocs(question, path)
  const sources = rankedDocs.slice(0, 4).map(doc => ({ title: doc.title, href: doc.href }))

  const upstream = process.env.DOCS_AI_URL || process.env.DOCS_ASK_URL
  if (upstream) {
    const upstreamAnswer = await askUpstream(upstream, question, path, sources)
    if (upstreamAnswer) {
      return NextResponse.json({ ...upstreamAnswer, sources, mode: 'ai' })
    }
  }

  if (process.env.OPENAI_API_KEY) {
    const answer = await askOpenAI(question, path, rankedDocs)
    if (answer) {
      return NextResponse.json({ answer, sources, mode: 'ai' })
    }
  }

  return NextResponse.json({
    answer: fallbackAnswer(rankedDocs),
    sources,
    mode: 'search',
  })
}

async function findRelevantDocs(question: string, path: string): Promise<RankedDoc[]> {
  const summaries = await loadAllSummaries(flattenSlugs())
  const terms = tokenize(question)
  const activeSlug = path.startsWith('/docs/') ? path.replace(/^\/docs\//, '') : ''

  return summaries
    .map(summary => {
      const title = summary.frontmatter.sidebarTitle || summary.frontmatter.title || titleFromSlug(summary.slug)
      const haystack = `${summary.slug} ${title} ${summary.frontmatter.description ?? ''} ${summary.plainText}`.toLowerCase()
      let score = summary.slug === activeSlug ? 8 : 0

      for (const term of terms) {
        const matches = haystack.split(term).length - 1
        score += Math.min(matches, 8)
        if (summary.slug.includes(term)) score += 4
        if (title.toLowerCase().includes(term)) score += 5
      }

      return {
        slug: summary.slug,
        title,
        href: pageHref(summary.slug),
        plainText: summary.plainText,
        score,
      }
    })
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
}

async function askUpstream(
  upstream: string,
  question: string,
  path: string,
  sources: Array<{ title: string; href: string }>,
) {
  try {
    const res = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, path, sources }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data?.answer !== 'string') return null
    return { answer: data.answer.trim() }
  } catch {
    return null
  }
}

async function askOpenAI(question: string, path: string, docs: RankedDoc[]): Promise<string | null> {
  const model = process.env.DOCS_AI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4-mini'
  const context = docs
    .map((doc, index) => {
      const excerpt = doc.plainText.slice(0, 1800)
      return `[${index + 1}] ${doc.title}\nURL: ${doc.href}\n${excerpt}`
    })
    .join('\n\n')

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 700,
        instructions:
          'You answer General Market documentation questions. Use only the provided docs context. Front-load the answer. Use bullets for lists of three or more items. If the docs context is insufficient, say what is missing. Do not invent endpoints, contract names, numbers, or behavior.',
        input: `Current page: ${path || '/docs'}\nQuestion: ${question}\n\nDocs context:\n${context}`,
      }),
      signal: AbortSignal.timeout(45_000),
    })

    const data = (await res.json()) as OpenAIResponse
    if (!res.ok) {
      console.error('[docs-ask] OpenAI error:', data.error?.message || res.statusText)
      return null
    }

    return extractOutputText(data)
  } catch (err) {
    console.error('[docs-ask] OpenAI request failed:', err)
    return null
  }
}

function extractOutputText(data: OpenAIResponse): string | null {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }

  const text = data.output
    ?.flatMap(item => item.content ?? [])
    .map(content => content.text)
    .filter((value): value is string => Boolean(value?.trim()))
    .join('\n')
    .trim()

  return text || null
}

function fallbackAnswer(docs: RankedDoc[]): string {
  if (docs.length === 0) {
    return 'AI is not configured yet, and I did not find a close local docs match.'
  }

  const titles = docs.slice(0, 3).map(doc => doc.title).join(', ')
  return `AI is not configured yet. The closest docs are ${titles}.`
}

function tokenize(input: string): string[] {
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .replace(/[^a-z0-9_\-\s/]/g, ' ')
        .split(/\s+/)
        .map(term => term.trim())
        .filter(term => term.length > 2 && !STOP_WORDS.has(term)),
    ),
  )
}

function titleFromSlug(slug: string): string {
  const last = slug.split('/').pop() ?? slug
  return last
    .replace(/-/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .replace(/\bApi\b/, 'API')
    .replace(/\bItp\b/, 'ITP')
    .replace(/\bItps\b/, 'ITPs')
    .replace(/\bNav\b/, 'NAV')
}
