import { randomUUID } from 'crypto'
import { Pool } from 'pg'

export type DocsAskSource = {
  title: string
  href: string
}

export type DocsAskMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type DocsPromptRecord = {
  id?: string
  question: string
  answer: string
  mode: 'ai' | 'search'
  path: string
  ip: string
  ua: string
  referer: string
  sources: DocsAskSource[]
  messages: DocsAskMessage[]
}

let _pool: Pool | null = null
let _schemaReady = false
const memStore: DocsPromptRecord[] = []

function getDocsPromptPool(): Pool | null {
  if (_pool) return _pool
  const url = process.env.DOCS_PROMPTS_DATABASE_URL || process.env.WAITLIST_DATABASE_URL
  if (!url) return null
  _pool = new Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30_000 })
  _pool.on('error', err => console.error('[docs-ask] pg pool error', err))
  return _pool
}

async function ensureSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS docs_ai_prompts (
      id          UUID PRIMARY KEY,
      question    TEXT NOT NULL,
      answer      TEXT,
      mode        TEXT NOT NULL,
      path        TEXT,
      ip          TEXT NOT NULL,
      ua          TEXT,
      referer     TEXT,
      sources     JSONB NOT NULL DEFAULT '[]'::JSONB,
      messages    JSONB NOT NULL DEFAULT '[]'::JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS docs_ai_prompts_ip_created_idx
      ON docs_ai_prompts (ip, created_at DESC);
  `)
  _schemaReady = true
}

export async function saveDocsPrompt(record: DocsPromptRecord): Promise<string> {
  const id = record.id || randomUUID()
  const row = { ...record, id }
  const pool = getDocsPromptPool()

  if (!pool) {
    memStore.push(row)
    return id
  }

  await ensureSchema(pool)
  await pool.query(
    `INSERT INTO docs_ai_prompts
       (id, question, answer, mode, path, ip, ua, referer, sources, messages)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,
    [
      id,
      row.question,
      row.answer,
      row.mode,
      row.path,
      row.ip,
      row.ua,
      row.referer,
      JSON.stringify(row.sources),
      JSON.stringify(row.messages),
    ],
  )
  return id
}

export async function forwardDocsPromptToCrm(record: DocsPromptRecord): Promise<void> {
  const token = process.env.DOCS_CRM_WEBHOOK_TOKEN || process.env.CRM_SIDECAR_TOKEN || process.env.SIDECAR_TOKEN
  const url =
    process.env.DOCS_CRM_WEBHOOK_URL ||
    process.env.CRM_DOCS_PROMPT_URL ||
    (token ? 'https://crm.crxfx.com/sidecar/docs-prompts' : '')

  if (!url) return

  try {
    const headers = new Headers({ 'Content-Type': 'application/json' })
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source: 'generalmarket-docs', ...record }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error('[docs-ask] CRM prompt forward failed:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[docs-ask] CRM prompt forward failed:', err)
  }
}
