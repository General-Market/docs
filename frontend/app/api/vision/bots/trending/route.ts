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

// Top-level dirs in the repo that ship a runnable bot. The rail surfaces
// every entry on every source page so the source-matched bot lands next
// to the other available examples. Update when a new sibling bot lands.
//
// Skipped: visualizer (shared SPA), AGENTS.md (docs), setup.sh (root).
const BOT_DIRS = ['twitch', 'polymarket'] as const

async function fetchBotEntry(dir: string): Promise<BotEntry | null> {
  const contentsUrl = `${GITHUB_API}/repos/${REPO}/contents/${encodeURIComponent(dir)}`
  let res: Response
  try {
    res = await githubFetch(contentsUrl)
  } catch {
    return null
  }
  if (!res.ok) return null

  const [lastCommitAt, description] = await Promise.all([
    fetchLastCommitAt(dir),
    fetchReadmeDescription(contentsUrl),
  ])

  return {
    name: `${dir} bot`,
    path: dir,
    lastCommitAt,
    htmlUrl: `https://github.com/${REPO}/tree/main/${encodeURIComponent(dir)}`,
    description,
    sparkline7d: null,
  }
}

export async function GET(request: Request): Promise<NextResponse<TrendingBotsResponse>> {
  const { searchParams } = new URL(request.url)
  const sourceId = searchParams.get('source')

  if (!sourceId) {
    return NextResponse.json(
      { bots: [], _stub: true, reason: 'missing source param' },
      { status: 400 },
    )
  }

  // Fetch every known bot. The source-matched one sorts first; the rest
  // ride along as related examples, side by side, on every page.
  const settled = await Promise.all(BOT_DIRS.map(fetchBotEntry))
  const bots = settled.filter((b): b is BotEntry => b !== null)

  if (bots.length === 0) {
    return stubResponse('github unreachable or empty repo')
  }

  bots.sort((a, b) => {
    if (a.path === sourceId) return -1
    if (b.path === sourceId) return 1
    return a.path.localeCompare(b.path)
  })

  return NextResponse.json(
    { bots },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } },
  )
}
