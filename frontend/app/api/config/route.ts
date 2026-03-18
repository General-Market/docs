import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Serves static JSON config files at runtime instead of baking them into the bundle.
// Usage: GET /api/config?type=itp-id-names | GET /api/config?type=blacklisted-itps

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const FILE_MAP: Record<string, string> = {
  'itp-id-names': 'lib/itp-id-names.json',
  'blacklisted-itps': 'lib/config/blacklisted-itps.json',
  'sources-display': 'data/sources-display.json',
}

function safeReadJson(relativePath: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8'))
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')

  if (!type) {
    // Return all config in a single payload
    const itpNames = safeReadJson(FILE_MAP['itp-id-names'])
    const blacklist = safeReadJson(FILE_MAP['blacklisted-itps'])
    const sources = safeReadJson(FILE_MAP['sources-display'])
    return NextResponse.json({ itpNames, blacklist, sources })
  }

  const filePath = FILE_MAP[type]
  if (!filePath) {
    return NextResponse.json(
      { error: `Unknown config type: ${type}. Valid: ${Object.keys(FILE_MAP).join(', ')}` },
      { status: 400 },
    )
  }

  const data = safeReadJson(filePath)
  if (data === null) {
    return NextResponse.json({ error: `Config file not found: ${type}` }, { status: 404 })
  }

  return NextResponse.json(data)
}
