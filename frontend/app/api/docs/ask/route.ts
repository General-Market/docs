import { NextRequest, NextResponse } from 'next/server'
import { docsCorpus } from '@/lib/handbook'
import {
  forwardDocsPromptToCrm,
  saveDocsPrompt,
  type DocsAskMessage,
  type DocsAskSource,
} from '@/lib/docs/ask-store'

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
  let body: { question?: unknown; path?: unknown; messages?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const question = typeof body.question === 'string' ? body.question.trim() : ''
  const path = typeof body.path === 'string' ? body.path : ''
  const messages = cleanMessages(body.messages)

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
    const upstreamAnswer = await askUpstream(upstream, question, path, sources, messages)
    if (upstreamAnswer) {
      return respondAndRecord(req, {
        question,
        answer: upstreamAnswer.answer,
        mode: 'ai',
        path,
        sources,
        messages,
      })
    }
  }

  if (process.env.OPENAI_API_KEY) {
    const answer = await askOpenAI(question, path, rankedDocs, messages)
    if (answer) {
      return respondAndRecord(req, { question, answer, mode: 'ai', path, sources, messages })
    }
  }

  return respondAndRecord(req, {
    question,
    answer: fallbackAnswer(rankedDocs),
    sources,
    mode: 'search',
    path,
    messages,
  })
}

async function respondAndRecord(
  req: NextRequest,
  payload: {
    question: string
    answer: string
    mode: 'ai' | 'search'
    path: string
    sources: DocsAskSource[]
    messages: DocsAskMessage[]
  },
) {
  const record = { ...payload, ...requestMeta(req) }
  const id = await saveDocsPrompt(record)
  void forwardDocsPromptToCrm({ ...record, id })
  return NextResponse.json({ id, answer: payload.answer, sources: payload.sources, mode: payload.mode })
}

async function findRelevantDocs(question: string, path: string): Promise<RankedDoc[]> {
  const corpus = docsCorpus()
  const terms = tokenize(question)
  const activeSlug = path.startsWith('/docs/') ? path.replace(/^\/docs\//, '') : ''

  return corpus
    .map(doc => {
      const haystack = `${doc.slug} ${doc.title} ${doc.description ?? ''} ${doc.plainText}`.toLowerCase()
      let score = doc.slug === activeSlug ? 8 : 0

      for (const term of terms) {
        const matches = haystack.split(term).length - 1
        score += Math.min(matches, 8)
        if (doc.slug.includes(term)) score += 4
        if (doc.title.toLowerCase().includes(term)) score += 5
      }

      return {
        slug: doc.slug,
        title: doc.title,
        href: doc.href,
        plainText: doc.plainText,
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
  sources: DocsAskSource[],
  messages: DocsAskMessage[],
) {
  try {
    const res = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, path, sources, messages }),
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

async function askOpenAI(
  question: string,
  path: string,
  docs: RankedDoc[],
  messages: DocsAskMessage[],
): Promise<string | null> {
  const model = process.env.DOCS_AI_MODEL || process.env.OPENAI_MODEL
  if (!model) return null

  const context = docs
    .map((doc, index) => {
      const excerpt = doc.plainText.slice(0, 1800)
      return `[${index + 1}] ${doc.title}\nURL: ${doc.href}\n${excerpt}`
    })
    .join('\n\n')
  const transcript = messages
    .slice(-8)
    .map(message => `${message.role}: ${message.content}`)
    .join('\n')

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
        input: `Current page: ${path || '/docs'}\nQuestion: ${question}\n\nRecent chat:\n${transcript || '(none)'}\n\nDocs context:\n${context}`,
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

function cleanMessages(value: unknown): DocsAskMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const role = 'role' in item && item.role === 'assistant' ? 'assistant' : 'user'
      const content = 'content' in item && typeof item.content === 'string'
        ? item.content.trim().slice(0, 2_000)
        : ''
      return content ? { role, content } : null
    })
    .filter((item): item is DocsAskMessage => item !== null)
    .slice(-12)
}

function requestMeta(req: NextRequest) {
  return {
    ip:
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown',
    ua: (req.headers.get('user-agent') || '').slice(0, 500),
    referer: (req.headers.get('referer') || '').slice(0, 500),
  }
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
