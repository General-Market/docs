import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

// Allowed deployment files
const ALLOWED_FILES = [
  'morpho-e2e.json',
  'local-e2e.json',
  'local-frontend.json',
  'active-deployment.json',
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const file = searchParams.get('file')

  if (!file || !ALLOWED_FILES.includes(file)) {
    return NextResponse.json(
      { error: 'Invalid or missing file parameter' },
      { status: 400 }
    )
  }

  try {
    // Try deployments directory first (local dev: ../deployments/)
    const deploymentsDir = join(process.cwd(), '..', 'deployments')
    const filePath = join(deploymentsDir, file)

    const content = await readFile(filePath, 'utf-8')
    const data = JSON.parse(content)

    return NextResponse.json(data)
  } catch {
    // Fallback: public/deployment.json (Vercel production)
    if (file === 'active-deployment.json') {
      try {
        const publicPath = join(process.cwd(), 'public', 'deployment.json')
        const content = await readFile(publicPath, 'utf-8')
        const data = JSON.parse(content)
        return NextResponse.json(data)
      } catch {
        // Both paths failed
      }
    }
    return NextResponse.json(
      { error: 'Deployment file not found' },
      { status: 404 }
    )
  }
}
