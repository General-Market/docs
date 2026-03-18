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

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
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

      // Try deployments directory first (local dev: ../deployments/)
      const deploymentsDir = join(process.cwd(), '..', 'deployments')
      const filePath = join(deploymentsDir, file)

      try {
        const content = await readFile(filePath, 'utf-8')
        return NextResponse.json(JSON.parse(content), { headers: CACHE_HEADERS })
      } catch {
        // Fallback for active-deployment.json: try public/deployment.json (Vercel)
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

    // --- Default: runtime deployment config (no ?file= param) ---
    // Priority: DEPLOYMENT_FILE env var > lib/contracts/deployment.json > public/deployment.json
    const candidates = [
      process.env.DEPLOYMENT_FILE,
      join(process.cwd(), 'lib', 'contracts', 'deployment.json'),
      join(process.cwd(), 'public', 'deployment.json'),
    ].filter(Boolean) as string[]

    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        const content = await readFile(candidate, 'utf-8')
        return NextResponse.json(JSON.parse(content), { headers: CACHE_HEADERS })
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
