import { NextResponse } from 'next/server'

export const revalidate = 3600

const GITHUB_API = 'https://api.github.com'
const REPO = 'General-Market/vision-bot-examples'

interface GitHubEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  html_url: string
  url: string
}

interface GitHubCommit {
  commit: {
    committer: { date: string }
  }
}

export interface BotEntry {
  name: string
  path: string
  lastCommitAt: string | null
  htmlUrl: string
  description: string | null
  sparkline7d: null
}

export interface TrendingBotsResponse {
  bots: BotEntry[]
  _stub?: true
  reason?: string
}

async function githubFetch(url: string): Promise<Response> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (process.env['GITHUB_TOKEN']) {
    headers['Authorization'] = `Bearer ${process.env['GITHUB_TOKEN']}`
  }
  return fetch(url, { headers, next: { revalidate: 3600 } })
}

async function fetchLastCommitAt(path: string): Promise<string | null> {
  try {
    const res = await githubFetch(
      `${GITHUB_API}/repos/${REPO}/commits?path=${encodeURIComponent(path)}&per_page=1`,
    )
    if (!res.ok) return null
    const commits: GitHubCommit[] = await res.json()
    return commits[0]?.commit?.committer?.date ?? null
  } catch {
    return null
  }
}

async function fetchReadmeDescription(dirUrl: string): Promise<string | null> {
  try {
    const res = await githubFetch(dirUrl)
    if (!res.ok) return null
    const entries: GitHubEntry[] = await res.json()
    const readme = entries.find(
      (e) => e.type === 'file' && e.name.toLowerCase() === 'readme.md',
    )
    if (!readme) return null

    const rawRes = await fetch(
      `https://raw.githubusercontent.com/${REPO}/main/${readme.path}`,
      { next: { revalidate: 3600 } },
    )
    if (!rawRes.ok) return null
    const text = await rawRes.text()

    // Extract the first non-heading paragraph
    const lines = text.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
        // Return the first meaningful paragraph, truncated to 120 chars
        return trimmed.length > 120 ? trimmed.slice(0, 117) + '…' : trimmed
      }
    }
    return null
  } catch {
    return null
  }
}

function stubResponse(reason: string): NextResponse<TrendingBotsResponse> {
  return NextResponse.json(
    { bots: [], _stub: true, reason },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
  )
}

export async function GET(request: Request): Promise<NextResponse<TrendingBotsResponse>> {
  const { searchParams } = new URL(request.url)
  const sourceId = searchParams.get('source')

  if (!sourceId) {
    return NextResponse.json({ bots: [], _stub: true, reason: 'missing source param' }, { status: 400 })
  }

  const contentsUrl = `${GITHUB_API}/repos/${REPO}/contents/${encodeURIComponent(sourceId)}`

  let contentsRes: Response
  try {
    contentsRes = await githubFetch(contentsUrl)
  } catch {
    return stubResponse('github unreachable')
  }

  if (contentsRes.status === 404) {
    // No bots for this source yet — not an error, just empty
    return NextResponse.json(
      { bots: [] },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } },
    )
  }

  if (contentsRes.status === 403 || contentsRes.status === 429) {
    return stubResponse('github rate limit')
  }

  if (!contentsRes.ok) {
    return stubResponse('github unreachable')
  }

  let entries: GitHubEntry[]
  try {
    entries = await contentsRes.json()
  } catch {
    return stubResponse('github unreachable')
  }

  if (!Array.isArray(entries)) {
    return stubResponse('github unreachable')
  }

  // Top-level subdirectories = bots
  const dirs = entries.filter((e) => e.type === 'dir')

  const bots: BotEntry[] = await Promise.all(
    dirs.map(async (dir): Promise<BotEntry> => {
      const [lastCommitAt, description] = await Promise.all([
        fetchLastCommitAt(dir.path),
        fetchReadmeDescription(dir.url),
      ])
      return {
        name: dir.name,
        path: dir.path,
        lastCommitAt,
        htmlUrl: dir.html_url,
        description,
        sparkline7d: null,
      }
    }),
  )

  return NextResponse.json(
    { bots },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } },
  )
}
