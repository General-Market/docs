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
    // Path to deployments directory (relative to project root)
    const deploymentsDir = join(process.cwd(), '..', 'deployments')
    const filePath = join(deploymentsDir, file)

    const content = await readFile(filePath, 'utf-8')
    const data = JSON.parse(content)

    return NextResponse.json(data)
  } catch (error) {
    // File doesn't exist or can't be read
    return NextResponse.json(
      { error: 'Deployment file not found' },
      { status: 404 }
    )
  }
}
