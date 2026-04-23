import { NextRequest, NextResponse } from 'next/server'
import { readFile, access } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

// Allowed deployment files for ?file= parameter
const ALLOWED_FILES = [
  'morpho-e2e.json',
  'local-e2e.json',
  'local-frontend.json',
  'active-deployment.json',
]

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
}

const L3_RPC_URL =
  process.env.L3_RPC_URL ||
  process.env.NEXT_PUBLIC_L3_RPC_URL ||
  'http://142.132.164.24/'

// Contracts whose bytecode we verify at request time. Keeps the response
// self-auditing: if an address goes dead on-chain, callers see it flagged
// in `_liveness` rather than silently dispatching calls to a ghost.
const VERIFY_KEYS = ['Vision', 'USDC', 'L3_WUSDC', 'Index']

async function ethGetCode(address: string): Promise<string | null> {
  try {
    const r = await fetch(L3_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getCode',
        params: [address, 'latest'],
      }),
      signal: AbortSignal.timeout(3000),
    })
    if (!r.ok) return null
    const body = (await r.json()) as { result?: string }
    return body.result || null
  } catch {
    return null
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function attachLiveness(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const contracts = (payload.contracts || {}) as Record<string, string>
  const liveness: Record<string, { deployed: boolean; bytecodeLen: number }> = {}
  await Promise.all(
    VERIFY_KEYS.map(async key => {
      const addr = contracts[key]
      if (!addr || typeof addr !== 'string') return
      const code = await ethGetCode(addr)
      if (code === null) return
      const len = Math.max(0, (code.length - 2) / 2)
      liveness[key] = { deployed: len > 0, bytecodeLen: len }
    }),
  )
  return { ...payload, _liveness: liveness, _rpc: L3_RPC_URL }
}

export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get('file')

  try {
    // --- Existing behavior: ?file= serves specific deployment files ---
    if (file) {
      if (!ALLOWED_FILES.includes(file)) {
        return NextResponse.json(
          { error: 'Invalid file parameter' },
          { status: 400 },
        )
      }

      const deploymentsDir = join(process.cwd(), '..', 'deployments')
      const filePath = join(deploymentsDir, file)

      try {
        const content = await readFile(filePath, 'utf-8')
        return NextResponse.json(JSON.parse(content), { headers: CACHE_HEADERS })
      } catch {
        if (file === 'active-deployment.json') {
          const publicPath = join(process.cwd(), 'public', 'deployment.json')
          try {
            const content = await readFile(publicPath, 'utf-8')
            return NextResponse.json(JSON.parse(content), { headers: CACHE_HEADERS })
          } catch {
            // Both paths failed
          }
        }
        return NextResponse.json(
          { error: 'Deployment file not found' },
          { status: 404 },
        )
      }
    }

    // --- Default: runtime deployment config ---
    const candidates = [
      process.env.DEPLOYMENT_FILE,
      join(process.cwd(), 'lib', 'contracts', 'deployment.json'),
      join(process.cwd(), 'public', 'deployment.json'),
    ].filter(Boolean) as string[]

    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        const content = await readFile(candidate, 'utf-8')
        const parsed = JSON.parse(content) as Record<string, unknown>
        const verified = await attachLiveness(parsed)
        return NextResponse.json(verified, { headers: CACHE_HEADERS })
      }
    }

    return NextResponse.json(
      { error: 'Deployment config not found' },
      { status: 404 },
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to load deployment config' },
      { status: 500 },
    )
  }
}
