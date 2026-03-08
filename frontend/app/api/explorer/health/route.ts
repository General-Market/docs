import { NextRequest, NextResponse } from 'next/server'
import { AA_DATA_NODE_URL } from '@/lib/config'

const VALID_ENDPOINTS = ['history', 'latest']
const VALID_RANGES = ['1h', '6h', '24h', '7d', '30d']
const MAX_RESPONSE_BYTES = 5_000_000 // 5 MB
const EXPLORER_TOKEN = process.env.EXPLORER_TOKEN || ''

// H26: Whitelist of allowed fields in aggregated snapshots.
const SNAPSHOT_FIELDS = [
  'poll_batch_ts', 'quorum_met', 'worst_status',
  'consensus_rounds_total', 'consensus_success_total', 'consensus_failed_total',
  'signatures_collected', 'avg_consensus_time_ms', 'avg_cycle_duration_ms',
  'orders_processed_last_60s', 'pending_order_count',
  'total_peers', 'p2p_messages_received', 'p2p_messages_sent',
  'total_peers_healthy', 'total_peers_unhealthy',
] as const

function filterSnapshot(s: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of SNAPSHOT_FIELDS) {
    if (key in s) out[key] = s[key]
  }
  return out
}

export async function GET(req: NextRequest) {
  // H15: Fail closed if token not configured server-side
  if (!EXPLORER_TOKEN) {
    return NextResponse.json({ error: 'Explorer not configured' }, { status: 503 })
  }

  const { searchParams } = req.nextUrl
  const endpoint = searchParams.get('endpoint') || 'history'
  const range = searchParams.get('range') || '24h'

  // H9: Validate endpoint
  if (!VALID_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
  }

  // H9: Validate range
  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 })
  }

  const url = new URL(`${AA_DATA_NODE_URL}/explorer/health/${endpoint}`)
  url.searchParams.set('range', range)

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: 'application/json',
        'x-explorer-token': EXPLORER_TOKEN,
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 })
    }

    // H16: Check body size AFTER reading (chunked has no Content-Length)
    const body = await res.text()
    if (body.length > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: 'Response too large' }, { status: 502 })
    }

    const data = JSON.parse(body)

    // H26 + H34: Whitelist response fields, safe fallback defaults
    let filtered: unknown
    if (endpoint === 'history' && Array.isArray(data?.snapshots)) {
      filtered = { snapshots: data.snapshots.map(filterSnapshot) }
    } else if (endpoint === 'latest' && data?.network != null) {
      filtered = { network: filterSnapshot(data.network) }
    } else {
      // H34: Safe default — never forward raw unfiltered upstream data
      filtered = endpoint === 'latest' ? { network: null } : { snapshots: [] }
    }

    return NextResponse.json(filtered, {
      headers: { 'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60' },
    })
  } catch {
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 })
  }
}
